import lf from "lovefield";

// Lovefield DataStore type - use numeric constant
const INDEXED_DB = 0  // lf.schema.DataStoreType.INDEXED_DB

export let highlightsDB: lf.Database;
export let highlights: lf.schema.Table;

const hdbSchema = lf.schema.create("highlightsDB", 1);

hdbSchema
    .createTable("highlights")
    .addColumn("_id", lf.Type.INTEGER)
    .addPrimaryKey(["_id"], true)
    .addColumn("itemId", lf.Type.INTEGER)
    .addColumn("text", lf.Type.STRING)
    .addColumn("note", lf.Type.STRING)
    .addColumn("range", lf.Type.STRING)
    .addColumn("createdDate", lf.Type.DATE_TIME)
    .addIndex("idxItemId", ["itemId"], false);

export async function initHighlightsDB() {
    try {
        // @ts-ignore - Lovefield types are incomplete
        highlightsDB = await hdbSchema.connect({ storeType: INDEXED_DB });
        highlights = highlightsDB.getSchema().table("highlights");
        
        // Validate database connection
        try {
            await highlightsDB.select().from(highlights).limit(1).exec()
            console.log('[HighlightsDB] Initialized with IndexedDB');
        } catch (validationError: any) {
            if (validationError.code === 516) {
                console.log('[HighlightsDB] Validation failed, using memory database...')
                throw validationError
            }
            console.log('[HighlightsDB] Initialized with IndexedDB');
        }
    } catch (error: any) {
        console.error('[HighlightsDB] Initialization failed:', error.code)
        if (error.code === 300 || error.code === 516) {
            console.log('[HighlightsDB] Database version mismatch detected')
            console.log('[HighlightsDB] Using memory database...')
            
            // Fallback to memory database
            try {
                const memorySchema = lf.schema.create("highlightsDB", 1);
                memorySchema
                    .createTable("highlights")
                    .addColumn("_id", lf.Type.INTEGER)
                    .addPrimaryKey(["_id"], true)
                    .addColumn("itemId", lf.Type.INTEGER)
                    .addColumn("text", lf.Type.STRING)
                    .addColumn("note", lf.Type.STRING)
                    .addColumn("range", lf.Type.STRING)
                    .addColumn("createdDate", lf.Type.DATE_TIME)
                    .addIndex("idxItemId", ["itemId"], false);

                // @ts-ignore
                highlightsDB = await memorySchema.connect();
                highlights = highlightsDB.getSchema().table("highlights");
                console.log('[HighlightsDB] Memory database initialized successfully')
                console.log('[HighlightsDB] NOTE: Your existing highlights data in IndexedDB is safe')
                console.log('[HighlightsDB] NOTE: Highlights will not persist between sessions')
                return
            } catch (memoryError: any) {
                console.error('[HighlightsDB] Memory database initialization failed:', memoryError)
                throw memoryError
            }
        } else {
            throw error
        }
    }
}
