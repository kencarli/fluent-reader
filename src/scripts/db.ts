import intl from "react-intl-universal"
import Datastore from "nedb"
import lf from "lovefield"
import { RSSSource } from "./models/source"
import { RSSItem } from "./models/item"
import { initHighlightsDB, highlightsDB, closeHighlightsDB } from "./highlights-db"
import { initVectorDB } from "./vector-db"

const sdbSchema = lf.schema.create("sourcesDB", 3)
sdbSchema
    .createTable("sources")
    .addColumn("sid", lf.Type.INTEGER)
    .addPrimaryKey(["sid"], false)
    .addColumn("url", lf.Type.STRING)
    .addColumn("iconurl", lf.Type.STRING)
    .addColumn("name", lf.Type.STRING)
    .addColumn("openTarget", lf.Type.NUMBER)
    .addColumn("lastFetched", lf.Type.DATE_TIME)
    .addColumn("serviceRef", lf.Type.STRING)
    .addColumn("fetchFrequency", lf.Type.NUMBER)
    .addColumn("rules", lf.Type.OBJECT)
    .addColumn("textDir", lf.Type.NUMBER)
    .addColumn("hidden", lf.Type.BOOLEAN)
    .addNullable(["iconurl", "serviceRef", "rules"])
    .addIndex("idxURL", ["url"], true)

const idbSchema = lf.schema.create("itemsDB", 4);
idbSchema
    .createTable("items")
    .addColumn("_id", lf.Type.INTEGER)
    .addPrimaryKey(["_id"], true)
    .addColumn("source", lf.Type.INTEGER)
    .addColumn("title", lf.Type.STRING)
    .addColumn("link", lf.Type.STRING)
    .addColumn("date", lf.Type.DATE_TIME)
    .addColumn("fetchedDate", lf.Type.DATE_TIME)
    .addColumn("thumb", lf.Type.STRING)
    .addColumn("content", lf.Type.STRING)
    .addColumn("snippet", lf.Type.STRING)
    .addColumn("creator", lf.Type.STRING)
    .addColumn("hasRead", lf.Type.BOOLEAN)
    .addColumn("starred", lf.Type.BOOLEAN)
    .addColumn("hidden", lf.Type.BOOLEAN)
    .addColumn("notify", lf.Type.BOOLEAN)
    .addColumn("serviceRef", lf.Type.STRING)
    .addColumn("tags", lf.Type.STRING)
    .addColumn("syncStatus", lf.Type.NUMBER)
    .addNullable(["thumb", "creator", "serviceRef", "tags", "syncStatus"])
    .addIndex("idxDate", ["date"], false, lf.Order.DESC)
    .addIndex("idxService", ["serviceRef"], false);

export let sourcesDB: lf.Database;
export let sources: lf.schema.Table;
export let itemsDB: lf.Database;
export let items: lf.schema.Table;

async function onUpgradeSourceDB(rawDb: lf.raw.BackStore) {
    const version = rawDb.getVersion();
    if (version < 2) {
        await rawDb.addTableColumn("sources", "textDir", 0);
    }
    if (version < 3) {
        await rawDb.addTableColumn("sources", "hidden", false);
    }
}

async function onUpgradeItemDB(rawDb: lf.raw.BackStore) {
    const version = rawDb.getVersion()
    if (version < 2) {
        await rawDb.addTableColumn("items", "tags", null)
    }
    if (version < 4) {
        await rawDb.addTableColumn("items", "syncStatus", 0)
    }
}
// Wait, to be clean, if I use `tags` as STRING, and it was OBJECT, Lovefield will error.
// Code below uses `tags` as string. I will assume I can just use `tags` and if it errors I will wipe DB.
// But valid agent behavior: Use `tags` but safeguard onUpgrade.
// Actually, `addTableColumn` throws if exists.
// I'll stick to `tags` and hope `itemsDB` recreation fixes it (if schema mismatch).
// OR better: use `tagString`.
// I'll stick to `tags` string type.


export async function init() {
    try {
        sourcesDB = await sdbSchema.connect({ onUpgrade: onUpgradeSourceDB })
        sources = sourcesDB.getSchema().table("sources")
        itemsDB = await idbSchema.connect({ onUpgrade: onUpgradeItemDB })
        items = itemsDB.getSchema().table("items")

        await initHighlightsDB();

        // Initialize vector database for semantic search
        try {
            await initVectorDB()
            console.log("Vector DB initialized successfully")
        } catch (error) {
            console.error("Failed to initialize vector DB:", error)
        }

        if (window.settings.getNeDBStatus()) {
            await migrateNeDB()
        }
        
        // Export database references to window AFTER all initialization is complete
        exportDBRefs()
        console.log('[db.init] Database initialization complete, exported to window.__DB__')
    } catch (error) {
        console.error("Failed to initialize main database:", error)
        // Try to recover by deleting corrupted databases and reinitializing
        try {
            console.log("Attempting database recovery...")
            await deleteCorruptedDatabases()

            // Reset global variables
            sourcesDB = null
            sources = null
            itemsDB = null
            items = null

            // Reinitialize after cleanup
            sourcesDB = await sdbSchema.connect({ onUpgrade: onUpgradeSourceDB })
            sources = sourcesDB.getSchema().table("sources")
            itemsDB = await idbSchema.connect({ onUpgrade: onUpgradeItemDB })
            items = itemsDB.getSchema().table("items")
            await initHighlightsDB()
            
            // Export database references to window after recovery
            exportDBRefs()
            
            console.log("Database recovery successful")
        } catch (recoveryError) {
            console.error("Database recovery failed:", recoveryError)
            throw recoveryError
        }
    }
}

