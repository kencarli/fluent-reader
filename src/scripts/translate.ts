
import { IntegrationSettings } from "../schema-types"
import * as crypto from 'crypto'

// Translation services configuration
const MAX_RETRIES = 1  // Reduce retries for faster failover
const REQUEST_TIMEOUT = 8000 // 8 seconds - shorter timeout for faster failover

// Get translation settings from window
function getTranslationSettings(): IntegrationSettings {
    return window.settings.getIntegrationSettings() || {}
}

/**
 * Test Ollama connection and model availability for translation
 */
async function testOllamaConnection(apiUrl: string, model: string): Promise<{ success: boolean, message: string }> {
    try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000)

        const baseUrl = apiUrl.replace(/\/$/, '')
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
    } catch (error) {
        if (error.name === 'AbortError') {
            return { success: false, message: 'Ollama 连接超时，请检查网络和地址' }
        }
        return { success: false, message: `Ollama 连接失败：${error.message}` }
    }
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Fetch with timeout
 */
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = REQUEST_TIMEOUT): Promise<Response> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
        controller.abort()
    }, timeout)

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        })
        clearTimeout(timeoutId)
        return response
    } catch (error) {
        clearTimeout(timeoutId)
        if (error.name === 'AbortError') {
            throw new Error(`Request timeout after ${timeout}ms`)
        }
        throw error
    }
}

/**
 * Translate text with retry mechanism and failover
 * Optimized for browser environment: Baidu > Ollama > DeepL > LibreTranslate > MyMemory
 */
async function translateTextWithRetry(
    text: string,
    toLang: string = "zh-CN"
): Promise<string> {
    const settings = getTranslationSettings()
    const service = settings.translationService || "auto"
    let lastError: Error | null = null

    // Determine which services to try based on settings
    const servicesToTry: Array<{ name: string, translate: (text: string, toLang: string) => Promise<string>, priority: number }> = []

    // Baidu Translate API (Stable in China)
    if (service === "baidu" || service === "auto") {
        if (settings.baiduTranslateAppId && settings.baiduTranslateSecret) {
            servicesToTry.push({ name: 'baidu', translate: translateWithBaidu, priority: service === "baidu" ? 1 : 1 })
        }
    }

    // Ollama first if configured (local, fast, reliable)
    if (service === "ollama" || service === "auto") {
        if (settings.ollamaApiUrl && settings.ollamaModel) {
            servicesToTry.push({ name: 'ollama', translate: translateWithOllama, priority: service === "ollama" ? 1 : 2 })
        }
    }

    // DeepL Translate (High Quality, Available in China)
    if (service === "deepl" || service === "auto") {
        if (settings.deeplTranslateApiKey) {
            servicesToTry.push({ name: 'deepl', translate: translateWithDeepL, priority: service === "deepl" ? 1 : 3 })
        }
    }

    // LibreTranslate (Open Source, Self-Hosted)
    if (service === "libretranslate" || service === "auto") {
        if (settings.libretranslateApiUrl) {
            servicesToTry.push({ name: 'libretranslate', translate: translateWithLibreTranslate, priority: service === "libretranslate" ? 1 : 4 })
        }
    }

    // MyMemory (free, no key, but may be slow in China)
    if (service === "mymemory" || service === "auto") {
        servicesToTry.push({ name: 'mymemory', translate: translateWithMyMemory, priority: service === "mymemory" ? 1 : 5 })
    }

    // Sort by priority
    servicesToTry.sort((a, b) => a.priority - b.priority)

    console.log(`[Translate] Trying services in order:`, servicesToTry.map(s => s.name).join(', '))

    for (let serviceIndex = 0; serviceIndex < servicesToTry.length; serviceIndex++) {
        const svc = servicesToTry[serviceIndex]
        console.log(`[Translate] Attempting: ${svc.name}`)

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                // Add delay between retries (exponential backoff)
                if (attempt > 0) {
                    await sleep(Math.pow(2, attempt) * 500) // Shorter delay
                }

                const result = await svc.translate(text, toLang)
                if (result) {
                    console.log(`[Translate] Success with: ${svc.name}`)
                    return result
                }
            } catch (error) {
                lastError = error instanceof Error ? error : new Error('Unknown error')

                // Log all errors for debugging
                console.warn(`[Translate] Service ${svc.name} failed:`, lastError.message)

                // If this service failed completely, try the next one
                if (attempt === MAX_RETRIES) {
                    break
                }
            }
        }
    }

    // All services failed - log detailed error
    console.error('[Translate] All services failed. Last error:', lastError?.message)

    // Return original text when translation fails
    return text
}

