
import { IntegrationSettings } from "../schema-types"
import * as crypto from 'crypto'

// Translation services configuration
const MAX_RETRIES = 1  // Reduce retries for faster failover
const REQUEST_TIMEOUT = 8000 // 8 seconds - shorter timeout for faster failover
const GOOGLE_TIMEOUT = 5000 // 5 seconds for Google (often fails quickly in China)

// Get translation settings from window
function getTranslationSettings(): IntegrationSettings {
    return window.settings.getIntegrationSettings() || {}
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
 */
async function translateTextWithRetry(
    text: string,
    toLang: string = "zh-CN"
): Promise<string> {
    const settings = getTranslationSettings()
    const service = settings.translationService || "auto"
    let lastError: Error | null = null

    // Determine which services to try based on settings
    // For users in China, Baidu/Youdao/Ollama are more reliable
    const servicesToTry: Array<{ name: string, translate: (text: string, toLang: string) => Promise<string>, priority: number }> = []

    if (service === "baidu" || service === "auto") {
        if (settings.baiduTranslateAppId && settings.baiduTranslateSecret) {
            servicesToTry.push({ name: 'baidu', translate: translateWithBaidu, priority: service === "baidu" ? 1 : 2 })
        }
    }
    if (service === "youdao" || service === "auto") {
        if (settings.youdaoTranslateAppId && settings.youdaoTranslateSecret) {
            servicesToTry.push({ name: 'youdao', translate: translateWithYoudao, priority: service === "youdao" ? 1 : 2 })
        }
    }
    if (service === "ollama" || service === "auto") {
        if (settings.ollamaApiUrl && settings.ollamaModel) {
            servicesToTry.push({ name: 'ollama', translate: translateWithOllama, priority: service === "ollama" ? 1 : 3 })
        }
    }
    if (service === "google" || service === "auto") {
        // Google has lowest priority in China (often unavailable)
        servicesToTry.push({ name: 'google', translate: translateWithGoogle, priority: service === "google" ? 2 : 4 })
    }

    // Sort by priority
    servicesToTry.sort((a, b) => a.priority - b.priority)

    // If no configured services available, fall back to Google
    if (servicesToTry.length === 0) {
        servicesToTry.push({ name: 'google', translate: translateWithGoogle, priority: 1 })
    }
    
    for (let serviceIndex = 0; serviceIndex < servicesToTry.length; serviceIndex++) {
        const svc = servicesToTry[serviceIndex]

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                // Add delay between retries (exponential backoff)
                if (attempt > 0) {
                    await sleep(Math.pow(2, attempt) * 500) // Shorter delay
                }

                const result = await svc.translate(text, toLang)
                if (result) {
                    return result
                }
            } catch (error) {
                lastError = error instanceof Error ? error : new Error('Unknown error')
                
                // Only log non-network errors (network errors are expected in China for Google)
                if (!lastError.message.includes('Failed to fetch') && 
                    !lastError.message.includes('ERR_CONNECTION') &&
                    !lastError.message.includes('timeout') &&
                    !lastError.message.includes('abort')) {
                    console.warn(`Translation service ${svc.name} failed:`, lastError.message)
                }

                // If this service failed completely, try the next one
                if (attempt === MAX_RETRIES) {
                    break
                }
            }
        }
    }

    // All services failed - only log if we have a meaningful error
    if (lastError && 
        !lastError.message.includes('Failed to fetch') && 
        !lastError.message.includes('ERR_CONNECTION') &&
        !lastError.message.includes('timeout') &&
        !lastError.message.includes('abort')) {
        console.warn('Translation unavailable - services not configured or network unreachable')
    }
    
    // Return original text when translation fails
    return text
}

/**
 * Google Translate (unofficial API)
 * Note: This may not work in mainland China without proxy
 */
async function translateWithGoogle(text: string, toLang: string): Promise<string> {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${toLang}&dt=t&q=${encodeURIComponent(text)}`
    
    // Use shorter timeout for Google since it often fails in China
    const response = await fetchWithTimeout(url, {}, GOOGLE_TIMEOUT)
    if (!response.ok) {
        throw new Error(`Google Translate failed: ${response.statusText}`)
    }
    
    const data = await response.json()
    if (data && data[0]) {
        return data[0].map((item: any) => item[0]).join("")
    }
    return text
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
 * Youdao Translate API (Official)
 * Requires API key from https://ai.youdao.com/
 */
async function translateWithYoudao(text: string, toLang: string): Promise<string> {
    const settings = getTranslationSettings()
    const appId = settings.youdaoTranslateAppId
    const secret = settings.youdaoTranslateSecret

    if (!appId || !secret) {
        throw new Error("Youdao Translate API not configured")
    }

    // Convert language code
    const langMap: Record<string, string> = {
        'zh-CN': 'zh-CHS',
        'zh-TW': 'zh-CHT',
        'en-US': 'en',
        'ja': 'ja',
        'ko': 'ko',
        'fr': 'fr',
        'es': 'es',
        'de': 'de',
        'ru': 'ru',
    }
    const targetLang = langMap[toLang] || 'zh-CHS'
    const fromLang = 'auto'

    const salt = Date.now()
    const signStr = appId + text + salt + secret
    const sign = crypto.createHash('sha256').update(signStr).digest('hex')

    const url = `https://openapi.youdao.com/api`

    const response = await fetchWithTimeout(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `from=${fromLang}&to=${targetLang}&appKey=${appId}&q=${encodeURIComponent(text)}&salt=${salt}&sign=${sign}&signType=v3`
    }, 15000)

    if (!response.ok) {
        const error = await response.text()
        throw new Error(`Youdao Translate failed: ${error}`)
    }

    const data = await response.json()
    if (data.translation) {
        return data.translation.join('\n')
    }
    if (data.errorCode && data.errorCode !== '0') {
        throw new Error(`Youdao API Error ${data.errorCode}`)
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

    // Normalize API URL (remove trailing slash if present)
    const baseUrl = apiUrl.replace(/\/$/, '')
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
    
    for (let i = 0; i < titles.length; i++) {
        try {
            const translated = await translateText(titles[i], "zh-CN")
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
    
    return translatedTitles
}
