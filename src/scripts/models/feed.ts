import * as db from "../db"
import lf from "lovefield"
import {
    SourceActionTypes,
    INIT_SOURCES,
    ADD_SOURCE,
    DELETE_SOURCE,
    UNHIDE_SOURCE,
    HIDE_SOURCE,
} from "./source"
import {
    ItemActionTypes,
    FETCH_ITEMS,
    RSSItem,
    TOGGLE_HIDDEN,
    applyItemReduction,
} from "./item"
import { ActionStatus, AppThunk, mergeSortedArrays } from "../utils"
import { PageActionTypes, SELECT_PAGE, PageType, APPLY_FILTER } from "./page"
import { semanticSearch } from "../semantic-search"

export enum FilterType {
    None,
    ShowRead = 1 << 0,
    ShowNotStarred = 1 << 1,
    ShowHidden = 1 << 2,
    FullSearch = 1 << 3,
    CaseInsensitive = 1 << 4,
    CreatorSearch = 1 << 5,
    SemanticSearch = 1 << 6,
    RatedOnly = 1 << 7,        // Only show rated articles
    HighRated = 1 << 8,        // Only show highly rated (>=4 stars)

    Default = ShowRead,        // 默认显示未读文章（不要求星标）
    UnreadOnly = ShowNotStarred,
    StarredOnly = ShowRead,
    Toggles = ShowHidden | FullSearch | CaseInsensitive | SemanticSearch | RatedOnly | HighRated,
}
export class FeedFilter {
    type: FilterType
    search: string
    ratedItemIds?: number[]  // Use array instead of Set for Redux serialization
    highRatedItemIds?: number[]  // Use array instead of Set for Redux serialization
    unratedOnly?: boolean  // Filter for unrated items only

    constructor(type: FilterType = null, search = "", ratedItemIds?: number[], highRatedItemIds?: number[], unratedOnly?: boolean) {
        if (
            type === null &&
            (type = window.settings.getFilterType()) === null
        ) {
            type = FilterType.Default | FilterType.CaseInsensitive
        }
        // Remove rating bits from saved filter type (rating filters are temporary)
        const RATING_MASK = 128 | 256  // RatedOnly | HighRated
        type = type & ~RATING_MASK
        
        this.type = type
        this.search = search
        this.ratedItemIds = ratedItemIds
        this.highRatedItemIds = highRatedItemIds
        this.unratedOnly = unratedOnly
    }

    /**
     * Initialize rated item IDs for filtering
     * Call this before using rating filters
     * @param type - Filter type
     * @param search - Search query
     * @param unratedOnly - If true, filter for unrated items only
     */
    static async withRatingIds(type: FilterType, search: string = "", unratedOnly: boolean = false): Promise<FeedFilter> {
        const filter = new FeedFilter(type, search)
        const hasRatedOnly = (type & FilterType.RatedOnly) !== 0
        const hasHighRated = (type & FilterType.HighRated) !== 0
        
        if (hasRatedOnly || hasHighRated || unratedOnly) {
            const { getRatingsByScore } = await import('../ratings-db')
            // Get all rated items
            const ratings = await getRatingsByScore(0)
            filter.ratedItemIds = ratings.map(r => r.itemId)

            // For HighRated filter, also create a set of items with score >= 4.0
            if (hasHighRated) {
                filter.highRatedItemIds = ratings
                    .filter(r => r.overallScore >= 4.0)
                    .map(r => r.itemId)
            }
            // For 3+ star filter (RatedOnly but not HighRated), create a set of items with score >= 3.0
            if (hasRatedOnly && !hasHighRated) {
                filter.highRatedItemIds = ratings
                    .filter(r => r.overallScore >= 3.0)
                    .map(r => r.itemId)
            }
        }
        return filter
    }

static toPredicates(filter: FeedFilter) {
    let type = filter.type
    const predicates = new Array<lf.Predicate>()
    if (!(type & FilterType.ShowRead))
        predicates.push(db.items.hasRead.eq(false))
    if (!(type & FilterType.ShowNotStarred))
        predicates.push(db.items.starred.eq(true))
    if (!(type & FilterType.ShowHidden))
        predicates.push(db.items.hidden.eq(false))
    if (filter.search !== "") {
        const flags = type & FilterType.CaseInsensitive ? "i" : ""
        const regex = RegExp(filter.search, flags)
        if (type & FilterType.FullSearch) {
            predicates.push(
                lf.op.or(
                    db.items.title.match(regex),
                    db.items.snippet.match(regex),
                    lf.op.and(db.items.tags.isNotNull(), db.items.tags.match(regex))
                )
            )
        } else {
            predicates.push(db.items.title.match(regex))
        }
    }
    return predicates
}