/**
 * LibreTranslate API (Open Source, Self-Hosted, Free)
 * Can be self-hosted or use public instances
 * https://libretranslate.com/
 */
async function translateWithLibreTranslate(text: string, toLang: string): Promise<string> {
    const settings = getTranslationSettings()
    const apiUrl = settings.libretranslateApiUrl
    const apiKey = settings.libretranslateApiKey

    if (!apiUrl) {
        throw new Error("LibreTranslate API URL not configured")
    }

    // Convert language code
    const langMap: Record<string, string> = {
        'zh-CN': 'zh',
        'zh-TW': 'zh',
        'en-US': 'en',
        'ja': 'ja',
        'ko': 'ko',
        'fr': 'fr',
        'es': 'es',
        'de': 'de',
        'ru': 'ru',
    }
    const targetLang = langMap[toLang] || 'zh'

    // Normalize API URL (remove trailing slash)
    const baseUrl = apiUrl.replace(/\/$/, '')
    const url = `${baseUrl}/translate`

    const requestBody: any = {
        q: text,
        source: 'auto',
        target: targetLang,
        format: 'text'
    }

    // Add API key if configured (some instances require it)
    if (apiKey) {
        requestBody.api_key = apiKey
    }

    const response = await fetchWithTimeout(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
    }, 15000)

    if (!response.ok) {
        const error = await response.text()
        throw new Error(`LibreTranslate API failed: ${error}`)
    }

    const data = await response.json()
    if (data.translatedText) {
        return data.translatedText
    }

    throw new Error('LibreTranslate API returned empty result')
}

/**
 * DeepL Translate API (High Quality, Available in China)
 * Requires API key from https://www.deepl.com/pro-api
 * Free tier: 500,000 characters/month
 */
