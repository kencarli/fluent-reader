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
 * Get LLM provider configuration from settings
 */
export function getLLMProvider(settings: IntegrationSettings): { 
    provider: "openai" | "nvidia" | "deepseek" | "ollama"
    apiKey?: string
    apiUrl: string
    model: string
} | null {
    // Check Ollama first (local LLM)
    if (settings.ollamaApiUrl && settings.ollamaModel) {
        return {
            provider: "ollama",
            apiUrl: settings.ollamaApiUrl.replace(/\/$/, '') + '/api/chat',
            model: settings.ollamaModel
        }
    }
    // Check cloud providers
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
 * Wait for database to be fully initialized
 */
async function waitForDBReady(maxWaitMs: number = 5000): Promise<void> {
    const startTime = Date.now()
    const checkInterval = 200
    
    console.log('[waitForDBReady] Waiting for database to be ready...')
    
    while (Date.now() - startTime < maxWaitMs) {
        // Check if db module is initialized
        const dbReady = !!(db.itemsDB && db.items)
        if (dbReady) {
            console.log('[waitForDBReady] Database is ready!')
            return
        }
        await new Promise(resolve => setTimeout(resolve, checkInterval))
    }
    
    const elapsedTime = Date.now() - startTime
    console.error('[waitForDBReady] Database not ready after', elapsedTime, 'ms')
    console.error('[waitForDBReady] db.itemsDB:', !!db.itemsDB, 'db.items:', !!db.items)
    throw new Error('Database not ready after waiting. Please refresh the page and try again.')
}

/**
 * Fetches items from the last N hours.
 * @param hours - Number of hours to look back
 * @param sourceIds - Optional array of source IDs to filter by
 * @param feedId - Optional feed ID (e.g., "s-1" for source, "g-1" for group, "ALL" for all)
 * @param filters - Optional content filters
 */
export async function getRecentItems(
    hours: number = 24,
    sourceIds?: number[],
    feedId?: string,
    filters?: { titleContains?: string[], contentContains?: string[], articleDateRange?: string }
): Promise<RSSItem[]> {
    // Wait for database to be ready
    await waitForDBReady()

    console.log('[getRecentItems] Database ready, feedId:', feedId, 'hours:', hours)
    console.log('[getRecentItems] db.itemsDB:', db.itemsDB)
    console.log('[getRecentItems] db.items:', db.items)
    console.log('[getRecentItems] db.items.source:', db.items?.source)

    // Calculate cutoff date based on articleDateRange
    let cutoff: Date | undefined = undefined
    if (filters?.articleDateRange) {
        const now = Date.now()
        switch (filters.articleDateRange) {
            case '1d':
                cutoff = new Date(now - 1 * 86400000)
                break
            case '3d':
                cutoff = new Date(now - 3 * 86400000)
                break
            case '7d':
                cutoff = new Date(now - 7 * 86400000)
                break
            // 'all' or default: no cutoff
        }
    } else if (hours) {
        cutoff = new Date(Date.now() - hours * 60 * 60 * 1000)
    }

    try {
        let query = db.itemsDB
            .select()
            .from(db.items)
        
        if (cutoff) {
            query = query.where(db.items.date.gte(cutoff))
        }

        console.log('[getRecentItems] Initial query created')

        // Use feedId if provided (takes precedence over sourceIds)
        if (feedId && feedId !== 'ALL') {
            if (feedId.startsWith("s-")) {
                // Single source
                const sourceId = parseInt(feedId.substring(2))
                console.log('[getRecentItems] Filtering by source:', sourceId)
                
                // Check if source column exists
                const sourceCol = db.items.source
                console.log('[getRecentItems] sourceCol:', sourceCol)
                
                query = query.where(sourceCol.eq(sourceId))
            } else if (feedId.startsWith("g-")) {
                // Group - need to get source IDs from store
                const groupIndex = parseInt(feedId.substring(2))
                const groups = (window as any).__STORE__?.getState()?.groups
                if (groups && groups[groupIndex]?.sids) {
                    console.log('[getRecentItems] Filtering by group:', groups[groupIndex].sids)
                    query = query.where(db.items.source.in(groups[groupIndex].sids))
                }
            }
            // feedId === 'ALL' means no filter
        } else if (sourceIds && sourceIds.length > 0) {
            // Fallback to sourceIds for backward compatibility
            console.log('[getRecentItems] Filtering by sourceIds:', sourceIds)
            query = query.where(db.items.source.in(sourceIds))
        }

        console.log('[getRecentItems] Executing query...')
        let items = (await query
            .orderBy(db.items.date, lf.Order.DESC)
            .exec()) as RSSItem[]

        console.log('[getRecentItems] Query executed successfully, items:', items.length)

        // Apply content filters
        if (filters) {
            if (filters.titleContains && filters.titleContains.length > 0) {
                items = items.filter(item => 
                    filters.titleContains!.some(keyword => 
                        item.title.toLowerCase().includes(keyword.toLowerCase())
                    )
                )
            }
            if (filters.contentContains && filters.contentContains.length > 0) {
                items = items.filter(item => {
                    const content = item.content || ''
                    return filters.contentContains!.some(keyword => 
                        content.toLowerCase().includes(keyword.toLowerCase())
                    )
                })
            }
        }

        return items
    } catch (error) {
        console.error('[getRecentItems] Query execution failed:', error)
        console.error('[getRecentItems] Error details:', {
            message: error instanceof Error ? error.message : error,
            code: (error as any)?.code,
            stack: (error as any)?.stack
        })
        throw error
    }
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
    provider: { provider: string; apiKey?: string; apiUrl: string; model: string },
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
        // Ollama uses different API format
        const isOllama = provider.provider === "ollama"
        const response = await fetch(provider.apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(isOllama ? {} : { "Authorization": `Bearer ${provider.apiKey}` })
            },
            body: JSON.stringify({
                model: provider.model,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                temperature: 0.7,
                stream: false  // Ollama requires this for non-streaming
            })
        })

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: { message: response.statusText } }))
            throw new Error(`LLM API error: ${error.error?.message || response.statusText}`)
        }

        const data = await response.json()
        return {
            content: isOllama ? data.message?.content : data.choices[0].message.content,
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
        feedId?: string,  // Feed ID from navigation (e.g., "s-1", "g-1", "ALL")
        items?: RSSItem[]  // Optional: pre-fetched items (if provided, feedId and hours are ignored)
    }
): Promise<BriefingResult> {
    const { settings, language = "en", topics = [], dalleEnabled = false, hours = 24, feedId, items: preFetchedItems } = options

    // Get LLM provider
    const provider = getLLMProvider(settings)
    if (!provider) {
        throw new Error("No LLM provider configured. Please add API key in Settings > Integrations.")
    }

    // 1. Fetch articles or use pre-fetched items
    let items = preFetchedItems
    if (!items) {
        const targetFeedId = feedId || settings.digestFeedId || 'ALL'
        const filters = settings.digestFilters
        items = await getRecentItems(hours, undefined, targetFeedId, filters)
    }
    
    if (items.length === 0) throw new Error("No articles available.")
    
    // Apply min/max article limits
    const filters = settings.digestFilters
    if (filters?.minArticles && items.length < filters.minArticles) {
        throw new Error(`Not enough articles. Found ${items.length}, minimum required: ${filters.minArticles}`)
    }
    if (filters?.maxArticles && items.length > filters.maxArticles) {
        items = items.slice(0, filters.maxArticles)
    }

    // 2. Topic Filtering (Semantic Search) - only for cloud providers
    // Ollama doesn't support embeddings yet, skip topic filtering for Ollama
    if (topics.length > 0 && provider.provider !== "ollama") {
        const itemMap: { [_id: number]: RSSItem } = {}
        items.forEach(i => itemMap[i._id] = i)

        const filteredResults = await semanticSearch(topics.join(", "), provider.apiKey!, itemMap, 30)
        items = filteredResults.map(r => r.item)
    } else if (topics.length > 0 && provider.provider === "ollama") {
        console.log('Topic filtering not available for Ollama. Using all recent articles.')
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

    const chatResponse = await fetch(provider.apiUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(provider.provider === "ollama" ? {} : { "Authorization": `Bearer ${provider.apiKey}` })
        },
        body: JSON.stringify({
            model: provider.model,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            stream: false
        })
    })

    if (!chatResponse.ok) {
        const error = await chatResponse.json().catch(() => ({ error: { message: chatResponse.statusText } }))
        throw new Error(`LLM API error: ${error.error?.message || chatResponse.statusText}`)
    }

    const chatData = await chatResponse.json()
    const content = provider.provider === "ollama" ? chatData.message?.content : chatData.choices[0].message.content

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
