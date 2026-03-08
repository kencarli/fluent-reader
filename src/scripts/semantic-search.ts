// Semantic Search Engine
// Performs similarity search over article embeddings

import { RSSItem } from "./models/item"
import { cosineSimilarity, generateEmbedding } from "./embeddings"
import { getAllEmbeddings, VectorRecord } from "./vector-db"
import { IntegrationSettings } from "../schema-types"

export interface SemanticSearchResult {
    item: RSSItem
    similarity: number
}

/**
 * Get embedding API config from settings
 */
function getEmbeddingConfig(settings: IntegrationSettings): { apiKey: string; apiUrl?: string; model?: string } | null {
    if (settings.nvidiaApiKey) {
        return {
            apiKey: settings.nvidiaApiKey,
            apiUrl: "https://integrate.api.nvidia.com/v1/embeddings",
            model: "nvidia/nv-embedqa-e5-v5"
        }
    }
    if (settings.deepseekApiKey) {
        return {
            apiKey: settings.deepseekApiKey,
            apiUrl: "https://api.deepseek.com/v1/embeddings",
            model: "deepseek-embed"
        }
    }
    if (settings.openaiApiKey) {
        return {
            apiKey: settings.openaiApiKey
        }
    }
    return null
}

/**
 * Search for similar articles using semantic search
 * @param query - Search query text
 * @param apiKeyOrSettings - API key or IntegrationSettings
 * @param items - All items to search through
 * @param topK - Number of results to return
 * @returns Array of search results sorted by similarity
 */
export async function semanticSearch(
    query: string,
    apiKeyOrSettings: string | IntegrationSettings,
    items: { [_id: number]: RSSItem },
    topK: number = 20
): Promise<SemanticSearchResult[]> {
    try {
        // Handle both string apiKey and IntegrationSettings
        let apiKey: string
        let apiUrl: string | undefined
        let model: string | undefined
        
        if (typeof apiKeyOrSettings === "string") {
            apiKey = apiKeyOrSettings
        } else {
            const config = getEmbeddingConfig(apiKeyOrSettings)
            if (!config) {
                throw new Error("No embedding provider configured")
            }
            apiKey = config.apiKey
            apiUrl = config.apiUrl
            model = config.model
        }
        
        // Step 1: Generate embedding for query
        const queryEmbedding = await generateEmbedding(query, apiKey, apiUrl, model)

        // Step 2: Get all stored embeddings
        const vectorRecords = await getAllEmbeddings()

        if (vectorRecords.length === 0) {
            console.warn("No embeddings found. Please generate embeddings first.")
            return []
        }

        // Step 3: Calculate similarities
        const results: SemanticSearchResult[] = []

        const YIELD_INTERVAL = 100
        for (let i = 0; i < vectorRecords.length; i++) {
            const record = vectorRecords[i]
            const item = items[record.itemId]
            if (!item) continue // Item might have been deleted

            const similarity = cosineSimilarity(queryEmbedding, record.embedding)
            results.push({ item, similarity })

            // Yield control to the event loop periodically
            if ((i + 1) % YIELD_INTERVAL === 0) {
                await new Promise(resolve => setTimeout(resolve, 0))
            }
        }

        // Step 4: Sort by similarity (descending) and return top K
        results.sort((a, b) => b.similarity - a.similarity)
        return results.slice(0, topK)

    } catch (error) {
        console.error("Semantic search failed:", error)
        throw error
    }
}

/**
 * Hybrid search: combines keyword and semantic search
 * @param query - Search query
 * @param apiKey - OpenAI API key  
 * @param items - All items
 * @param keywordResults - Items from keyword search
 * @param semanticWeight - Weight for semantic scores (0-1)
 * @returns Combined search results
 */
export async function hybridSearch(
    query: string,
    apiKey: string,
    items: { [_id: number]: RSSItem },
    keywordResults: RSSItem[],
    semanticWeight: number = 0.7,
    topK: number = 20
): Promise<SemanticSearchResult[]> {
    const semanticResults = await semanticSearch(query, apiKey, items, topK * 2)

    // Create a map of item scores
    const scoreMap = new Map<number, number>()

    // Add semantic scores
    for (const result of semanticResults) {
        scoreMap.set(result.item._id, result.similarity * semanticWeight)
    }

    // Add keyword scores (inverse rank)
    const keywordWeight = 1 - semanticWeight
    for (let i = 0; i < keywordResults.length; i++) {
        const item = keywordResults[i]
        const keywordScore = (1 - i / keywordResults.length) * keywordWeight
        const currentScore = scoreMap.get(item._id) || 0
        scoreMap.set(item._id, currentScore + keywordScore)
    }

    // Convert to results array
    const results: SemanticSearchResult[] = []
    for (const [itemId, score] of scoreMap.entries()) {
        const item = items[itemId]
        if (item) {
            results.push({ item, similarity: score })
        }
    }

    // Sort and return top K
    results.sort((a, b) => b.similarity - a.similarity)
    return results.slice(0, topK)
}

/**
 * Find similar articles to a given article
 * @param sourceItem - The reference article
 * @param items - All items
 * @param topK - Number of similar articles to return
 */
export async function findSimilarArticles(
    sourceItem: RSSItem,
    items: { [_id: number]: RSSItem },
    topK: number = 10
): Promise<SemanticSearchResult[]> {
    const vectorRecords = await getAllEmbeddings()
    const sourceVector = vectorRecords.find(v => v.itemId === sourceItem._id)

    if (!sourceVector) {
        throw new Error("Source article has no embedding")
    }

    const results: SemanticSearchResult[] = []

    for (const record of vectorRecords) {
        if (record.itemId === sourceItem._id) continue // Skip self

        const item = items[record.itemId]
        if (!item) continue

        const similarity = cosineSimilarity(sourceVector.embedding, record.embedding)
        results.push({ item, similarity })
    }

    results.sort((a, b) => b.similarity - a.similarity)
    return results.slice(0, topK)
}