async function translateWithDeepL(text: string, toLang: string): Promise<string> {
    const settings = getTranslationSettings()
    const apiKey = settings.deeplTranslateApiKey

    if (!apiKey) {
        throw new Error("DeepL API key not configured")
    }

    // Convert language code
    const langMap: Record<string, string> = {
        'zh-CN': 'ZH',
        'zh-TW': 'ZH',
        'en-US': 'EN',
        'ja': 'JA',
        'ko': 'KO',
        'fr': 'FR',
        'es': 'ES',
        'de': 'DE',
        'ru': 'RU',
    }
    const targetLang = langMap[toLang] || 'ZH'

    const url = 'https://api-free.deepl.com/v2/translate'

    const response = await fetchWithTimeout(url, {
        method: 'POST',
        headers: {
            'Authorization': `DeepL-Auth-Key ${apiKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `text=${encodeURIComponent(text)}&target_lang=${targetLang}&source_lang=EN`
    }, 15000)

    if (!response.ok) {
        const error = await response.text()
        throw new Error(`DeepL API failed: ${error}`)
    }

    const data = await response.json()
    if (data.translations && data.translations.length > 0) {
        return data.translations[0].text
    }

    throw new Error('DeepL API returned empty result')
}

/**
 * MyMemory Translate API (Free, No Key Required)
 * Uses api.mymemory.translated.net - free translation service
 * Works in browser, no CORS issues
 * Limitations: max 500 chars per request, no auto source language
 */
async function translateWithMyMemory(text: string, toLang: string): Promise<string> {
    // Convert language code
    const langMap: Record<string, string> = {
        'zh-CN': 'zh-CN',
        'zh-TW': 'zh-TW',
        'en-US': 'en',
        'ja': 'ja',
        'ko': 'ko',
        'fr': 'fr',
        'es': 'es',
        'de': 'de',
        'ru': 'ru',
    }
    const targetLang = langMap[toLang] || 'zh-CN'
    
    // MyMemory doesn't support 'auto', detect if text is English
    // Simple heuristic: if text contains mostly ASCII chars, assume English
    const isEnglish = /^[ -~\n\r\t]+$/.test(text.substring(0, 100))
    const fromLang = isEnglish ? 'en' : 'auto'

    // MyMemory has a 500 character limit per request
    // Split text into chunks if needed
    const MAX_CHUNK_SIZE = 450 // Conservative limit
    const chunks: string[] = []
    
    if (text.length <= MAX_CHUNK_SIZE) {
        chunks.push(text)
    } else {
        // Split by sentences first
        const sentences = text.match(/[^.!?]+[.!?]+/g) || [text]
        let currentChunk = ''
        
        for (const sentence of sentences) {
            if ((currentChunk + sentence).length > MAX_CHUNK_SIZE && currentChunk.length > 0) {
                chunks.push(currentChunk.trim())
                currentChunk = sentence
            } else {
                currentChunk += sentence
            }
        }
        if (currentChunk.trim().length > 0) {
            chunks.push(currentChunk.trim())
        }
    }

    // Translate each chunk
    const translatedChunks: string[] = []
    
    for (const chunk of chunks) {
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=${fromLang}|${targetLang}`

        console.log(`[MyMemory] Requesting chunk (${chunk.length} chars)`)

        let response
        try {
            response = await fetchWithTimeout(url, {}, 10000)
        } catch (fetchError) {
            console.error('[MyMemory] Fetch error:', fetchError.message)
            throw new Error(`MyMemory network error: ${fetchError.message}. This may be due to CORS restrictions or network issues.`)
        }
        
        if (!response.ok) {
            console.error('[MyMemory] Response not OK:', response.status, response.statusText)
            throw new Error(`MyMemory API failed: ${response.status} ${response.statusText}`)
        }

        let data
        try {
            data = await response.json()
        } catch (jsonError) {
            console.error('[MyMemory] JSON parse error:', jsonError.message)
            throw new Error('MyMemory returned invalid response')
        }

        if (data.responseStatus === 200 && data.responseData?.translatedText) {
            translatedChunks.push(data.responseData.translatedText)
        } else {
            console.error('[MyMemory] Empty result:', JSON.stringify(data).substring(0, 300))
            throw new Error(`MyMemory API returned empty result. Status: ${data.responseStatus}, Details: ${data.responseDetails || 'none'}`)
        }
    }

    return translatedChunks.join(' ')
}

/**
 * Baidu Translate API (Official)
 * Requires API key from https://fanyi-api.baidu.com/
 */
async function translateWithBaidu(text: string, toLang: string): Promise<string> {
    const settings = getTranslationSettings()
    const appId = settings.baiduTranslateAppId
    const secret = settings.baiduTranslateSecret
    
    if (!appId || !secret) {
        throw new Error("Baidu Translate API not configured")
    }
    
    // Convert language code
    const langMap: Record<string, string> = {
        'zh-CN': 'zh',
        'zh-TW': 'cht',
        'en-US': 'en',
        'ja': 'jp',
        'ko': 'kor',
        'fr': 'fra',
        'es': 'spa',
        'de': 'de',
        'ru': 'ru',
    }
    const targetLang = langMap[toLang] || 'zh'
    
    const salt = Date.now()
    const signStr = appId + text + salt + secret
    const sign = crypto.createHash('md5').update(signStr).digest('hex')
    
    const url = `https://fanyi-api.baidu.com/api/translate/v2`
    
    const response = await fetchWithTimeout(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `appid=${appId}&q=${encodeURIComponent(text)}&from=auto&to=${targetLang}&salt=${salt}&sign=${sign}`
    }, 15000)
    
    if (!response.ok) {
        const error = await response.text()
        throw new Error(`Baidu Translate failed: ${error}`)
    }
    
    const data = await response.json()
    if (data.trans_result) {
        return data.trans_result.map((item: any) => item.dst).join('\n')
    }
    if (data.error_code) {
        throw new Error(`Baidu API Error ${data.error_code}: ${data.error_msg}`)
    }
    return text
}

/**
 * Ollama Local LLM Translation
 * Uses local Ollama API for translation
 */
async function translateWithOllama(text: string, toLang: string): Promise<string> {
    const settings = getTranslationSettings()
    const apiUrl = settings.ollamaApiUrl
    const model = settings.ollamaModel

    if (!apiUrl || !model) {
        throw new Error("Ollama API URL or Model not configured. Please check Settings > Integrations > Translation Services")
    }

    // Test Ollama connection first
    const baseUrl = apiUrl.replace(/\/$/, '')
    const testResult = await testOllamaConnection(baseUrl, model)
    if (!testResult.success) {
        throw new Error(`Ollama 连接测试失败：${testResult.message}`)
    }

    // Normalize API URL (remove trailing slash if present)
    const url = `${baseUrl}/api/generate`

    // Convert language code to readable name
    const langMap: Record<string, string> = {
        'zh-CN': 'Chinese (Simplified)',
        'zh-TW': 'Chinese (Traditional)',
        'en-US': 'English',
        'ja': 'Japanese',
        'ko': 'Korean',
        'fr': 'French',
        'es': 'Spanish',
        'de': 'German',
        'ru': 'Russian',
    }
    const targetLangName = langMap[toLang] || 'Chinese'

    // Use concise prompt for speed
    const systemPrompt = `Translate to ${targetLangName}. Output ONLY ${targetLangName}, no English:

${text}

${targetLangName}:`

    const startTime = Date.now()

    let response
    try {
        const requestBody = {
            model: model,
            prompt: systemPrompt,
            stream: false,
            options: {
                temperature: 0.001,  // Near deterministic for speed
                top_p: 0.3,
                top_k: 10,
                num_predict: 1024,  // Shorter output = faster
            }
        }

        response = await fetchWithTimeout(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify(requestBody)
        }, 180000) // 3 minutes timeout
    } catch (error) {
        const duration = ((Date.now() - startTime) / 1000).toFixed(1)
        console.error(`[Ollama Translate] Fetch error after ${duration}s:`, error)
        if (error.message.includes('timeout')) {
            throw new Error(`Ollama request timeout after ${duration}s. This is likely a network issue. Please check: 1) Proxy settings in app, 2) Firewall, 3) Network connection to ${apiUrl}`)
        }
        throw new Error(`Ollama fetch failed: ${error.message}. Please check: 1) Ollama server at ${apiUrl}, 2) Network, 3) Firewall`)
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1)

    if (!response.ok) {
        const error = await response.text()
        throw new Error(`Ollama Translate failed (${response.status}): ${error}`)
    }

    const data = await response.json()

    if (data.response) {
        const duration = ((Date.now() - startTime) / 1000).toFixed(1)

        let translation = data.response.trim()

        // Post-process: detect and remove duplicate English paragraphs (bilingual output)
        const originalTranslation = translation
        
        // Split into lines/paragraphs
        const lines = translation.split('\n').filter(line => line.trim().length > 0)
        
        if (lines.length > 1) {
            // Check for bilingual pattern: alternating English and Chinese paragraphs
            let englishLines = 0
            let chineseLines = 0
            let mixedLines = 0
            
            const chinesePattern = /[\u4e00-\u9fff]/
            
            for (const line of lines) {
                const hasChinese = chinesePattern.test(line)
                const hasEnglish = /[a-zA-Z]/.test(line)
                
                if (hasChinese && !hasEnglish) {
                    chineseLines++
                } else if (hasEnglish && !hasChinese) {
                    englishLines++
                } else if (hasChinese && hasEnglish) {
                    mixedLines++
                }
            }
            
            const totalLines = lines.length
            const englishRatio = englishLines / totalLines
            const chineseRatio = chineseLines / totalLines
            
            console.log(`[Ollama Translate] Line analysis: CN=${chineseLines}, EN=${englishLines}, Mixed=${mixedLines}`)
            
            // Filter out pure English lines if we have significant English content
            if (englishLines >= 2 && englishRatio > 0.2) {
                console.log(`[Ollama Translate] Detected bilingual output (${(englishRatio * 100).toFixed(0)}% English lines), filtering...`)
                
                // Keep only Chinese and mixed lines, remove pure English lines
                const filteredLines = lines.filter(line => {
                    const hasChinese = chinesePattern.test(line)
                    // Keep if has Chinese (pure Chinese or mixed)
                    return hasChinese
                })
                
                if (filteredLines.length > 0) {
                    translation = filteredLines.join('\n')
                    console.log(`[Ollama Translate] ✓ Filtered: ${lines.length} → ${filteredLines.length} lines`)
                }
            }
        }
        
        // Remove model notes/comments (e.g., "Note: The text provided is...")
        const notePatterns = [
            /^Note:\s*/i,
            /^The text provided/i,
            /^This text is/i,
            /^Translation:\s*/i,
            /^Here is the/i,
        ]
        
        for (const pattern of notePatterns) {
            if (pattern.test(translation)) {
                console.log('[Ollama Translate] Removing model note...')
                translation = translation.replace(pattern, '')
            }
        }
        
        // Remove trailing English-only paragraphs
        const finalLines = translation.split('\n')
        const cleanedLines: string[] = []
        let inEnglishSection = false
        
        const chinesePattern = /[\u4e00-\u9fff]/
        
        for (let i = finalLines.length - 1; i >= 0; i--) {
            const line = finalLines[i]
            const hasChinese = chinesePattern.test(line)
            const hasEnglish = /[a-zA-Z]/.test(line)
            
            if (hasEnglish && !hasChinese && line.trim().length > 20) {
                inEnglishSection = true
            } else if (hasChinese) {
                inEnglishSection = false
                cleanedLines.unshift(line)
            } else {
                cleanedLines.unshift(line)
            }
        }
        
        if (cleanedLines.length > 0 && cleanedLines.length < finalLines.length) {
            translation = cleanedLines.join('\n')
            console.log(`[Ollama Translate] ✓ Removed trailing English: ${finalLines.length} → ${cleanedLines.length} lines`)
        }
        
        // Final check: ensure we have some Chinese content
        const hasChinese = /[\u4e00-\u9fff]/.test(translation)
        if (!hasChinese) {
            console.warn('[Ollama Translate] ✗ No Chinese in final output, using original text')
            translation = text
        }
        
        console.log(`[Ollama Translate] ✓ Final output: ${translation.length} chars`)
        return translation
    }
    return text
}