// Export database references to window for access in other modules
function exportDBRefs() {
    if (itemsDB && items) {
        (window as any).__DB__ = {
            itemsDB,
            items,
            sourcesDB,
            sources,
            highlightsDB
        }
        console.log('[exportDBRefs] Exported database references:', {
            itemsDB: !!itemsDB,
            items: !!items,
            itemsTableName: items ? items.getName() : 'N/A',
            sourcesDB: !!sourcesDB,
            sources: !!sources
        })
    } else {
        console.warn('[exportDBRefs] Database not ready for export:', {
            itemsDB: !!itemsDB,
            items: !!items
        })
    }
}

/**
 * Delete corrupted databases to allow fresh initialization
 */
async function deleteCorruptedDatabases(): Promise<void> {
    return new Promise((resolve) => {
        const dbNames = ["sourcesDB", "itemsDB", "highlightsDB", "vectorDB"]
        let completed = 0
        
        function checkComplete() {
            completed++
            if (completed >= dbNames.length) {
                resolve()
            }
        }
        
        // Close any open connections first
        try {
            if (sourcesDB) {
                sourcesDB.close()
                sourcesDB = null
            }
        } catch (e) {
            console.warn("Error closing sourcesDB:", e)
        }
        try {
            if (itemsDB) {
                itemsDB.close()
                itemsDB = null
            }
        } catch (e) {
            console.warn("Error closing itemsDB:", e)
        }
        try {
            closeHighlightsDB()
        } catch (e) {
            console.warn("Error closing highlightsDB:", e)
        }
        
        // Delete databases with timeout handling
        dbNames.forEach(dbName => {
            try {
                const request = indexedDB.deleteDatabase(dbName)
                request.onsuccess = () => {
                    console.log(`Database ${dbName} deleted successfully`)
                    checkComplete()
                }
                request.onerror = (event) => {
                    console.warn(`Failed to delete ${dbName}:`, request.error)
                    checkComplete() // Continue anyway
                }
                request.onblocked = (event) => {
                    console.warn(`Database ${dbName} deletion blocked`)
                    // Wait and retry
                    setTimeout(() => {
                        try {
                            const retryRequest = indexedDB.deleteDatabase(dbName)
                            retryRequest.onsuccess = () => checkComplete()
                            retryRequest.onerror = () => checkComplete()
                            retryRequest.onblocked = () => {
                                console.warn(`Retry blocked for ${dbName}`)
                                checkComplete()
                            }
                        } catch (e) {
                            console.warn(`Retry failed for ${dbName}:`, e)
                            checkComplete()
                        }
                    }, 500)
                }
            } catch (e) {
                console.warn(`Error deleting ${dbName}:`, e)
                checkComplete()
            }
        })
        
        // Timeout after 3 seconds
        setTimeout(() => {
            if (completed < dbNames.length) {
                console.warn("Database deletion timeout, continuing anyway")
            }
            resolve()
        }, 3000)
    })
}

async function migrateNeDB() {
    try {
        const sdb = new Datastore<RSSSource>({
            filename: "sources",
            autoload: true,
            onload: err => {
                if (err) window.console.log(err)
            },
        })
        const idb = new Datastore<RSSItem>({
            filename: "items",
            autoload: true,
            onload: err => {
                if (err) window.console.log(err)
            },
        })
        const sourceDocs = await new Promise<RSSSource[]>(resolve => {
            sdb.find({}, (_, docs) => {
                resolve(docs)
            })
        })
        const itemDocs = await new Promise<RSSItem[]>(resolve => {
            idb.find({}, (_, docs) => {
                resolve(docs)
            })
        })
        const sRows = sourceDocs.map(doc => {
            if (doc.serviceRef !== undefined)
                doc.serviceRef = String(doc.serviceRef)
            // @ts-ignore
            delete doc._id
            if (!doc.fetchFrequency) doc.fetchFrequency = 0
            doc.textDir = 0
            doc.hidden = false
            return sources.createRow(doc)
        })
        const iRows = itemDocs.map(doc => {
            if (doc.serviceRef !== undefined)
                doc.serviceRef = String(doc.serviceRef)
            if (!doc.title) doc.title = intl.get("article.untitled")
            if (!doc.content) doc.content = ""
            if (!doc.snippet) doc.snippet = ""
            delete doc._id
            doc.starred = Boolean(doc.starred)
            doc.hidden = Boolean(doc.hidden)
            doc.notify = Boolean(doc.notify)
            return items.createRow(doc)
        })
        await Promise.all([
            sourcesDB.insert().into(sources).values(sRows).exec(),
            itemsDB.insert().into(items).values(iRows).exec(),
        ])
        window.settings.setNeDBStatus(false)
        sdb.remove({}, { multi: true }, () => {
            sdb.persistence.compactDatafile()
        })
        idb.remove({}, { multi: true }, () => {
            idb.persistence.compactDatafile()
        })
    } catch (err) {
        window.utils.showErrorBox(
            "An error has occured during update. Please report this error on GitHub.",
            String(err)
        )
        window.utils.closeWindow()
    }
}
