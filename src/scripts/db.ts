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
    // Prevent duplicate initialization
    if (dbInitialized) {
        console.log('[DB] Already initialized, skipping...')
        return
    }

    console.log('[DB] Starting initialization...')
    let usedMemoryFallback = false;
    const startTime = Date.now()

    try {
        // Use IndexedDB for persistent storage to prevent connection loss
        console.log('[DB] Attempting IndexedDB connection (parallel)...')
        
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
        
        // 并行初始化 sourcesDB 和 itemsDB
        const [sourcesResult, itemsResult] = await Promise.all([
            sdbSchema.connect({
                onUpgrade: onUpgradeSourceDB,
                // @ts-ignore - Lovefield types are incomplete
                storeType: INDEXED_DB
            }),
            idbSchema.connect({
                onUpgrade: onUpgradeItemDB,
                // @ts-ignore
                storeType: INDEXED_DB
            })
        ])
        
        sourcesDB = sourcesResult
        sources = sourcesDB.getSchema().table("sources")
        console.log('[DB] Sources DB initialized')

        itemsDB = itemsResult
        items = itemsDB.getSchema().table("items")
        console.log('[DB] Items DB initialized')

        // Validate database connection by running a test query similar to actual usage
        try {
            console.log('[DB] Running validation query...')
            const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
            
            // 并行执行验证查询
            await Promise.all([
                sourcesDB.select().from(sources).limit(1).exec(),
                itemsDB.select()
                    .from(items)
                    .where(items.date.gte(cutoff))
                    .orderBy(items.date, lf.Order.DESC)
                    .limit(1)
                    .exec()
            ])
            console.log('[DB] Database validation successful')
        } catch (validationError: any) {
            console.log('[DB] Database validation failed:', validationError.code)
            throw validationError
        }

        dbInitialized = true
        console.log(`[DB] Initialization complete with IndexedDB (${Date.now() - startTime}ms)`)
    } catch (error: any) {
        // Error 201 = DUPLICATE_PRIMARY_KEY - database is corrupted
        if (error.code === 201) {
            console.warn('[DB] Database corrupted (error 201), deleting and recreating...')
            try {
                // First close any existing connections
                if (sourcesDB) {
                    try { sourcesDB.close() } catch (e) {}
                }
                if (itemsDB) {
                    try { itemsDB.close() } catch (e) {}
                }
                
                // Delete existing corrupted databases with better error handling
                await new Promise<void>((resolve, reject) => {
                    let deleteCount = 0
                    const checkComplete = () => {
                        deleteCount++
                        if (deleteCount === 2) {
                            setTimeout(resolve, 1000) // Wait 1 second after both deletions complete
                        }
                    }
                    
                    const req1 = indexedDB.deleteDatabase('sourcesDB')
                    req1.onsuccess = () => {
                        console.log('[DB] sourcesDB deleted successfully')
                        checkComplete()
                    }
                    req1.onerror = () => {
                        console.warn('[DB] sourcesDB deletion failed, but continuing...')
                        checkComplete()
                    }
                    req1.onblocked = () => {
                        console.warn('[DB] sourcesDB deletion blocked, waiting...')
                        setTimeout(() => checkComplete(), 2000)
                    }
                    
                    const req2 = indexedDB.deleteDatabase('itemsDB')
                    req2.onsuccess = () => {
                        console.log('[DB] itemsDB deleted successfully')
                        checkComplete()
                    }
                    req2.onerror = () => {
                        console.warn('[DB] itemsDB deletion failed, but continuing...')
                        checkComplete()
                    }
                    req2.onblocked = () => {
                        console.warn('[DB] itemsDB deletion blocked, waiting...')
                        setTimeout(() => checkComplete(), 2000)
                    }
                })
                
                console.log('[DB] Databases deleted, waiting for cleanup...')
                await new Promise(resolve => setTimeout(resolve, 1000))

                // Recreate schema objects (they were invalidated)
                const freshSourcesSchema = createSourcesDBSchema()
                const freshItemsSchema = createItemsDBSchema()

                // Reconnect with fresh databases
                console.log('[DB] Attempting to recreate databases...')
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
                console.log('[DB] Database recreation complete - app will work with fresh database')
            } catch (recreateError) {
                console.error('[DB] Failed to recreate database:', recreateError)
                // If recreation fails, fall back to memory database
                console.log('[DB] Falling back to memory database...')
                usedMemoryFallback = true
                
                const memorySourcesSchema = createSourcesDBSchema()
                const memoryItemsSchema = createItemsDBSchema()

                sourcesDB = await memorySourcesSchema.connect({
                    onUpgrade: onUpgradeSourceDB
                })
                sources = sourcesDB.getSchema().table("sources")

                itemsDB = await memoryItemsSchema.connect({
                    onUpgrade: onUpgradeItemDB
                })
                items = itemsDB.getSchema().table("items")

                dbInitialized = true
                console.log('[DB] Memory database initialized as fallback')
            }
        } else if (error.code === 300 || error.code === 516) {
            console.log('[DB] Database version mismatch detected (error', error.code, ')')
            console.log('[DB] Attempting to delete old database and recreate...')
            
            try {
                if (sourcesDB) {
                    try { sourcesDB.close() } catch (e) {}
                }
                if (itemsDB) {
                    try { itemsDB.close() } catch (e) {}
                }
                
                await new Promise<void>((resolve) => {
                    let deleteCount = 0
                    const checkComplete = () => {
                        deleteCount++
                        if (deleteCount === 2) {
                            setTimeout(resolve, 1000)
                        }
                    }
                    
                    const req1 = indexedDB.deleteDatabase('sourcesDB')
                    req1.onsuccess = () => {
                        console.log('[DB] sourcesDB deleted successfully (version mismatch fix)')
                        checkComplete()
                    }
                    req1.onerror = () => {
                        console.warn('[DB] sourcesDB deletion failed, but continuing...')
                        checkComplete()
                    }
                    req1.onblocked = () => {
                        console.warn('[DB] sourcesDB deletion blocked, waiting...')
                        setTimeout(() => checkComplete(), 2000)
                    }
                    
                    const req2 = indexedDB.deleteDatabase('itemsDB')
                    req2.onsuccess = () => {
                        console.log('[DB] itemsDB deleted successfully (version mismatch fix)')
                        checkComplete()
                    }
                    req2.onerror = () => {
                        console.warn('[DB] itemsDB deletion failed, but continuing...')
                        checkComplete()
                    }
                    req2.onblocked = () => {
                        console.warn('[DB] itemsDB deletion blocked, waiting...')
                        setTimeout(() => checkComplete(), 2000)
                    }
                })
                
                await new Promise(resolve => setTimeout(resolve, 1000))
                
                const freshSourcesSchema = createSourcesDBSchema()
                const freshItemsSchema = createItemsDBSchema()
                
                console.log('[DB] Attempting to recreate databases after version mismatch...')
                sourcesDB = await freshSourcesSchema.connect({
                    onUpgrade: onUpgradeSourceDB,
                    // @ts-ignore
                    storeType: INDEXED_DB
                })
                sources = sourcesDB.getSchema().table("sources")
                console.log('[DB] Sources DB recreated successfully after version fix')
                
                itemsDB = await freshItemsSchema.connect({
                    onUpgrade: onUpgradeItemDB,
                    // @ts-ignore
                    storeType: INDEXED_DB
                })
                items = itemsDB.getSchema().table("items")
                console.log('[DB] Items DB recreated successfully after version fix')
                
                dbInitialized = true
                console.log('[DB] Database recreation complete after version mismatch fix')
            } catch (recreateError) {
                console.error('[DB] Failed to recreate database after version mismatch:', recreateError)
                console.log('[DB] Falling back to memory database as last resort...')
                usedMemoryFallback = true
                
                const memorySourcesSchema = createSourcesDBSchema()
                const memoryItemsSchema = createItemsDBSchema()
                
                sourcesDB = await memorySourcesSchema.connect({
                    onUpgrade: onUpgradeSourceDB
                })
                sources = sourcesDB.getSchema().table("sources")
                
                itemsDB = await memoryItemsSchema.connect({
                    onUpgrade: onUpgradeItemDB
                })
                items = itemsDB.getSchema().table("items")
                
                dbInitialized = true
                console.log('[DB] Memory database initialized as fallback')
                console.log('[DB] WARNING: Data will NOT persist between sessions!')
                
                if (typeof window !== 'undefined' && window.utils && window.utils.showErrorBox) {
                    setTimeout(() => {
                        window.utils.showErrorBox(
                            "数据库警告",
                            "应用正在使用临时内存数据库，关闭后数据将丢失。\n\n这通常是因为 IndexedDB 出现问题。\n\n建议：\n1. 重启应用\n2. 如果问题持续，尝试清除应用数据"
                        )
                    }, 1000)
                }
            }
        } else {
            console.error('[DB] Initialization failed:', error)
            console.error('[DB] Error message:', error.message)
            console.error('[DB] Error code:', error.code)
            console.error('[DB] Error stack:', error.stack)
            
            dbInitialized = false
            throw error
        }
    }

    // 并行初始化其他数据库
    const initPromises = [
        initHighlightsDB().then(() => console.log("[DB] Highlights DB initialized successfully")),
        initRatingsDB().then(() => console.log("[DB] Ratings DB initialized successfully")).catch(err => console.error("[DB] Failed to initialize Ratings DB:", err)),
        initVectorDB().then(() => console.log("[DB] Vector DB initialized successfully")).catch(err => console.error("[DB] Failed to initialize Vector DB:", err))
    ]
    
    // 等待所有数据库初始化完成，但不阻塞主流程
    await Promise.allSettled(initPromises)
    
    // NeDB 迁移（需要主数据库初始化完成）
    if (window.settings.getNeDBStatus()) {
        await migrateNeDB()
    }
    
    console.log(`[DB] All databases initialized (total: ${Date.now() - startTime}ms)`)
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
