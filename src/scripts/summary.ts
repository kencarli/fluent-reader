
// Basic TextRank implementation
// 1. Split into sentences
// 2. Tokenize and clean
// 3. Build similarity graph
// 4. Score phrases (simplified PageRank)
// 5. Select top sentences

export function summarizeText(text: string, sentenceCount: number = 3): string {
    if (!text) return ""

    // 1. Split into sentences (naive)
    // Match periods, questions, exclamations, or newlines that look like sentence breaks
    const sentences = text.match(/[^.!?\n\r]+[.!?\n\r]+/g) || [text]
    if (sentences.length <= sentenceCount) return text

    // 2. Tokenize (lower case, remove some punctuation)
    const tokens = sentences.map(s => {
        // Simple tokenizer: split by non-word chars, filter short/empty
        return s
            .toLowerCase()
            .split(/[^\w\u4e00-\u9fa5]+/) // Support basic latin and chinese chars
            .filter(t => t.length > 1)
    })

    // 3. Score sentences
    // Simplified: Just count word frequency (TF) and sentence position?
    // Let's do a simple graph textrank:
    // Nodes = sentences
    // Edge weight = Jaccard similarity of tokens

    const n = sentences.length
    const weights = new Array(n).fill(0).map(() => new Array(n).fill(0))

    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            const w = jaccardSimilarity(tokens[i], tokens[j])
            weights[i][j] = w
            weights[j][i] = w
        }
    }

    // 4. PageRank-ish iteration
    const scores = new Array(n).fill(1)
    const d = 0.85 // damping factor
    for (let iter = 0; iter < 10; iter++) {
        const newScores = new Array(n).fill(1 - d)
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                if (i !== j && weights[i][j] > 0) {
                    const sumOut = weights[j].reduce((a, b) => a + b, 0)
                    if (sumOut > 0) {
                        newScores[i] += d * (weights[i][j] / sumOut) * scores[j]
                    }
                }
            }
        }
        // update scores
        for (let i = 0; i < n; i++) scores[i] = newScores[i]
    }

    // 5. Sort and select
    // We want to return the top sentences BUT in their original order
    const scoredSentences = sentences.map((s, i) => ({ s, score: scores[i], index: i }))
    scoredSentences.sort((a, b) => b.score - a.score)

    const topSentences = scoredSentences.slice(0, sentenceCount)
    topSentences.sort((a, b) => a.index - b.index)

    return topSentences.map(item => item.s.trim()).join(" ")
}

function jaccardSimilarity(a: string[], b: string[]): number {
    if (a.length === 0 || b.length === 0) return 0
    const setA = new Set(a)
    const setB = new Set(b)
    let intersection = 0
    for (const item of setA) {
        if (setB.has(item)) intersection++
    }
    return intersection / (setA.size + setB.size - intersection)
}

export function extractTextFromHtml(html: string): string {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, "text/html")
    // Simple text extraction, logic similar to what we did in translate.ts or just TEXT_NODE iteration
    return doc.body.textContent || ""
}


// Simple English Stopwords
const STOP_WORDS = new Set([
    "i", "me", "my", "myself", "we", "our", "ours", "ourselves", "you", "your", "yours", "yourself", "yourselves",
    "he", "him", "his", "himself", "she", "her", "hers", "herself", "it", "its", "itself", "they", "them", "their",
    "theirs", "themselves", "what", "which", "who", "whom", "this", "that", "these", "those", "am", "is", "are", "was",
    "were", "be", "been", "being", "have", "has", "had", "having", "do", "does", "did", "doing", "a", "an", "the",
    "and", "but", "if", "or", "because", "as", "until", "while", "of", "at", "by", "for", "with", "about", "against",
    "between", "into", "through", "during", "before", "after", "above", "below", "to", "from", "up", "down", "in",
    "out", "on", "off", "over", "under", "again", "further", "then", "once", "here", "there", "when", "where", "why",
    "how", "all", "any", "both", "each", "few", "more", "most", "other", "some", "such", "no", "nor", "not", "only",
    "own", "same", "so", "than", "too", "very", "s", "t", "can", "will", "just", "don", "should", "now"
])

export function generateTags(text: string, count: number = 5): string[] {
    if (!text) return []

    // 1. Tokenize & Clean
    const tokens = text
        .toLowerCase()
        .split(/[^\w\u4e00-\u9fa5]+/)
        .filter(t => t.length > 2 && !STOP_WORDS.has(t) && !/^\d+$/.test(t))

    // 2. Count frequencies (TF)
    const freqMap = new Map<string, number>()
    for (const t of tokens) {
        freqMap.set(t, (freqMap.get(t) || 0) + 1)
    }

    // 3. Sort by freq
    const sorted = [...freqMap.entries()].sort((a, b) => b[1] - a[1])

    // 4. Return top N keys
    return sorted.slice(0, count).map(e => e[0])
}