    static testItem(filter: FeedFilter, item: RSSItem) {
        let type = filter.type
        let flag = true
        if (!(type & FilterType.ShowRead)) flag = flag && !item.hasRead
        if (!(type & FilterType.ShowNotStarred)) flag = flag && item.starred
        if (!(type & FilterType.ShowHidden)) flag = flag && !item.hidden

        // Rating filters - use Set for efficient lookup
        if (type & (FilterType.RatedOnly | FilterType.HighRated)) {
            if (!filter.ratedItemIds || !filter.ratedItemIds.includes(item._id)) {
                return false
            }
            // For HighRated or 3+ star, check threshold
            if (filter.highRatedItemIds && !filter.highRatedItemIds.includes(item._id)) {
                return false
            }
        }
        
        // Unrated filter
        if (filter.unratedOnly) {
            if (filter.ratedItemIds && filter.ratedItemIds.includes(item._id)) {
                return false
            }
        }

        if (filter.search !== "") {
            const flags = type & FilterType.CaseInsensitive ? "i" : ""
            const regex = RegExp(filter.search, flags)
            if (type & FilterType.FullSearch) {
                flag =
                    flag &&
                    (regex.test(item.title) ||
                        regex.test(item.snippet) ||
                        regex.test(item.tags || ""))
            } else if (type & FilterType.CreatorSearch) {
                flag = flag && regex.test(item.creator || "")
            } else {
                flag = flag && regex.test(item.title)
            }
        }
        return Boolean(flag)
    }
}

export const ALL = "ALL"
export const SOURCE = "SOURCE"

const LOAD_QUANTITY = 50

export class RSSFeed {
    _id: string
    loaded: boolean
    loading: boolean
    allLoaded: boolean
    sids: number[]
    iids: number[]
    filter: FeedFilter

    constructor(id: string = null, sids = [], filter = null) {
        this._id = id
        this.sids = sids
        this.iids = []
        this.loaded = false
        this.allLoaded = false
        this.filter = filter === null ? new FeedFilter() : filter
    }

    static async loadFeed(feed: RSSFeed, skip = 0): Promise<RSSItem[]> {
        
        if (
            feed.filter.search &&
            feed.filter.type & FilterType.SemanticSearch
        ) {
            const settings = window.settings.getIntegrationSettings()
            // Check if any LLM provider is configured
            const hasProvider = settings.openaiApiKey || settings.nvidiaApiKey || settings.deepseekApiKey
            if (hasProvider) {
                const allItems = (await db.itemsDB
                    .select()
                    .from(db.items)
                    .where(db.items.source.in(feed.sids))
                    .exec()) as RSSItem[]

                const itemMap: { [_id: number]: RSSItem } = {}
                for (const item of allItems) {
                    if (item && item._id !== undefined) {
                        itemMap[item._id] = item
                    }
                }

                const semanticResults = await semanticSearch(
                    feed.filter.search,
                    settings,
                    itemMap,
                    LOAD_QUANTITY + skip
                )
                const items = semanticResults
                    .map(r => r.item)
                    .filter(item => item && item._id !== undefined)
                    .slice(skip)
                return items
            }
        }

        const predicates = FeedFilter.toPredicates(feed.filter)
        predicates.push(db.items.source.in(feed.sids))
        try {
            let items = (await db.itemsDB
                .select()
                .from(db.items)
                .where(lf.op.and.apply(null, predicates))
                .orderBy(db.items.date, lf.Order.DESC)
                .skip(skip)
                .limit(LOAD_QUANTITY)
                .exec()) as RSSItem[]

            // Apply rating filter in memory (since ratings are in a separate DB)
            if (feed.filter.unratedOnly) {
                // Show only unrated items
                if (feed.filter.ratedItemIds) {
                    const ratedIdSet = new Set(feed.filter.ratedItemIds)
                    items = items.filter(item => !ratedIdSet.has(item._id))
                }
            } else if (feed.filter.type & (FilterType.RatedOnly | FilterType.HighRated)) {
                // Show only rated items (with optional score threshold)
                if (feed.filter.ratedItemIds) {
                    const ratedIdSet = new Set(feed.filter.ratedItemIds)
                    const highRatedIdSet = feed.filter.highRatedItemIds ? new Set(feed.filter.highRatedItemIds) : null

                    items = items.filter(item => {
                        if (!ratedIdSet.has(item._id)) {
                            return false
                        }
                        // For HighRated or 3+ star, check if score >= threshold
                        if (highRatedIdSet) {
                            if (!highRatedIdSet.has(item._id)) {
                                return false
                            }
                        }
                        return true
                    })
                } else {
                    // No rated items loaded, return empty
                    return []
                }
            }

            return items
        } catch (error) {
            console.error("Database query error:", error)
            return []
        }
    }
}

