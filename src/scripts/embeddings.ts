// OpenAI Embeddings Service
// Generates vector embeddings for semantic search using OpenAI API

import { IntegrationSettings } from "../schema-types"

const OPENAI_EMBEDDING_API = "https://api.openai.com/v1/embeddings"
const EMBEDDING_MODEL = "text-embedding-3-small"
const EMBEDDING_DIMENSIONS = 1536

export interface EmbeddingResult {
    embedding: number[]
    model: string
    usage: {
        prompt_tokens: number
        total_tokens: number
    }
}

/**
 * Generate embedding for text using OpenAI API
 */
export async function generateEmbedding(
    text: string,
    apiKey: string
): Promise<number[]> {
    if (!apiKey) {
        throw new Error("OpenAI API key not configured. Please add it in Settings > Integrations.")
    }

    // Truncate text to ~8000 tokens (rough estimate: 4 chars per token)
    const truncatedText = text.substring(0, 32000)

    try {
        const response = await fetch(OPENAI_EMBEDDING_API, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: EMBEDDING_MODEL,
                input: truncatedText,
                dimensions: EMBEDDING_DIMENSIONS
            })
        })

        if (!response.ok) {
            const error = await response.json()
            throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`)
        }

        const data = await response.json()
        return data.data[0].embedding
    } catch (error) {
        console.error("Embedding generation failed:", error)
        throw error
    }
}

/**
 * Generate embeddings for multiple texts (batch)
 */
export async function generateEmbeddingsBatch(
    texts: string[],
    apiKey: string,
    onProgress?: (current: number, total: number) => void
): Promise<number[][]> {
    const embeddings: number[][] = []

    for (let i = 0; i < texts.length; i++) {
        try {
            const embedding = await generateEmbedding(texts[i], apiKey)
            embeddings.push(embedding)

            if (onProgress) {
                onProgress(i + 1, texts.length)
            }

            // Rate limiting: 3000 RPM for tier 1
            // Wait 20ms between requests to be safe
            if (i < texts.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 20))
            }
        } catch (error) {
            console.error(`Failed to generate embedding for text ${i}:`, error)
            // Push zero vector as fallback
            embeddings.push(new Array(EMBEDDING_DIMENSIONS).fill(0))
        }
    }

    return embeddings
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
        throw new Error("Vectors must have same dimensions")
    }

    let dotProduct = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i]
        normA += a[i] * a[i]
        normB += b[i] * b[i]
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}
