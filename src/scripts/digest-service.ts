import { RSSItem } from "./models/item"
import { extractTextFromHtml } from "./summary"
import * as db from "./db"
import lf from "lovefield"
import { semanticSearch } from "./semantic-search"
import { IntegrationSettings } from "../schema-types"

const OPENAI_CHAT_API = "https://api.openai.com/v1/chat/completions"
const NVIDIA_CHAT_API = "https://integrate.api.nvidia.com/v1/chat/completions"
const DEEPSEEK_CHAT_API = "https://api.deepseek.com/v1/chat/completions"
const OPENAI_IMAGE_API = "https://api.openai.com/v1/images/generations"

export interface BriefingResult {
    content: string
    timestamp: Date
    articleCount: number
    coverUrl?: string
}

/**
 * Get LLM provider configuration from settings (supports OpenAI, NVIDIA, DeepSeek, Ollama)
 */
export function getLLMProvider(settings: IntegrationSettings): {
    provider: "openai" | "nvidia" | "deepseek" | "ollama"
    apiKey?: string
    apiUrl: string
    model: string
} | null {
    // Priority order: Ollama > NVIDIA > DeepSeek > OpenAI
    // Ollama first because it's local and free
    if (settings.ollamaApiUrl && settings.ollamaModel) {
        return {
            provider: "ollama",
            apiUrl: settings.ollamaApiUrl.replace(/\/$/, '') + '/api/chat',
            model: settings.ollamaModel
        }
    }
    if (settings.nvidiaApiKey) {
        return {
            provider: "nvidia",
            apiKey: settings.nvidiaApiKey,
            apiUrl: NVIDIA_CHAT_API,
            model: "meta/llama-3.1-70b-instruct"
        }
    }
    if (settings.deepseekApiKey) {
        return {
            provider: "deepseek",
            apiKey: settings.deepseekApiKey,
            apiUrl: DEEPSEEK_CHAT_API,
            model: "deepseek-chat"
        }
    }
    if (settings.openaiApiKey) {
        return {
            provider: "openai",
            apiKey: settings.openaiApiKey,
            apiUrl: OPENAI_CHAT_API,
            model: "gpt-4o-mini"
        }
    }
    return null
}

/**
 * Fetches items from the last N hours.
 * @param hours - Number of hours to look back
 * @param sourceIds - Optional array of source IDs to filter by
 */
export async function getRecentItems(hours: number = 24, sourceIds?: number[]): Promise<RSSItem[]> {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000)
    let query = db.itemsDB
        .select()
        .from(db.items)
        .where(db.items.date.gte(cutoff))
    
    // Filter by source IDs if provided
    if (sourceIds && sourceIds.length > 0) {
        query = query.where(db.items.source.in(sourceIds))
    }
    
    return (await query
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
 * Generates a structured news digest using configured LLM provider.
 */
export async function generateAIDigest(
    items: RSSItem[],
    provider: { 
        provider: string
        apiKey?: string
        apiUrl: string
        model: string
    },
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
        // Build request body based on provider
        const requestBody = provider.provider === 'ollama' ? {
            model: provider.model,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            stream: false,
            options: {
                temperature: 0.7,
            }
        } : {
            model: provider.model,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            temperature: 0.7
        }

        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        }
        
        // Add Authorization header for cloud providers (not Ollama)
        if (provider.apiKey) {
            headers["Authorization"] = `Bearer ${provider.apiKey}`
        }

        const response = await fetch(provider.apiUrl, {
            method: "POST",
            headers,
            body: JSON.stringify(requestBody)
        })

        if (!response.ok) {
            const error = await response.json()
            throw new Error(`LLM API error: ${error.error?.message || response.statusText}`)
        }

        const data = await response.json()
        
        // Extract content based on provider
        const content = provider.provider === 'ollama' 
            ? data.message?.content 
            : data.choices[0].message.content
        
        if (!content) {
            throw new Error('No content generated from LLM')
        }

        return {
            content: content,
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
        settings: IntegrationSettings,
        language?: string,
        topics?: string[],
        dalleEnabled?: boolean,
        hours?: number,
        sourceIds?: number[],        // Optional: filter by specific sources
        groupIds?: number[],         // Optional: filter by specific groups
        groups?: any[],              // Optional: groups array for group-based filtering
    }
): Promise<BriefingResult> {
    const { settings, language = "en", topics = [], dalleEnabled = false, hours = 24, sourceIds, groupIds, groups } = options

    // Get LLM provider
    const provider = getLLMProvider(settings)
    if (!provider) {
        throw new Error("No LLM provider configured. Please add API key in Settings > Integrations.")
    }

    // Determine source IDs to use
    let finalSourceIds: number[] | undefined = sourceIds

    // If group IDs are specified, expand them to source IDs
    if (groupIds && groupIds.length > 0 && groups) {
        const groupSourceIds: number[] = []
        groupIds.forEach(groupId => {
            const group = groups[groupId]
            if (group && group.sids) {
                groupSourceIds.push(...group.sids)
            }
        })
        // Merge with explicit source IDs
        if (finalSourceIds) {
            finalSourceIds = [...new Set([...finalSourceIds, ...groupSourceIds])]
        } else {
            finalSourceIds = groupSourceIds
        }
    }

    // 1. Fetch articles
    let items = await getRecentItems(hours, finalSourceIds)
    if (items.length === 0) throw new Error("No articles available.")

    // 2. Topic Filtering (Semantic Search)
    if (topics.length > 0) {
        const itemMap: { [_id: number]: RSSItem } = {}
        items.forEach(i => itemMap[i._id] = i)

        const filteredResults = await semanticSearch(topics.join(", "), provider.apiKey, itemMap, 30)
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

    // Build request body based on provider
    const requestBody = provider.provider === 'ollama' ? {
        model: provider.model,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
        ],
        stream: false,
        options: {
            temperature: 0.7,
        }
    } : {
        model: provider.model,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
        ],
        temperature: 0.7
    }

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    }
    
    // Add Authorization header for cloud providers (not Ollama)
    if (provider.apiKey) {
        headers["Authorization"] = `Bearer ${provider.apiKey}`
    }

    const chatResponse = await fetch(provider.apiUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody)
    })

    if (!chatResponse.ok) {
        const error = await chatResponse.json()
        throw new Error(`LLM API error: ${error.error?.message}`)
    }

    const chatData = await chatResponse.json()
    
    // Extract content based on provider
    const content = provider.provider === 'ollama'
        ? chatData.message?.content
        : chatData.choices[0].message.content

    if (!content) {
        throw new Error('No content generated from LLM')
    }

    // 4. DALL-E Image (only available for OpenAI)
    let coverUrl: string | undefined = undefined
    if (dalleEnabled && provider.provider === "openai") {
        // Use the first paragraph as theme for DALL-E
        const firstPara = content.split('\n').filter(l => l.trim().length > 20)[0] || content
        coverUrl = await generateCoverImage(firstPara, provider.apiKey)
    }

    return {
        content,
        timestamp: new Date(),
        articleCount: selectedItems.length,
        coverUrl
    }
}
