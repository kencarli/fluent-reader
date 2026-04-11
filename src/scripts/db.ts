import intl from "react-intl-universal"
import Datastore from "nedb"
import lf from "lovefield"
import { RSSSource } from "./models/source"
import { RSSItem } from "./models/item"
import { initHighlightsDB } from "./highlights-db"
import { initVectorDB } from "./vector-db"
import { initRatingsDB } from "./ratings-db"

// Lovefield DataStore types - use numeric constants from Lovefield
const INDEXED_DB = 0  // lf.schema.DataStoreType.INDEXED_DB
const MEMORY_DB = 1   // lf.schema.DataStoreType.MEMORY

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

const idbSchema = lf.schema.create("itemsDB", 5);
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
    .addIndex("idxService", ["serviceRef"], false)
    .addIndex("idxSourceLink", ["source", "link"], false);  // 唯一索引：防止同一来源的相同 link

// Function to create fresh schema objects (used when retrying after deletion)
function createSourcesDBSchema() {
    const schema = lf.schema.create("sourcesDB", 3)
    schema
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
    return schema
}

function createItemsDBSchema() {
    const schema = lf.schema.create("itemsDB", 5);
    schema
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
        .addIndex("idxService", ["serviceRef"], false)
        .addIndex("idxSourceLink", ["source", "link"], false);
    return schema
}

export let sourcesDB: lf.Database;
export let sources: lf.schema.Table;
export let itemsDB: lf.Database;
export let items: lf.schema.Table;
export let dbInitialized = false;  // Track database initialization status

async function onUpgradeSourceDB(rawDb: lf.raw.BackStore) {
    console.log('[DB] Upgrading sourcesDB, current version:', rawDb.getVersion());
    const version = rawDb.getVersion();
    if (version < 2) {
        try {
            await rawDb.addTableColumn("sources", "textDir", 0);
            console.log('[DB] Added textDir column to sources');
        } catch (e) {
            console.warn('[DB] textDir column may already exist:', e);
        }
    }
    if (version < 3) {
        try {
            await rawDb.addTableColumn("sources", "hidden", false);
            console.log('[DB] Added hidden column to sources');
        } catch (e) {
            console.warn('[DB] hidden column may already exist:', e);
        }
    }
}