export type FeedState = {
    [_id: string]: RSSFeed
}

export const INIT_FEEDS = "INIT_FEEDS"
export const INIT_FEED = "INIT_FEED"
export const LOAD_MORE = "LOAD_MORE"
export const DISMISS_ITEMS = "DISMISS_ITEMS"

interface initFeedsAction {
    type: typeof INIT_FEEDS
    status: ActionStatus
}

interface initFeedAction {
    type: typeof INIT_FEED
    status: ActionStatus
    feed?: RSSFeed
    items?: RSSItem[]
    err?
}

interface loadMoreAction {
    type: typeof LOAD_MORE
    status: ActionStatus
    feed: RSSFeed
    items?: RSSItem[]
    err?
}

interface dismissItemsAction {
    type: typeof DISMISS_ITEMS
    fid: string
    iids: Set<number>
}

export type FeedActionTypes =
    | initFeedAction
    | initFeedsAction
    | loadMoreAction
    | dismissItemsAction

export function dismissItems(): AppThunk {
    return (dispatch, getState) => {
        const state = getState()
        let fid = state.page.feedId
        let filter = state.feeds[fid].filter
        let iids = new Set<number>()
        for (let iid of state.feeds[fid].iids) {
            let item = state.items[iid]
            if (!FeedFilter.testItem(filter, item)) {
                iids.add(iid)
            }
        }
        dispatch({
            type: DISMISS_ITEMS,
            fid: fid,
            iids: iids,
        })
    }
}

export function initFeedsRequest(): FeedActionTypes {
    return {
        type: INIT_FEEDS,
        status: ActionStatus.Request,
    }
}
export function initFeedsSuccess(): FeedActionTypes {
    return {
        type: INIT_FEEDS,
        status: ActionStatus.Success,
    }
}

export function initFeedSuccess(
    feed: RSSFeed,
    items: RSSItem[]
): FeedActionTypes {
    return {
        type: INIT_FEED,
        status: ActionStatus.Success,
        items: items,
        feed: feed,
    }
}

export function initFeedFailure(err): FeedActionTypes {
    return {
        type: INIT_FEED,
        status: ActionStatus.Failure,
        err: err,
    }
}

export function initFeeds(force = false): AppThunk<Promise<void>> {
    return (dispatch, getState) => {
        dispatch(initFeedsRequest())
        let promises = new Array<Promise<void>>()
        for (let feed of Object.values(getState().feeds)) {
            if (!feed.loaded || force) {
                let p = RSSFeed.loadFeed(feed)
                    .then(items => {
                        dispatch(initFeedSuccess(feed, items))
                    })
                    .catch(err => {
                        console.log(err)
                        dispatch(initFeedFailure(err))
                    })
                promises.push(p)
            }
        }
        return Promise.allSettled(promises).then(() => {
            dispatch(initFeedsSuccess())
        })
    }
}

export function loadMoreRequest(feed: RSSFeed): FeedActionTypes {
    return {
        type: LOAD_MORE,
        status: ActionStatus.Request,
        feed: feed,
    }
}

export function loadMoreSuccess(
    feed: RSSFeed,
    items: RSSItem[]
): FeedActionTypes {
    return {
        type: LOAD_MORE,
        status: ActionStatus.Success,
        feed: feed,
        items: items,
    }
}

export function loadMoreFailure(feed: RSSFeed, err): FeedActionTypes {
    return {
        type: LOAD_MORE,
        status: ActionStatus.Failure,
        feed: feed,
        err: err,
    }
}

export function loadMore(
    feed: RSSFeed,
    onSuccess: () => void,
    onError: (err: Error) => void
): AppThunk<Promise<void>> {
    return (dispatch, getState) => {
        if (feed.loaded && !feed.loading && !feed.allLoaded) {
            dispatch(loadMoreRequest(feed))
            const state = getState()
            const skipNum = feed.iids.filter(i =>
                FeedFilter.testItem(feed.filter, state.items[i])
            ).length
            return RSSFeed.loadFeed(feed, skipNum)
                .then(items => {
                    dispatch(loadMoreSuccess(feed, items))
                    if (onSuccess) {
                        onSuccess()
                    }
                })
                .catch(e => {
                    console.log(e)
                    dispatch(loadMoreFailure(feed, e))
                    if (onError) {
                        onError(e)
                    }
                })
        }
        return new Promise((_, reject) => {
            reject()
        })
    }
}

