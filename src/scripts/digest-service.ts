import { RSSItem } from "./models/item"
import { extractTextFromHtml } from "./summary"
import * as db from "./db"
import lf from "lovefield"
import { semanticSearch } from "./semantic-search"
import { IntegrationSettings } from "../schema-types"
import * as path from "path"

// Load AI prompts dynamically
const aiPrompts = require("./i18n/ai-prompts.json")

const OPENAI_CHAT_API = "https://api.openai.com/v1/chat/completions"
const NVIDIA_CHAT_API = "https://integrate.api.nvidia.com/v1/chat/completions"
const DEEPSEEK_CHAT_API = "https://api.deepseek.com/v1/chat/completions"
const OPENAI_IMAGE_API = "https://api.openai.com/v1/images/generations"

// Check if running in Tauri environment
function isTauri(): boolean {
    return typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__ !== undefined
}

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
 * Test Ollama connection and model availability
 */
export async function testOllamaConnection(apiUrl: string, model: string): Promise<{ success: boolean, message: string }> {
    try {
        const baseUrl = apiUrl.replace(/\/$/, '')
        
        // In Tauri, use proxy to avoid CORS issues
        if (isTauri()) {
            const { proxyOllama } = await import('./tauri-bridge')
            try {
                const result = await proxyOllama(`${baseUrl}/api/tags`, 'GET')
                const models = result?.models || []
                const hasModel = models.some((m: any) => m.name === model || m.name.startsWith(model))
                
                if (hasModel) {
                    return { success: true, message: `✓ Ollama 连接成功，模型 "${model}" 已就绪` }
                } else {
                    return { success: false, message: `模型 "${model}" 未找到。可用模型: ${models.map((m: any) => m.name).join(', ')}` }
                }
            } catch (error: any) {
                return { success: false, message: `Ollama 连接失败：${error.message || error}` }
            }
        }
        
        // Direct fetch for browser/Electron
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000)

        const response = await fetch(`${baseUrl}/api/tags`, {
            method: 'GET',
            signal: controller.signal,
        })
        clearTimeout(timeoutId)

        if (!response.ok) {
            return { success: false, message: `Ollama 服务响应异常：${response.status}` }
        }

        const data = await response.json()
        const models = data.models || []
        const hasModel = models.some(m => m.name === model)

        if (!hasModel) {
            return { success: false, message: `模型 "${model}" 未安装，可用模型：${models.map(m => m.name).join(', ')}` }
        }

        return { success: true, message: `✓ Ollama 连接成功，模型 "${model}" 已就绪` }
    } catch (error: any) {
        if (error.name === 'AbortError') {
            return { success: false, message: 'Ollama 连接超时，请检查网络和地址' }
        }
        return { success: false, message: `Ollama 连接失败：${error.message}` }
    }
}

/**
 * Fetches items from the last N hours.
 * @param hours - Number of hours to look back
 * @param sourceIds - Optional array of source IDs to filter by
 */
