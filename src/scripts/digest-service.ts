import { RSSItem } from "./models/item"
import { extractTextFromHtml } from "./summary"
import * as db from "./db"
import lf from "lovefield"
import { semanticSearch } from "./semantic-search"

const OPENAI_CHAT_API = "https://api.openai.com/v1/chat/completions"
const OPENAI_IMAGE_API = "https://api.openai.com/v1/images/generations"

export interface BriefingResult {
    content: string
    timestamp: Date
    articleCount: number
    coverUrl?: string
}

/**
 * Fetches items from the last N hours.
 */
export async function getRecentItems(hours: number = 24): Promise<RSSItem[]> {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000)
    return (await db.itemsDB
        .select()
        .from(db.items)
        .where(db.items.date.gte(cutoff))
        .orderBy(db.items.date, lf.Order.DESC)
        .exec()) as RSSItem[]
}

export interface BriefingResult {
    content: string
    timestamp: Date
    articleCount: number
}

/**
 * Formats a list of articles into a structured text for LLM ingestion.
 */
export function formatArticlesForAI(items: RSSItem[]): string {
    return items.map((item, index) => {
        const text = extractTextFromHtml(item.content)
        // Limit each snippet to avoid context overflow (approx 500 chars per item)
        const snippet = text.substring(0, 500)
        return `[Article ${index + 1}]\nTitle: ${item.title}\nSource: ${item.source}\nContent: ${snippet}\n---\n`
    }).join("\n")
}

/**
 * Generates a structured news digest using OpenAI API.
 */
export async function generateAIDigest(
    items: RSSItem[],
    apiKey: string,
    language: string = "en"
): Promise<BriefingResult> {
    if (items.length === 0) {
        throw new Error("No articles available for digest.")
    }

    const context = formatArticlesForAI(items)
    const systemPrompt = language.startsWith("zh")
        ? "你是一个资深的科技/新闻编辑。请根据提供的多篇文章内容，生成一份结构清晰、可读性强的每日报送。包括：1. 核心综述（一段话总结今日重点）；2. 分类资讯（按主题归类，每条包含标题和简要概括）；3. 深度观察（如果有值得深度阅读的内容）。使用 Markdown 格式。"
        : "You are a senior news editor. Based on the provided articles, generate a structured and highly readable daily briefing. Include: 1. Executive Summary; 2. Categorized News (grouped by topic, each with title and brief summary); 3. Deep Dives (if any significant content found). Use Markdown format."

    const userPrompt = `Here are the articles:\n\n${context}\n\nPlease generate the briefing in ${language.startsWith("zh") ? "Chinese" : "English"}.`

    try {
        const response = await fetch(OPENAI_CHAT_API, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini", // Use gpt-4o-mini for speed/cost efficiently
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                temperature: 0.7
            })
        })

        if (!response.ok) {
            const error = await response.json()
            throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`)
        }

        const data = await response.json()
        return {
            content: data.choices[0].message.content,
            timestamp: new Date(),
            articleCount: items.length
        }
    } catch (error) {
        console.error("Digest generation failed:", error)
        throw error
    }
}


/**
 * Generates an image using DALL-E based on the digest content.
 */
export async function generateCoverImage(
    summary: string,
    apiKey: string
): Promise<string | undefined> {
    try {
        const response = await fetch(OPENAI_IMAGE_API, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "dall-e-3",
                prompt: `Create a minimalist, modern, and professional editorial illustration for a daily news digest with the following theme: ${summary.substring(0, 500)}. No text in the image.`,
                n: 1,
                size: "1024x1024",
                quality: "standard"
            })
        })

        if (!response.ok) return undefined

        const data = await response.json()
        return data.data[0].url
    } catch (e) {
        console.error("DALL-E generation failed:", e)
        return undefined
    }
}

/**
 * Enhanced digest generation with topic filtering and DALL-E support.
 */
export async function generateEnhancedDigest(
    options: {
        apiKey: string,
        language?: string,
        topics?: string[],
        dalleEnabled?: boolean,
        hours?: number
    }
): Promise<BriefingResult> {
    const { apiKey, language = "en", topics = [], dalleEnabled = false, hours = 24 } = options

    // 1. Fetch articles
    let items = await getRecentItems(hours)
    if (items.length === 0) throw new Error("No articles available.")

    // 2. Topic Filtering (Semantic Search)
    if (topics.length > 0) {
        const itemMap: { [_id: number]: RSSItem } = {}
        items.forEach(i => itemMap[i._id] = i)

        const filteredResults = await semanticSearch(topics.join(", "), apiKey, itemMap, 30)
        items = filteredResults.map(r => r.item)
    }

    // Limit to top 15 items
    const selectedItems = items.slice(0, 15)

    // 3. Generate Content
    const context = formatArticlesForAI(selectedItems)
    const isChinese = language.startsWith("zh")

    const systemPrompt = isChinese
        ? "你是一个资深的全球科技新闻编辑。请根据提供的文章（包括外语文章），生成一份结构清晰、可读性强的每日报送。如果原始文章是英文或其他语言，请将其要点翻译并汇总为中文。报送需包含：1. 核心综述（今日全球大趋势）；2. 专题资讯（按主题分类，每条包含深度总结）；3. 趣味/深度推荐。使用 Markdown 格式。"
        : "You are a senior global news editor. Generate a structured daily briefing based on the provided articles. If articles are in other languages, translate and summarize them into English. Include: 1. Executive Summary; 2. Categorized News (deep summaries); 3. Deep Dives/Recommendations. Use Markdown format."

    const userPrompt = `Articles:\n\n${context}\n\nPlease generate the briefing in ${isChinese ? "Chinese" : "English"}.`

    const chatResponse = await fetch(OPENAI_CHAT_API, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ]
        })
    })

    if (!chatResponse.ok) {
        const error = await chatResponse.json()
        throw new Error(`OpenAI API error: ${error.error?.message}`)
    }

    const chatData = await chatResponse.json()
    const content = chatData.choices[0].message.content

    // 4. DALL-E Image
    let coverUrl: string | undefined = undefined
    if (dalleEnabled) {
        // Use the first paragraph as theme for DALL-E
        const firstPara = content.split('\n').filter(l => l.trim().length > 20)[0] || content
        coverUrl = await generateCoverImage(firstPara, apiKey)
    }

    return {
        content,
        timestamp: new Date(),
        articleCount: selectedItems.length,
        coverUrl
    }
}
