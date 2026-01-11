// Vector Database for Semantic Search
// Stores article embeddings in IndexedDB for semantic search

import * as db from "./db"
import lf from "lovefield"

const VECTOR_DB_NAME = "vectorDB"
const VECTOR_DB_VERSION = 1
const VECTOR_TABLE_NAME = "vectors"

export interface VectorRecord {
    itemId: number
    embedding: number[]
    timestamp: Date
    model: string
}

let vectorDB: lf.Database
let vectors: lf.schema.Table

/**
 * Initialize vector database
 */
export async function initVectorDB(): Promise<void> {
    const schemaBuilder = lf.schema.create(VECTOR_DB_NAME, VECTOR_DB_VERSION)

    schemaBuilder
        .createTable(VECTOR_TABLE_NAME)
        .addColumn("itemId", lf.Type.INTEGER)
        .addPrimaryKey(["itemId"])
        .addColumn("embedding", lf.Type.OBJECT) // Store as JSON array
        .addColumn("timestamp", lf.Type.DATE_TIME)
        .addColumn("model", lf.Type.STRING)

    vectorDB = await schemaBuilder.connect()
    vectors = vectorDB.getSchema().table(VECTOR_TABLE_NAME)
}

/**
 * Store embedding for an item
 */
export async function storeEmbedding(
    itemId: number,
    embedding: number[],
    model: string = "text-embedding-3-small"
): Promise<void> {
    if (!vectorDB) {
        throw new Error("Vector DB not initialized")
    }

    const record = vectors.createRow({
        itemId,
        embedding,
        timestamp: new Date(),
        model
    })

    // Use insertOrReplace to update if exists
    await vectorDB
        .insertOrReplace()
        .into(vectors)
        .values([record])
        .exec()
}

/**
 * Store multiple embeddings (batch)
 */
export async function storeEmbeddingsBatch(
    records: Array<{ itemId: number; embedding: number[]; model?: string }>
): Promise<void> {
    if (!vectorDB) {
        throw new Error("Vector DB not initialized")
    }

    const rows = records.map(r =>
        vectors.createRow({
            itemId: r.itemId,
            embedding: r.embedding,
            timestamp: new Date(),
            model: r.model || "text-embedding-3-small"
        })
    )

    await vectorDB
        .insertOrReplace()
        .into(vectors)
        .values(rows)
        .exec()
}

/**
 * Get embedding for an item
 */
export async function getEmbedding(itemId: number): Promise<VectorRecord | null> {
    if (!vectorDB) {
        throw new Error("Vector DB not initialized")
    }

    const results = (await vectorDB
        .select()
        .from(vectors)
        .where(vectors["itemId"].eq(itemId))
        .exec()) as VectorRecord[]

    return results.length > 0 ? results[0] : null
}

/**
 * Get all embeddings
 */
export async function getAllEmbeddings(): Promise<VectorRecord[]> {
    if (!vectorDB) {
        throw new Error("Vector DB not initialized")
    }

    return (await vectorDB
        .select()
        .from(vectors)
        .exec()) as VectorRecord[]
}

/**
 * Get embeddings for multiple items
 */
export async function getEmbeddingsBatch(itemIds: number[]): Promise<VectorRecord[]> {
    if (!vectorDB) {
        throw new Error("Vector DB not initialized")
    }

    return (await vectorDB
        .select()
        .from(vectors)
        .where(vectors["itemId"].in(itemIds))
        .exec()) as VectorRecord[]
}

/**
 * Delete embedding for an item
 */
export async function deleteEmbedding(itemId: number): Promise<void> {
    if (!vectorDB) {
        throw new Error("Vector DB not initialized")
    }

    await vectorDB
        .delete()
        .from(vectors)
        .where(vectors["itemId"].eq(itemId))
        .exec()
}

/**
 * Get count of stored embeddings
 */
export async function getEmbeddingCount(): Promise<number> {
    if (!vectorDB) {
        throw new Error("Vector DB not initialized")
    }

    const result = (await vectorDB
        .select(lf.fn.count(vectors["itemId"]))
        .from(vectors)
        .exec()) as any[]

    return result[0]["COUNT(itemId)"] || 0
}

/**
 * Clear all embeddings
 */
export async function clearAllEmbeddings(): Promise<void> {
    if (!vectorDB) {
        throw new Error("Vector DB not initialized")
    }

    await vectorDB
        .delete()
        .from(vectors)
        .exec()
}
