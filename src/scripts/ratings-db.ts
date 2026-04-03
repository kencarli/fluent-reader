import lf from 'lovefield'

// Lovefield DataStore type - use numeric constant
const INDEXED_DB = 0  // lf.schema.DataStoreType.INDEXED_DB

// @ts-ignore
let db: lf.Database | null = null
// @ts-ignore
let ratings: lf.Table | null = null

export interface ArticleRating {
    itemId: number
    overallScore: number
    industryScore: number
    industryName: string
    industryReason: string
    roleScore: number
    roleName: string
    roleReason: string
    qualityScore: number
    qualityReason: string
    reason: string
    ratedAt: number  // timestamp for lovefield
    model: string
}

// @ts-ignore - lovefield types are incomplete
export async function initRatingsDB(): Promise<void> {
    if (db && ratings) return

    try {
        // Use lovefield's schema create with proper versioning
        const schema = lf.schema.create("ratingsDB", 1)

        schema.createTable('Ratings')
            .addColumn('itemId', lf.Type.INTEGER)
            .addPrimaryKey(['itemId'], false)
            .addColumn('overallScore', lf.Type.NUMBER)
            .addColumn('industryScore', lf.Type.NUMBER)
            .addColumn('industryName', lf.Type.STRING)
            .addColumn('industryReason', lf.Type.STRING)
            .addColumn('roleScore', lf.Type.NUMBER)
            .addColumn('roleName', lf.Type.STRING)
            .addColumn('roleReason', lf.Type.STRING)
            .addColumn('qualityScore', lf.Type.NUMBER)
            .addColumn('qualityReason', lf.Type.STRING)
            .addColumn('reason', lf.Type.STRING)
            .addColumn('ratedAt', lf.Type.DATE_TIME)
            .addColumn('model', lf.Type.STRING)
            .addNullable(['industryReason', 'roleReason', 'qualityReason', 'reason'])
            .addIndex('idx_overall_score', ['overallScore'], false, lf.Order.DESC)

        // @ts-ignore
        db = await schema.connect({ storeType: INDEXED_DB })
        // @ts-ignore
        ratings = db.getSchema().table('Ratings')

        // Validate database connection
        try {
            await db.select().from(ratings).limit(1).exec()
            console.log('[RatingsDB] Initialized with IndexedDB')
        } catch (validationError: any) {
            if (validationError.code === 516) {
                console.log('[RatingsDB] Validation failed, using memory database...')
                throw validationError
            }
            console.log('[RatingsDB] Initialized with IndexedDB')
        }
    } catch (error: any) {
        console.error('[RatingsDB] Initialization failed:', error.code)
        
        // Error 300 or 516: Database version mismatch - use memory database
        if (error.code === 300 || error.code === 516) {
            console.log('[RatingsDB] Database version mismatch detected')
            console.log('[RatingsDB] Using memory database...')
            
            // Fallback to memory database
            try {
                const memorySchema = lf.schema.create("ratingsDB", 1)
                memorySchema.createTable('Ratings')
                    .addColumn('itemId', lf.Type.INTEGER)
                    .addPrimaryKey(['itemId'], false)
                    .addColumn('overallScore', lf.Type.NUMBER)
                    .addColumn('industryScore', lf.Type.NUMBER)
                    .addColumn('industryName', lf.Type.STRING)
                    .addColumn('industryReason', lf.Type.STRING)
                    .addColumn('roleScore', lf.Type.NUMBER)
                    .addColumn('roleName', lf.Type.STRING)
                    .addColumn('roleReason', lf.Type.STRING)
                    .addColumn('qualityScore', lf.Type.NUMBER)
                    .addColumn('qualityReason', lf.Type.STRING)
                    .addColumn('reason', lf.Type.STRING)
                    .addColumn('ratedAt', lf.Type.DATE_TIME)
                    .addColumn('model', lf.Type.STRING)
                    .addNullable(['industryReason', 'roleReason', 'qualityReason', 'reason'])
                    .addIndex('idx_overall_score', ['overallScore'], false, lf.Order.DESC)

                // @ts-ignore
                db = await memorySchema.connect()
                // @ts-ignore
                ratings = db.getSchema().table('Ratings')
                console.log('[RatingsDB] Memory database initialized successfully')
                console.log('[RatingsDB] NOTE: Your existing ratings data in IndexedDB is safe')
                console.log('[RatingsDB] NOTE: Ratings will not persist between sessions')
                return
            } catch (memoryError: any) {
                console.error('[RatingsDB] Memory database initialization failed:', memoryError)
                throw memoryError
            }
        }
        
        throw error
    }
}