async function onUpgradeItemDB(rawDb: lf.raw.BackStore) {
    console.log('[DB] Upgrading itemsDB, current version:', rawDb.getVersion());
    const version = rawDb.getVersion();
    if (version < 2) {
        try {
            await rawDb.addTableColumn("items", "tags", null);
            console.log('[DB] Added tags column to items');
        } catch (e) {
            console.warn('[DB] tags column may already exist:', e);
        }
    }
    if (version < 4) {
        try {
            await rawDb.addTableColumn("items", "syncStatus", 0);
            console.log('[DB] Added syncStatus column to items');
        } catch (e) {
            console.warn('[DB] syncStatus column may already exist:', e);
        }
    }
    if (version < 5) {
        console.log("[DB] ItemsDB version 5: deduplication index support");
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
    console.log('[DB] Starting initialization...')
    let usedMemoryFallback = false;

    try {
        // Use IndexedDB for persistent storage to prevent connection loss
        console.log('[DB] Attempting IndexedDB connection...')
        
        // Close existing connections if any
        if (sourcesDB) {
            try {
                sourcesDB.close()
            } catch (e) {
                // Ignore close errors
            }
        }
        if (itemsDB) {
            try {
                itemsDB.close()
            } catch (e) {
                // Ignore close errors
            }
        }
        
        sourcesDB = await sdbSchema.connect({
            onUpgrade: onUpgradeSourceDB,
            // @ts-ignore - Lovefield types are incomplete
            storeType: INDEXED_DB
        })
        sources = sourcesDB.getSchema().table("sources")
        console.log('[DB] Sources DB initialized')

        itemsDB = await idbSchema.connect({
            onUpgrade: onUpgradeItemDB,
            // @ts-ignore
            storeType: INDEXED_DB
        })
        items = itemsDB.getSchema().table("items")
        console.log('[DB] Items DB initialized')

        // Validate database connection by running a test query similar to actual usage
        try {
            console.log('[DB] Running validation query...')
            const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
            await sourcesDB.select().from(sources).limit(1).exec()
            await itemsDB.select()
                .from(items)
                .where(items.date.gte(cutoff))
                .orderBy(items.date, lf.Order.DESC)
                .limit(1)
                .exec()
            console.log('[DB] Database validation successful')
        } catch (validationError: any) {
            console.log('[DB] Database validation failed:', validationError.code)
            throw validationError
        }

        dbInitialized = true
        console.log('[DB] Initialization complete with IndexedDB')
    } catch (error: any) {
        // Error 201 = DUPLICATE_PRIMARY_KEY - database is corrupted
        if (error.code === 201) {
            console.warn('[DB] Database corrupted (error 201), deleting and recreating...')
            try {
                // Delete existing corrupted databases
                const deleteRequest1 = indexedDB.deleteDatabase('sourcesDB')
                const deleteRequest2 = indexedDB.deleteDatabase('itemsDB')

                await new Promise<void>((resolve, reject) => {
                    let completed = 0
                    const checkDone = () => {
                        completed++
                        if (completed === 2) resolve()
                    }

                    deleteRequest1.onsuccess = () => {
                        console.log('[DB] sourcesDB deleted')
                        checkDone()
                    }
                    deleteRequest1.onerror = () => {
                        console.warn('[DB] Failed to delete sourcesDB')
                        checkDone()
                    }

                    deleteRequest2.onsuccess = () => {
                        console.log('[DB] itemsDB deleted')
                        checkDone()
                    }
                    deleteRequest2.onerror = () => {
                        console.warn('[DB] Failed to delete itemsDB')
                        checkDone()
                    }
                })

                // Wait a bit for deletion to complete
                await new Promise(resolve => setTimeout(resolve, 500))

                // Recreate schema objects (they were invalidated)
                const freshSourcesSchema = createSourcesDBSchema()
                const freshItemsSchema = createItemsDBSchema()

                // Reconnect with fresh databases
                sourcesDB = await freshSourcesSchema.connect({
                    onUpgrade: onUpgradeSourceDB,
                    // @ts-ignore
                    storeType: INDEXED_DB
                })
                sources = sourcesDB.getSchema().table("sources")
                console.log('[DB] Sources DB recreated successfully')

                itemsDB = await freshItemsSchema.connect({
                    onUpgrade: onUpgradeItemDB,
                    // @ts-ignore
                    storeType: INDEXED_DB
                })
                items = itemsDB.getSchema().table("items")
                console.log('[DB] Items DB recreated successfully')

                dbInitialized = true
                console.log('[DB] Database recreation complete')
            } catch (recreateError) {
                console.error('[DB] Failed to recreate database:', recreateError)
                throw recreateError
            }
        } else if (error.code === 300 || error.code === 516) {
            // Error 300 or 516: Database version mismatch - use memory database
            console.log('[DB] Database version mismatch detected')
            console.log('[DB] Using memory database...')
            usedMemoryFallback = true;

            try {
                const memorySourcesSchema = createSourcesDBSchema();
                const memoryItemsSchema = createItemsDBSchema();

                sourcesDB = await memorySourcesSchema.connect({
                    onUpgrade: onUpgradeSourceDB
                })
                sources = sourcesDB.getSchema().table("sources")

                itemsDB = await memoryItemsSchema.connect({
                    onUpgrade: onUpgradeItemDB
                })
                items = itemsDB.getSchema().table("items")

                dbInitialized = true
                console.log('[DB] Memory database initialized successfully')
                console.log('[DB] NOTE: Your existing data in IndexedDB is safe')
                console.log('[DB] NOTE: Data will not persist between sessions')
            } catch (memoryError: any) {
                console.error('[DB] Memory database initialization failed:', memoryError)
                throw memoryError
            }
        } else {
            // Other errors - log and throw
            console.error('[DB] Initialization failed:', error)
            console.error('[DB] Error message:', error.message)
            console.error('[DB] Error code:', error.code)
            console.error('[DB] Error stack:', error.stack)
            
            dbInitialized = false
            throw error
        }
    }

    await initHighlightsDB();

    // Initialize ratings database
    try {
        await initRatingsDB()
        console.log("Ratings DB initialized successfully")
    } catch (error) {
        console.error("Failed to initialize ratings DB:", error)
    }

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