export function feedReducer(
    state: FeedState = { [ALL]: new RSSFeed(ALL) },
    action:
        | SourceActionTypes
        | ItemActionTypes
        | FeedActionTypes
        | PageActionTypes
): FeedState {
    switch (action.type) {
        case INIT_SOURCES:
            switch (action.status) {
                case ActionStatus.Success:
                    return {
                        ...state,
                        [ALL]: new RSSFeed(
                            ALL,
                            Object.values(action.sources)
                                .filter(s => !s.hidden)
                                .map(s => s.sid)
                        ),
                    }
                default:
                    return state
            }
        case ADD_SOURCE:
        case UNHIDE_SOURCE:
            switch (action.status) {
                case ActionStatus.Success:
                    return {
                        ...state,
                        [ALL]: new RSSFeed(
                            ALL,
                            [...state[ALL].sids, action.source.sid],
                            state[ALL].filter
                        ),
                    }
                default:
                    return state
            }
        case DELETE_SOURCE:
        case HIDE_SOURCE: {
            let nextState = {}
            for (let [id, feed] of Object.entries(state)) {
                nextState[id] = new RSSFeed(
                    id,
                    feed.sids.filter(sid => sid != action.source.sid),
                    feed.filter
                )
            }
            return nextState
        }
        case APPLY_FILTER: {
            let nextState = {}
            for (let [id, feed] of Object.entries(state)) {
                nextState[id] = {
                    ...feed,
                    filter: action.filter,
                }
            }
            return nextState
        }
        case FETCH_ITEMS:
            switch (action.status) {
                case ActionStatus.Success: {
                    let nextState = { ...state }
                    for (let feed of Object.values(state)) {
                        if (feed.loaded) {
                            let items = action.items.filter(
                                i =>
                                    feed.sids.includes(i.source) &&
                                    FeedFilter.testItem(feed.filter, i)
                            )
                            if (items.length > 0) {
                                let oldItems = feed.iids.map(
                                    id => action.itemState[id]
                                )
                                let nextItems = mergeSortedArrays(
                                    oldItems,
                                    items,
                                    (a, b) =>
                                        b.date.getTime() - a.date.getTime()
                                )
                                nextState[feed._id] = {
                                    ...feed,
                                    iids: nextItems.map(i => i._id),
                                }
                            }
                        }
                    }
                    return nextState
                }
                default:
                    return state
            }
        case DISMISS_ITEMS:
            let nextState = { ...state }
            let feed = state[action.fid]
            nextState[action.fid] = {
                ...feed,
                iids: feed.iids.filter(iid => !action.iids.has(iid)),
            }
            return nextState
        case INIT_FEED:
            switch (action.status) {
                case ActionStatus.Success:
                    return {
                        ...state,
                        [action.feed._id]: {
                            ...action.feed,
                            loaded: true,
                            allLoaded: action.items.length < LOAD_QUANTITY,
                            iids: action.items.map(i => i._id),
                        },
                    }
                default:
                    return state
            }
        case LOAD_MORE:
            switch (action.status) {
                case ActionStatus.Request:
                    return {
                        ...state,
                        [action.feed._id]: {
                            ...action.feed,
                            loading: true,
                        },
                    }
                case ActionStatus.Success:
                    return {
                        ...state,
                        [action.feed._id]: {
                            ...action.feed,
                            loading: false,
                            allLoaded: action.items.length < LOAD_QUANTITY,
                            iids: [
                                ...action.feed.iids,
                                ...action.items.map(i => i._id),
                            ],
                        },
                    }
                case ActionStatus.Failure:
                    return {
                        ...state,
                        [action.feed._id]: {
                            ...action.feed,
                            loading: false,
                        },
                    }
                default:
                    return state
            }
        case TOGGLE_HIDDEN: {
            let nextItem = applyItemReduction(action.item, action.type)
            let filteredFeeds = Object.values(state).filter(
                feed =>
                    feed.loaded && !FeedFilter.testItem(feed.filter, nextItem)
            )
            if (filteredFeeds.length > 0) {
                let nextState = { ...state }
                for (let feed of filteredFeeds) {
                    nextState[feed._id] = {
                        ...feed,
                        iids: feed.iids.filter(id => id != nextItem._id),
                    }
                }
                return nextState
            } else {
                return state
            }
        }
        case SELECT_PAGE:
            switch (action.pageType) {
                case PageType.Sources:
                    return {
                        ...state,
                        [action.menuKey]: new RSSFeed(
                            action.menuKey,
                            action.sids,
                            action.filter
                        ),
                    }
                case PageType.AllArticles:
                    return action.init
                        ? {
                              ...state,
                              [ALL]: {
                                  ...state[ALL],
                                  loaded: false,
                                  filter: action.filter,
                              },
                          }
                        : state
                default:
                    return state
            }
        default:
            return state
    }
}
