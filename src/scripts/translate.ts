
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
    const timeoutId = setTimeout(() => controller.abort(), timeout)
    
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        })
        clearTimeout(timeoutId)
        return response
    } catch (error) {
        clearTimeout(timeoutId)
        throw error
    }
}

/**
 * Translate text with retry mechanism
 */
async function translateTextWithRetry(
    text: string,
    toLang: string = "zh-CN"
): Promise<string> {
    const settings = getTranslationSettings()
    const service = settings.translationService || "auto"
    let lastError: Error | null = null

    // Determine which services to try based on settings
    // For users in China, Baidu/Youdao are more reliable
    const servicesToTry: Array<{ name: string, translate: (text: string, toLang: string) => Promise<string>, priority: number }> = []

    if (service === "google" || service === "auto") {
        // Google has lower priority in China
        servicesToTry.push({ name: 'google', translate: translateWithGoogle, priority: service === "google" ? 1 : 3 })
    }
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
            servicesToTry.push({ name: 'ollama', translate: (t) => translateWithOllama(t, toLang), priority: service === "ollama" ? 1 : 2 })
        }
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
                console.warn(`Translation service ${svc.name} (attempt ${attempt + 1}) failed:`, lastError.message)

                // If this service failed completely, try the next one
                if (attempt === MAX_RETRIES) {
                    break
                }
            }
        }
    }

    // All services failed, return original text
    console.error('All translation services failed. Last error:', lastError)
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
    
    // Baidu API signature method
    // sign = MD5(appid + q + salt + key)
    // For long text, truncate: first 10 + length + last 10
    const truncate = (str: string) => {
        if (str.length <= 20) return str
        return str.substring(0, 10) + str.length + str.substring(str.length - 10)
    }
    
    const truncatedText = truncate(text)
    const signStr = appId + truncatedText + salt + secret
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
    let appId = settings.youdaoTranslateAppId
    let secret = settings.youdaoTranslateSecret

    if (!appId || !secret) {
        throw new Error("Youdao Translate API not configured")
    }
    
    // Clean up appKey and secret - remove any whitespace
    appId = appId.trim()
    secret = secret.trim()
    
    // Validate key format
    if (appId.length !== 16) {
        console.warn('Youdao appId length is not 16, may be incorrect')
    }
    if (secret.length !== 32) {
        console.warn('Youdao secret length is not 32, may be incorrect. Youdao secret should be 32 characters.')
    }
    // Check if secret looks like appId (common mistake)
    if (secret.length === 16) {
        throw new Error('Youdao secret appears to be appId (16 chars). Please use the 32-character secret key (密钥), not appId.')
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

    // Youdao API v3 requires:
    // salt: any string (we use timestamp + random)
    // curtime: current timestamp in seconds
    const now = Date.now()
    const salt = now + '_' + Math.random().toString(36).substring(2, 8)
    const curtime = Math.floor(now / 1000)

    // Youdao API v3 signature method
    // sign = SHA256(appKey + q + salt + key)
    // Note: Use secret key (密钥), not appSecret
    // If text length > 20, use: first 10 + length + last 10 chars
    const truncate = (str: string) => {
        if (str.length <= 20) return str
        return str.substring(0, 10) + str.length + str.substring(str.length - 10)
    }

    const truncatedText = truncate(text)
    // Sign string: appKey + q(truncated) + salt + secret
    const signStr = appId + truncatedText + salt + secret
    const sign = crypto.createHash('sha256').update(signStr, 'utf8').digest('hex')

    const url = `https://openapi.youdao.com/api`

    const params = new URLSearchParams()
    params.append('from', fromLang)
    params.append('to', targetLang)
    params.append('appKey', appId)
    params.append('q', text)
    params.append('salt', salt)
    params.append('sign', sign)
    params.append('signType', 'v3')
    params.append('curtime', curtime.toString())

    const response = await fetchWithTimeout(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString()
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
        // Log full error details
        console.error('Youdao API error details:', {
            errorCode: data.errorCode,
            errorMsg: data.error_msg,
            query: data.query
        })
        throw new Error(`Youdao API Error ${data.errorCode}: ${data.error_msg || 'Unknown error'}`)
    }
    return text
}