export async function translateText(
    text: string,
    toLang: string = "zh-CN"
): Promise<string> {
    try {
        return await translateTextWithRetry(text, toLang)
    } catch (error) {
        console.error("Translation error:", error)
        return text // Return original text on error
    }
}

export async function translateHtml(html: string, toLang: string = "zh-CN"): Promise<string> {
    if (!html) return ""
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, "text/html")
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, null)
    const nodes: Node[] = []
    let node: Node
    while (node = walker.nextNode()) {
        if (node.nodeValue && node.nodeValue.trim().length > 0) {
            nodes.push(node)
        }
    }

    if (nodes.length === 0) return html

    // Batching
    const chunks: Node[][] = []
    let currentChunk: Node[] = []
    let currentLength = 0
    const MAX_LEN = 1500 // Conservative limit

    for (const n of nodes) {
        const len = n.nodeValue!.length
        // If a single node is too large, we might skip or truncate? 
        // For now, include it but force chunk break after
        if (currentLength + len > MAX_LEN && currentChunk.length > 0) {
            chunks.push(currentChunk)
            currentChunk = []
            currentLength = 0
        }
        currentChunk.push(n)
        currentLength += len
    }
    if (currentChunk.length > 0) chunks.push(currentChunk)

    for (const chunk of chunks) {
        // Use a delimiter that is unlikely to be messed up. 
        // Although Google Translate usually preserves newlines.
        const delimiter = "\n\n"
        const textToTranslate = chunk.map(n => n.nodeValue).join(delimiter)
        try {
            const translated = await translateText(textToTranslate, toLang)
            const translatedParts = translated.split(delimiter)

            // Assign back. If count mismatch, just try best effort.
            for (let i = 0; i < chunk.length && i < translatedParts.length; i++) {
                chunk[i].nodeValue = translatedParts[i]
            }
        } catch (e) {
            console.error("Chunk translation failed", e)
        }
    }

    return doc.body.innerHTML
}

/**
 * Batch translate titles
 * @param titles - Array of titles to translate
 * @param onProgress - Progress callback
 * @returns Array of translated titles
 */
export async function translateTitles(
    titles: string[],
    onProgress?: (completed: number, total: number) => void
): Promise<string[]> {
    const translatedTitles: string[] = []
    let allFailed = true
    let anyTranslated = false

    for (let i = 0; i < titles.length; i++) {
        try {
            const translated = await translateText(titles[i], "zh-CN")
            // Check if translation actually happened (not just returned original)
            if (translated !== titles[i]) {
                anyTranslated = true
                allFailed = false
            }
            translatedTitles.push(translated)
        } catch (error) {
            console.error(`Failed to translate title: ${titles[i]}`, error)
            translatedTitles.push(titles[i]) // Keep original on error
        }

        if (onProgress) {
            onProgress(i + 1, titles.length)
        }

        // Small delay between translations
        await sleep(50)
    }

    // If all translations failed, throw an error to show proper message
    if (allFailed && !anyTranslated) {
        throw new Error('所有翻译服务都不可用或翻译失败。请检查：\n1. 翻译服务配置是否正确\n2. 网络连接是否正常\n3. Ollama 服务是否正在运行')
    }

    return translatedTitles
}
