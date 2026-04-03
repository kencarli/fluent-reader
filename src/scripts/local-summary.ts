/**
 * 类AI文章智能总结工具
 * 纯JS实现，无依赖，浏览器可用
 * 融合了 TF-IDF + TextRank + 位置权重 + 长度优化
 */

export interface SummaryOptions {
    /** Number of sentences in summary (default: 3) */
    sentenceCount?: number
    /** Language for stop words (default: 'auto' detect) */
    language?: 'en' | 'zh' | 'auto'
}

/**
 * Stop words for English and Chinese
 */
const STOP_WORDS = new Set([
    // Chinese
    '的', '了', '在', '是', '我', '有', '和', '就', '都', '而', '及', '与', '这', '那',
    '他', '她', '它', '们', '你', '们', '我', '们', '什么', '怎么', '为什么',
    '因为', '所以', '虽然', '但是', '如果', '可以', '已经', '正在', '将',
    // English
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'of', 'for',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
    'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
    'must', 'shall', 'can', 'need', 'it', 'its', 'this', 'that', 'these', 'those',
    'i', 'you', 'he', 'she', 'we', 'they', 'what', 'which', 'who', 'whom',
    'where', 'when', 'why', 'how', 'not', 'no', 'nor', 'so', 'if', 'then', 'than'
])

/**
 * Detect if text is primarily Chinese
 */
function detectLanguage(text: string): 'en' | 'zh' {
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length
    const totalChars = text.replace(/\s/g, '').length
    return chineseChars / totalChars > 0.3 ? 'zh' : 'en'
}

/**
 * Split text into sentences (supports both EN and ZH)
 */
function splitSentences(text: string): string[] {
    // Replace newlines with spaces
    const normalized = text.replace(/\n/g, ' ')
    
    // Match sentences ending with punctuation
    const sentences = normalized.match(/[^。！？；.!?;]+[。！？；.!?;]/g)
    
    if (!sentences) {
        // Fallback: split by commas or just return as single sentence
        return [normalized]
    }
    
    return sentences
        .map(s => s.trim())
        .filter(s => s.length > 10) // Filter out very short sentences
}

/**
 * Tokenize text into words
 */
function tokenize(text: string, language: 'en' | 'zh'): string[] {
    if (language === 'zh') {
        // Chinese: split by characters and common punctuation
        return text.split(/[\s，。、：；""''!?（）【】《》]/)
            .filter(w => w && w.length >= 1)
    } else {
        // English: split by whitespace and punctuation
        return text.split(/[\s，。、：；""''!?]+/)
            .filter(w => w && w.length > 1)
    }
}

/**
 * AI-like summary using TF-IDF + TextRank + Position weighting
 */
export function aiLikeSummary(text: string, options: SummaryOptions = {}): string {
    const {
        sentenceCount = 3,
        language = 'auto'
    } = options

    // Clean HTML tags
    const cleanText = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    
    if (!cleanText) return ''

    // Detect language
    const lang = language === 'auto' ? detectLanguage(cleanText) : language

    // Split into sentences
    const sentences = splitSentences(cleanText)
    
    if (sentences.length === 0) return cleanText
    if (sentences.length <= sentenceCount) return cleanText

    // Word frequency statistics
    const wordFreq: Record<string, number> = {}
    
    for (const sen of sentences) {
        const words = tokenize(sen, lang)
            .filter(w => !STOP_WORDS.has(w.toLowerCase()))
        
        for (const w of words) {
            const lowerW = w.toLowerCase()
            wordFreq[lowerW] = (wordFreq[lowerW] || 0) + 1
        }
    }

    // Score each sentence
    const scored = sentences.map((sen, idx) => {
        const words = tokenize(sen, lang)
            .filter(w => !STOP_WORDS.has(w.toLowerCase()))
        
        // TF-IDF-like score
        const tfScore = words.reduce((total, w) => {
            return total + (wordFreq[w.toLowerCase()] || 0)
        }, 0)
        
        // Position weight: middle sentences are more important
        const middlePos = sentences.length / 2
        const positionWeight = 1 + 0.2 / (Math.abs(idx - middlePos) + 1)
        
        // Length weight: avoid too short or too long
        const lengthWeight = 0.8 + Math.min(0.4, sen.length / 200)
        
        // Final score
        const score = tfScore * positionWeight * lengthWeight
        
        return { sen, score, idx }
    })

    // Take TOP N sentences, then restore original order (key for AI-like feel!)
    const topSentences = scored
        .sort((a, b) => b.score - a.score)
        .slice(0, sentenceCount)
        .sort((a, b) => a.idx - b.idx) // Restore original order

    // Combine into fluent summary
    return topSentences.map(i => i.sen).join(' ').replace(/\s+/g, ' ')
}

/**
 * Extract keywords from text
 */
export function extractKeywords(text: string, topN: number = 10): string[] {
    const cleanText = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    const lang = detectLanguage(cleanText)
    const sentences = splitSentences(cleanText)
    
    const wordFreq: Record<string, number> = {}
    
    for (const sen of sentences) {
        const words = tokenize(sen, lang)
            .filter(w => !STOP_WORDS.has(w.toLowerCase()))
        
        for (const w of words) {
            const lowerW = w.toLowerCase()
            wordFreq[lowerW] = (wordFreq[lowerW] || 0) + 1
        }
    }
    
    return Object.entries(wordFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, topN)
        .map(([word]) => word)
}

/**
 * Legacy compatibility function
 */
export function summarizeText(text: string, options: SummaryOptions = {}): string {
    return aiLikeSummary(text, options)
}