/**
 * Ollama Local LLM Translation
 * Uses Ollama API for translation with local models
 */
async function translateWithOllama(text: string, toLang: string): Promise<string> {
    const settings = getTranslationSettings()
    const { ollamaApiUrl, ollamaModel } = settings

    if (!ollamaApiUrl || !ollamaModel) {
        throw new Error("Ollama API not configured")
    }

    // Language name mapping
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
    const targetLang = langMap[toLang] || 'Chinese'

    // Build prompt for translation - use a more direct format
    const prompt = `Translate this text to ${targetLang}:

${text}

---
Translation:`

    const url = ollamaApiUrl.replace(/\/$/, '') + '/api/generate'

    const response = await fetchWithTimeout(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: ollamaModel,
            prompt: prompt,
            stream: false,
            options: {
                temperature: 0.3,
                top_p: 0.9,
            }
        })
    }, 30000) // Longer timeout for LLM

    if (!response.ok) {
        const error = await response.text()
        throw new Error(`Ollama API failed: ${response.statusText} - ${error}`)
    }

    const data = await response.json()
    if (data.response) {
        let result = data.response.trim()
        // Post-process to remove instruction patterns
        result = extractTargetLanguageOnly(result, toLang)
        return result
    }

    throw new Error('Ollama API returned empty response')
}

/**
 * Extract only the target language text from potentially bilingual content
 * This helps when translation services return both original and translated text
 * or when LLM outputs instructions instead of translation
 */
