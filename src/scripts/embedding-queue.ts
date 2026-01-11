// Background Embedding Queue
// Manages async embedding generation without blocking UI

import { RSSItem } from "./models/item"
import { generateEmbedding, generateEmbeddingsBatch } from "./embeddings"
import { storeEmbedding, storeEmbeddingsBatch, getEmbedding } from "./vector-db"
import { extractTextFromHtml } from "./summary"

interface EmbeddingTask {
    itemId: number
    text: string
}

class EmbeddingQueue {
    private queue: EmbeddingTask[] = []
    private processing: boolean = false
    private apiKey: string = ""

    setApiKey(key: string) {
        this.apiKey = key
    }

    /**
     * Add items to embedding queue
     */
    async enqueue(items: RSSItem[]) {
        if (!this.apiKey) {
            console.warn("OpenAI API key not set. Skipping embedding generation.")
            return
        }

        // Filter items that don't have embeddings yet
        const newTasks: EmbeddingTask[] = []

        for (const item of items) {
            const existing = await getEmbedding(item._id)
            if (!existing && item.content) {
                const text = `${item.title}\n\n${extractTextFromHtml(item.content)}`
                newTasks.push({ itemId: item._id, text })
            }
        }

        if (newTasks.length > 0) {
            this.queue.push(...newTasks)
            console.log(`Added ${newTasks.length} items to embedding queue`)

            // Start processing if not already running
            if (!this.processing) {
                this.processQueue()
            }
        }
    }

    /**
     * Process embedding queue in background
     */
    private async processQueue() {
        if (this.processing || this.queue.length === 0) {
            return
        }

        this.processing = true
        console.log(`Processing ${this.queue.length} embedding tasks...`)

        try {
            // Process in batches of 10 to avoid overwhelming API
            const batchSize = 10

            while (this.queue.length > 0) {
                const batch = this.queue.splice(0, batchSize)
                const texts = batch.map(t => t.text)

                try {
                    const embeddings = await generateEmbeddingsBatch(texts, this.apiKey)

                    // Store embeddings
                    const records = batch.map((task, idx) => ({
                        itemId: task.itemId,
                        embedding: embeddings[idx]
                    }))

                    await storeEmbeddingsBatch(records)
                    console.log(`Stored ${records.length} embeddings`)

                } catch (error) {
                    console.error(`Failed to process batch:`, error)
                    // Re-add failed batch to queue
                    this.queue.unshift(...batch)
                    break
                }

                // Small delay between batches
                await new Promise(resolve => setTimeout(resolve, 100))
            }

            console.log("Embedding queue processing complete")

        } catch (error) {
            console.error("Error processing embedding queue:", error)
        } finally {
            this.processing = false
        }
    }

    /**
     * Get queue status
     */
    getStatus() {
        return {
            queueLength: this.queue.length,
            processing: this.processing
        }
    }

    /**
     * Clear queue
     */
    clear() {
        this.queue = []
    }
}

// Singleton instance
export const embeddingQueue = new EmbeddingQueue()