export async function getRecentItems(hours: number = 24, sourceIds?: number[]): Promise<RSSItem[]> {
    // Check if database is initialized
    if (!db.dbInitialized || !db.itemsDB || !db.items) {
        console.error('[Digest] Database not initialized. dbInitialized:', db.dbInitialized)
        throw new Error('数据库未初始化。请刷新页面。')
    }
    
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000)
    
    // Build query with proper condition combining
    // Lovefield doesn't support chaining multiple .where() calls
    // Must use lf.op.and() to combine conditions
    let query
    if (sourceIds && sourceIds.length > 0) {
        query = db.itemsDB
            .select()
            .from(db.items)
            .where(lf.op.and(
                db.items.date.gte(cutoff),
                db.items.source.in(sourceIds)
            ))
    } else {
        query = db.itemsDB
            .select()
            .from(db.items)
            .where(db.items.date.gte(cutoff))
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
 * Optimized for small models (reduced context length)
 */
export function formatArticlesForAI(items: RSSItem[]): string {
    return items.map((item, index) => {
        const text = extractTextFromHtml(item.content)
        // 优化：减少每篇 snippets 长度（从 500 降到 250）
        const snippet = text.substring(0, 250)
        return `[${index + 1}] ${item.title}\n${snippet}\n---\n`
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

    // Test Ollama connection first if using Ollama
    if (provider.provider === 'ollama') {
        const baseUrl = provider.apiUrl.replace('/api/chat', '')
        const testResult = await testOllamaConnection(baseUrl, provider.model)
        if (!testResult.success) {
            throw new Error(`Ollama 连接测试失败：${testResult.message}`)
        }
    }

    const context = formatArticlesForAI(items)
    
    // Get language code (first 2 characters)
    const langCode = language.substring(0, 2).toLowerCase()
    
    // Get prompts based on language, fallback to English
    const prompts = aiPrompts.digest as any
    const systemPrompt = prompts.systemPrompt[langCode] || prompts.systemPrompt.en
    const userPromptTemplate = prompts.userPromptTemplate[langCode] || prompts.userPromptTemplate.en
    
    // Replace placeholders
    const userPrompt = userPromptTemplate.replace('{articles}', context)

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

        let data: any
        
        // In Tauri, use proxy for Ollama to avoid CORS issues
        if (isTauri() && provider.provider === 'ollama') {
            const { proxyOllama } = await import('./tauri-bridge')
            data = await proxyOllama(provider.apiUrl, 'POST', requestBody)
        } else {
            // Direct fetch for cloud providers or browser/Electron
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

            data = await response.json()
        }

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
 * Requires AI service to be configured - no local fallback.
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

    // Must have AI provider configured
    if (!provider) {
        throw new Error("未配置 AI 服务。请在设置 > 集成 > AI 与推送服务中配置 OpenAI、NVIDIA、DeepSeek 或 Ollama。")
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

    // Limit to top items (optimized for small models)
    const maxItems = provider.provider === 'ollama' ? 8 : 15  // Ollama 小模型减少数量
    const selectedItems = items.slice(0, maxItems)

    // 3. Generate Content using AI
    const context = formatArticlesForAI(selectedItems)
    const isChinese = language.startsWith("zh")

    // 简化的提示词（减少处理时间）
    const systemPrompt = isChinese
        ? "你是新闻编辑。请将以下文章摘要整理成简洁的中文简报，包含：1.今日要点（3-5条最重要新闻）；2.分类摘要（科技、商业等）。每条新闻一句话总结。使用 Markdown 格式。"
        : "You are a news editor. Create a concise briefing from these article summaries. Include: 1. Key Points (3-5 most important); 2. Category Summary. One sentence per news item. Use Markdown."

    const userPrompt = `Articles:\n\n${context}\n\nGenerate briefing in ${isChinese ? "Chinese" : "English"}.`

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
            num_ctx: 4096,  // 限制上下文长度
            num_predict: 1024  // 限制输出长度
        }
    } : {
        model: provider.model,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
        ],
        temperature: 0.7
    }

    console.log(`[Digest] 准备生成摘要: ${selectedItems.length} 篇文章`)
    console.log(`[Digest] 输入大小: ~${Math.round(context.length / 4)} tokens`)

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    }

    // Add Authorization header for cloud providers (not Ollama)
    if (provider.apiKey) {
        headers["Authorization"] = `Bearer ${provider.apiKey}`
    }

    let chatData: any

    // In Tauri, use proxy for Ollama to avoid CORS issues
    console.log('[Digest] 准备调用 LLM API')
    console.log('[Digest] Provider:', provider.provider)
    console.log('[Digest] API URL:', provider.apiUrl)
    console.log('[Digest] Is Tauri:', isTauri())
    console.log('[Digest] Request body:', JSON.stringify(requestBody).substring(0, 200) + '...')

    if (isTauri() && provider.provider === 'ollama') {
        console.log('[Digest] 使用 Tauri 代理调用 Ollama')
        const { proxyOllama } = await import('./tauri-bridge')
        try {
            chatData = await proxyOllama(provider.apiUrl, 'POST', requestBody)
            console.log('[Digest] Ollama 代理调用成功')
            console.log('[Digest] 响应数据:', JSON.stringify(chatData).substring(0, 300) + '...')
        } catch (error: any) {
            console.error('[Digest] Ollama 代理调用失败:', error)
            // 提供更详细的错误提示
            let errorMsg = error.message || String(error)
            if (errorMsg.includes('timed out') || errorMsg.includes('timeout')) {
                errorMsg = `Ollama 请求超时。可能原因：
1. 模型 "${provider.model}" 正在首次加载，请耐心等待
2. Ollama 服务未启动，请检查：http://localhost:11434
3. 模型文件过大，建议先运行：ollama pull ${provider.model}

您可以先在浏览器测试：打开 http://localhost:11434 确认 Ollama 正在运行`
            } else if (errorMsg.includes('connection refused') || errorMsg.includes('connect')) {
                errorMsg = `无法连接到 Ollama 服务。
请检查：
1. Ollama 是否已启动（默认地址：http://localhost:11434）
2. 当前配置的地址：${provider.apiUrl}`
            }
            throw new Error(`Ollama 代理调用失败: ${errorMsg}`)
        }
    } else {
        console.log('[Digest] 使用直接 fetch 调用')
        // Direct fetch for cloud providers
        const chatResponse = await fetch(provider.apiUrl, {
            method: "POST",
            headers,
            body: JSON.stringify(requestBody)
        })

        if (!chatResponse.ok) {
            const error = await chatResponse.json()
            throw new Error(`LLM API error: ${error.error?.message || chatResponse.statusText}`)
        }

        chatData = await chatResponse.json()
        console.log('[Digest] 直接调用成功')
        console.log('[Digest] 响应数据:', JSON.stringify(chatData).substring(0, 300) + '...')
    }

    // Extract content based on provider
    const content = provider.provider === 'ollama'
        ? chatData.message?.content
        : chatData.choices[0].message.content

    if (!content) {
        throw new Error('LLM 未返回有效内容')
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