// @ts-ignore
export async function saveRating(rating: ArticleRating): Promise<void> {
    if (!db || !ratings) await initRatingsDB()
    
    const row = ratings!.createRow({
        itemId: rating.itemId,
        overallScore: rating.overallScore,
        industryScore: rating.industryScore,
        industryName: rating.industryName,
        industryReason: rating.industryReason,
        roleScore: rating.roleScore,
        roleName: rating.roleName,
        roleReason: rating.roleReason,
        qualityScore: rating.qualityScore,
        qualityReason: rating.qualityReason,
        reason: rating.reason,
        ratedAt: new Date(rating.ratedAt),
        model: rating.model,
    })
    
    await db!.insertOrReplace()
        .into(ratings!)
        .values([row])
        .exec()
}

// @ts-ignore
export async function getRating(itemId: number): Promise<ArticleRating | null> {
    try {
        if (!db || !ratings) await initRatingsDB()

        const results = await db!.select()
            .from(ratings!)
            .where(ratings!.itemId.eq(itemId))
            .exec()

        if (results.length === 0) return null

        const row = results[0] as any
        return {
            itemId: row.itemId,
            overallScore: row.overallScore,
            industryScore: row.industryScore,
            industryName: row.industryName,
            industryReason: row.industryReason,
            roleScore: row.roleScore,
            roleName: row.roleName,
            roleReason: row.roleReason,
            qualityScore: row.qualityScore,
            qualityReason: row.qualityReason,
            reason: row.reason,
            ratedAt: row.ratedAt ? (typeof row.ratedAt.getTime === 'function' ? row.ratedAt.getTime() : row.ratedAt) : Date.now(),
            model: row.model,
        }
    } catch (e) {
        console.error('Failed to get rating for item', itemId, ':', e)
        return null
    }
}

// @ts-ignore
export async function getRatingsByScore(minScore: number): Promise<ArticleRating[]> {
    if (!db || !ratings) await initRatingsDB()
    
    const results = await db!.select()
        .from(ratings!)
        .where(ratings!.overallScore.gte(minScore))
        .orderBy(ratings!.overallScore, lf.Order.DESC)
        .exec()
    
    return results.map(row => {
        const r = row as any
        return {
            itemId: r.itemId,
            overallScore: r.overallScore,
            industryScore: r.industryScore,
            industryName: r.industryName,
            industryReason: r.industryReason,
            roleScore: r.roleScore,
            roleName: r.roleName,
            roleReason: r.roleReason,
            qualityScore: r.qualityScore,
            qualityReason: r.qualityReason,
            reason: r.reason,
            ratedAt: r.ratedAt.getTime(),
            model: r.model,
        }
    })
}

// @ts-ignore
export async function getAllRatings(): Promise<ArticleRating[]> {
    if (!db || !ratings) await initRatingsDB()
    
    const results = await db!.select()
        .from(ratings!)
        .orderBy(ratings!.overallScore, lf.Order.DESC)
        .exec()
    
    return results.map(row => {
        const r = row as any
        return {
            itemId: r.itemId,
            overallScore: r.overallScore,
            industryScore: r.industryScore,
            industryName: r.industryName,
            industryReason: r.industryReason,
            roleScore: r.roleScore,
            roleName: r.roleName,
            roleReason: r.roleReason,
            qualityScore: r.qualityScore,
            qualityReason: r.qualityReason,
            reason: r.reason,
            ratedAt: r.ratedAt.getTime(),
            model: r.model,
        }
    })
}

// @ts-ignore
export async function deleteRating(itemId: number): Promise<void> {
    if (!db || !ratings) await initRatingsDB()
    
    await db!.delete()
        .from(ratings!)
        .where(ratings!.itemId.eq(itemId))
        .exec()
}

// @ts-ignore
export async function getRatedArticleIds(): Promise<number[]> {
    if (!db || !ratings) await initRatingsDB()
    
    const results = await db!.select(ratings!.itemId)
        .from(ratings!)
        .exec()
    
    return results.map(row => (row as any).itemId)
}