function extractTargetLanguageOnly(text: string, toLang: string): string {
    // If text is empty or very short, return as-is
    if (!text || text.length < 10) {
        return text
    }
    
    const originalText = text
    
    // Remove common LLM instruction patterns that should not appear in output
    const instructionPatterns = [
        /重要规则 [:：\s]*[\s\S]*?(?=^[^-]|\n\n|$)/im,  // "重要规则:" patterns
        /IMPORTANT RULES?[:：\s]*[\s\S]*?(?=^[^-]|\n\n|$)/i,  // "IMPORTANT RULES:" patterns
        /翻译以下文本 [:：\s]*[\s\S]*?(?=^[^-]|\n\n|$)/im,
        /Translate [this|the|the following][\s\S]*?[:：\s]*[\s\S]*?(?=^[^-]|\n\n|$)/i,
        /^[-*•]\s*(?:输出 | 不要 | 不 | 仅 | 只 | 返回|Output|Do not|Don't|Only|Just|Return).*/gim,  // Bullet point instructions
        /^---+\s*$/gm,  // Separator lines
        /^Translation:?\s*$/im,  // "Translation:" label alone
    ]
    
    for (const pattern of instructionPatterns) {
        text = text.replace(pattern, '')
    }
    
    // Trim the result
    text = text.trim()
    
    // If text became empty after cleaning, return original
    if (!text || text.length < 10) {
        return originalText
    }
    
    // Detect if text contains mixed languages
    const chinesePattern = /[\u4e00-\u9fa5]/g
    const englishPattern = /[a-zA-Z]{3,}/g
    const hasChinese = chinesePattern.test(text)
    const hasEnglish = englishPattern.test(text)
    
    // If target is Chinese and text contains both Chinese and English
    if ((toLang === 'zh-CN' || toLang === 'zh-TW') && hasChinese && hasEnglish) {
        // Try to extract Chinese-heavy portions
        const lines = text.split('\n')
        const chineseLines = lines.filter(line => {
            const chineseChars = line.match(chinesePattern)
            const englishWords = line.match(englishPattern)
            const chineseCount = chineseChars ? chineseChars.length : 0
            const englishCount = englishWords ? englishWords.length : 0
            // Keep lines where Chinese characters dominate or are equal
            return chineseCount >= englishCount
        })
        
        // If we found Chinese-only lines, use them
        if (chineseLines.length > 0 && chineseLines.length >= lines.length / 2) {
            return chineseLines.join('\n')
        }
        
        // Otherwise, try to extract Chinese portions from each line
        const extractedLines = lines.map(line => {
            const chineseMatch = line.match(/[\u4e00-\u9fa5，。！？、；：""''（）【】《》\s]+/g)
            if (chineseMatch) {
                const extracted = chineseMatch.join('')
                // Only return if it has significant Chinese content
                if (extracted.match(chinesePattern) && extracted.length >= line.length / 3) {
                    return extracted.trim()
                }
            }
            return line
        }).filter(line => line.length > 0)
        
        if (extractedLines.length > 0) {
            return extractedLines.join('\n')
        }
    }
    
    // For other languages or if extraction failed, return original
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

export async function translateHtml(
    html: string, 
    toLang: string = "zh-CN",
    onProgress?: (current: number, total: number) => void
): Promise<string> {
    if (!html) return ""

    // Get translation mode from settings
    const settings = getTranslationSettings()
    const translationMode = settings.translationMode || "full"

    const parser = new DOMParser()
    const doc = parser.parseFromString(html, "text/html")

    // Clean up any previous translation artifacts (bilingual mode spans)
    // Find all spans that contain .original-text or .translated-text and replace with plain text
    const allSpans = doc.querySelectorAll('span')
    allSpans.forEach(span => {
        if (span.querySelector('.original-text, .translated-text')) {
            // For bilingual mode, only keep the original text
            // For full translation mode that was previously bilingual, we need to re-translate
            const originalTextDiv = span.querySelector('.original-text')
            const textToKeep = originalTextDiv ? originalTextDiv.textContent : (span.textContent || '')
            const textNode = document.createTextNode(textToKeep)
            span.parentNode?.replaceChild(textNode, span)
        }
    })

    // Skip script, style, and other non-content elements
    const skipTags = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'SVG', 'CODE', 'PRE']
    
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, null)
    const nodes: Node[] = []
    let node: Node
    while (node = walker.nextNode()) {
        if (node.nodeValue && node.nodeValue.trim().length > 0) {
            // Skip text nodes inside non-content elements
            const parentElement = node.parentElement
            if (parentElement && skipTags.includes(parentElement.tagName)) {
                continue
            }
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

    // Translate chunks with progress
    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]
        // Use a delimiter that is unlikely to be messed up.
        // Although Google Translate usually preserves newlines.
        const delimiter = "\n\n"
        const textToTranslate = chunk.map(n => n.nodeValue).join(delimiter)
        try {
            let translated = await translateText(textToTranslate, toLang)
            
            // In full mode, if the translation appears to contain bilingual content,
            // try to extract only the target language parts
            if (translationMode === 'full') {
                translated = extractTargetLanguageOnly(translated, toLang)
            }
            
            const translatedParts = translated.split(delimiter)

            // Assign back based on translation mode
            if (translationMode === "bilingual") {
                // For bilingual mode, show both original and translation
                for (let j = 0; j < chunk.length && j < translatedParts.length; j++) {
                    const originalText = chunk[j].nodeValue
                    const translatedText = translatedParts[j]
                    // Create a span with both original and translation
                    const span = doc.createElement('span')
                    span.innerHTML = `<div class="original-text">${originalText}</div><div class="translated-text">${translatedText}</div>`
                    chunk[j].parentNode?.replaceChild(span, chunk[j])
                }
            } else {
                // For full translation mode, replace original text
                // If translatedParts count doesn't match chunk count, we need to handle it carefully
                if (translatedParts.length === chunk.length) {
                    // Perfect match, replace each node
                    for (let j = 0; j < chunk.length; j++) {
                        chunk[j].nodeValue = translatedParts[j]
                    }
                } else if (translatedParts.length === 1 && chunk.length > 1) {
                    // Translation merged all text into one part, apply to first node and remove others
                    chunk[0].nodeValue = translatedParts[0]
                    for (let j = 1; j < chunk.length; j++) {
                        chunk[j].nodeValue = ''
                    }
                } else {
                    // Mismatch: apply as many as we have, fill rest with empty or repeat last
                    for (let j = 0; j < chunk.length; j++) {
                        if (j < translatedParts.length) {
                            chunk[j].nodeValue = translatedParts[j]
                        } else {
                            // If we run out of translated parts, use the last available one or empty
                            chunk[j].nodeValue = translatedParts[translatedParts.length - 1] || ''
                        }
                    }
                }
            }
        } catch (e) {
            console.error("Chunk translation failed", e)
        }

        // Report progress
        if (onProgress) {
            onProgress(i + 1, chunks.length)
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
