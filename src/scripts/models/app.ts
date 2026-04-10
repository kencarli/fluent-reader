import intl from "react-intl-universal"
import {
    INIT_SOURCES,
    SourceActionTypes,
    ADD_SOURCE,
    UPDATE_SOURCE,
    DELETE_SOURCE,
    initSources,
    SourceOpenTarget,
    updateFavicon,
} from "./source"
import { RSSItem, ItemActionTypes, FETCH_ITEMS, fetchItems } from "./item"
import {
    ActionStatus,
    AppThunk,
    getWindowBreakpoint,
    initTouchBarWithTexts,
} from "../utils"
import { INIT_FEEDS, FeedActionTypes, ALL, SOURCE, initFeeds, loadMore } from "./feed"
import {
    SourceGroupActionTypes,
    UPDATE_SOURCE_GROUP,
    ADD_SOURCE_TO_GROUP,
    DELETE_SOURCE_GROUP,
    REMOVE_SOURCE_FROM_GROUP,
    REORDER_SOURCE_GROUPS,
} from "./group"
import {
    PageActionTypes,
    SELECT_PAGE,
    PageType,
    selectAllArticles,
    showItemFromId,
} from "./page"
import { getCurrentLocale, setThemeDefaultFont } from "../settings"
import locales from "../i18n/_locales"
import { SYNC_SERVICE, ServiceActionTypes } from "./service"
import { generateEnhancedDigest } from "../digest-service"
import { pushToDingTalk, pushToWeCom } from "../push-service"
import * as db from "../db"
import lf from "lovefield"
import { translateTitles } from "../translate"
import { RootState } from "../reducer"
import { rateSingleArticle } from "../rating-service"

export const enum ContextMenuType {
    Hidden,
    Item,
    Text,
    View,
    Group,
    Image,
    MarkRead,
    OpenDigest,
    OpenTranslate,
    OpenRating,
}

export const enum AppLogType {
    Info,
    Warning,
    Failure,
    Article,
}

export class AppLog {
    type: AppLogType
    title: string
    details: string | null
    iid?: number
    time: Date

    constructor(
        type: AppLogType,
        title: string,
        details: string = null,
        iid: number = null
    ) {
        this.type = type
        this.title = title
        this.details = details
        this.iid = iid
        this.time = new Date()
    }
}

export class AppState {
    locale = null as string
    sourceInit = false
    feedInit = false
    syncing = false
    fetchingItems = false
    fetchingProgress = 0
    fetchingTotal = 0
    lastFetched = new Date()
    menu = getWindowBreakpoint() && window.settings.getDefaultMenu()
    menuKey = ALL
    title = ""
    settings = {
        display: false,
        changed: false,
        sids: new Array<number>(),
        saving: false,
    }
    logMenu = {
        display: false,
        notify: false,
        logs: new Array<AppLog>(),
    }
    digestOn = false
    digestGenerating = false
    translateOn = false
    translating = false
    translateProgress = { completed: 0, total: 0 }
    translateCompleteMessage: string | null = null  // 翻译完成通知消息

    contextMenu: {
        type: ContextMenuType
        event?: MouseEvent | string
        position?: [number, number]
        target?: [RSSItem, string] | number[] | [string, string]
    }

    constructor() {
        this.contextMenu = {
            type: ContextMenuType.Hidden,
        }
    }
}

export const CLOSE_CONTEXT_MENU = "CLOSE_CONTEXT_MENU"
export const OPEN_ITEM_MENU = "OPEN_ITEM_MENU"
export const OPEN_TEXT_MENU = "OPEN_TEXT_MENU"
export const OPEN_VIEW_MENU = "OPEN_VIEW_MENU"
export const OPEN_GROUP_MENU = "OPEN_GROUP_MENU"
export const OPEN_IMAGE_MENU = "OPEN_IMAGE_MENU"
export const OPEN_MARK_ALL_MENU = "OPEN_MARK_ALL_MENU"
export const OPEN_DIGEST_MENU = "OPEN_DIGEST_MENU"
export const OPEN_TRANSLATE_MENU = "OPEN_TRANSLATE_MENU"
export const OPEN_RATING_MENU = "OPEN_RATING_MENU"

interface CloseContextMenuAction {
    type: typeof CLOSE_CONTEXT_MENU
}

interface OpenItemMenuAction {
    type: typeof OPEN_ITEM_MENU
    event: MouseEvent
    item: RSSItem
    feedId: string
}

interface OpenTextMenuAction {
    type: typeof OPEN_TEXT_MENU
    position: [number, number]
    item: [string, string]
}

interface OpenViewMenuAction {
    type: typeof OPEN_VIEW_MENU
}

interface OpenMarkAllMenuAction {
    type: typeof OPEN_MARK_ALL_MENU
}

interface OpenDigestMenuAction {
    type: typeof OPEN_DIGEST_MENU
    event?: MouseEvent
}

interface OpenTranslateMenuAction {
    type: typeof OPEN_TRANSLATE_MENU
    event?: MouseEvent
}

interface OpenRatingMenuAction {
    type: typeof OPEN_RATING_MENU
    event?: MouseEvent
}

interface OpenGroupMenuAction {
    type: typeof OPEN_GROUP_MENU
    event: MouseEvent
    sids: number[]
}

interface OpenImageMenuAction {
    type: typeof OPEN_IMAGE_MENU
    position: [number, number]
}

export type ContextMenuActionTypes =
    | CloseContextMenuAction
    | OpenItemMenuAction
    | OpenTextMenuAction
    | OpenViewMenuAction
    | OpenGroupMenuAction
    | OpenImageMenuAction
    | OpenMarkAllMenuAction
    | OpenDigestMenuAction
    | OpenTranslateMenuAction
    | OpenRatingMenuAction

export const TOGGLE_LOGS = "TOGGLE_LOGS"
export const PUSH_NOTIFICATION = "PUSH_NOTIFICATION"

interface ToggleLogMenuAction {
    type: typeof TOGGLE_LOGS
}

interface PushNotificationAction {
    type: typeof PUSH_NOTIFICATION
    iid: number
    title: string
    source: string
}

export type LogMenuActionType = ToggleLogMenuAction | PushNotificationAction

export const TOGGLE_MENU = "TOGGLE_MENU"

export interface MenuActionTypes {
    type: typeof TOGGLE_MENU
}

export const TOGGLE_DIGEST = "TOGGLE_DIGEST"
export interface ToggleDigestAction {
    type: typeof TOGGLE_DIGEST
    date?: Date | null  // 时间范围，null 表示所有文章
}

export const TOGGLE_TRANSLATE = "TOGGLE_TRANSLATE"
export interface ToggleTranslateAction {
    type: typeof TOGGLE_TRANSLATE
}

export const START_TRANSLATE = "START_TRANSLATE"
export interface StartTranslateAction {
    type: typeof START_TRANSLATE
    payload: {
        titles: string[]
        sourceIds?: number[]
        date?: Date | null  // 时间范围
    }
}

export const START_TRANSLATE_WITH_TIME_RANGE = "START_TRANSLATE_WITH_TIME_RANGE"
export interface StartTranslateWithTimeRangeAction {
    type: typeof START_TRANSLATE_WITH_TIME_RANGE
    date?: Date | null
}

export const TRANSLATE_PROGRESS = "TRANSLATE_PROGRESS"
export interface TranslateProgressAction {
    type: typeof TRANSLATE_PROGRESS
    payload: {
        completed: number
        total: number
    }
}

export const TRANSLATE_COMPLETE = "TRANSLATE_COMPLETE"
export interface TranslateCompleteAction {
    type: typeof TRANSLATE_COMPLETE
    payload: {
        translatedTitles: string[]
    }
}

export const TRANSLATE_COMPLETE_NOTIFY = "TRANSLATE_COMPLETE_NOTIFY"
export interface TranslateCompleteNotifyAction {
    type: typeof TRANSLATE_COMPLETE_NOTIFY
    payload: {
        message: string
    }
}

export const CLEAR_TRANSLATE_NOTIFICATION = "CLEAR_TRANSLATE_NOTIFICATION"
export interface ClearTranslateNotificationAction {
    type: typeof CLEAR_TRANSLATE_NOTIFICATION
}

export const SET_DIGEST_GENERATING = "SET_DIGEST_GENERATING"
export interface SetDigestGeneratingAction {
    type: typeof SET_DIGEST_GENERATING
    payload: {
        isGenerating: boolean
    }
}

export const TOGGLE_SETTINGS = "TOGGLE_SETTINGS"
export const SAVE_SETTINGS = "SAVE_SETTINGS"
export const FREE_MEMORY = "FREE_MEMORY"

interface ToggleSettingsAction {
    type: typeof TOGGLE_SETTINGS
    open: boolean
    sids: number[]
}
interface SaveSettingsAction {
    type: typeof SAVE_SETTINGS
}
interface FreeMemoryAction {
    type: typeof FREE_MEMORY
    iids: Set<number>
}
export type SettingsActionTypes =
    | ToggleSettingsAction
    | SaveSettingsAction
    | FreeMemoryAction

export function closeContextMenu(): AppThunk {
    return (dispatch, getState) => {
        if (getState().app.contextMenu.type !== ContextMenuType.Hidden) {
            dispatch({ type: CLOSE_CONTEXT_MENU })
        }
    }
}

export function openItemMenu(
    item: RSSItem,
    feedId: string,
    event: React.MouseEvent
): ContextMenuActionTypes {
    return {
        type: OPEN_ITEM_MENU,
        event: event.nativeEvent,
        item: item,
        feedId: feedId,
    }
}

export function openTextMenu(
    position: [number, number],
    text: string,
    url: string = null
): ContextMenuActionTypes {
    return {
        type: OPEN_TEXT_MENU,
        position: position,
        item: [text, url],
    }
}

export const openViewMenu = (): ContextMenuActionTypes => ({
    type: OPEN_VIEW_MENU,
})

export function openGroupMenu(
    sids: number[],
    event: React.MouseEvent
): ContextMenuActionTypes {
    return {
        type: OPEN_GROUP_MENU,
        event: event.nativeEvent,
        sids: sids,
    }
}

export function openImageMenu(
    position: [number, number]
): ContextMenuActionTypes {
    return {
        type: OPEN_IMAGE_MENU,
        position: position,
    }
}

export const openMarkAllMenu = (): ContextMenuActionTypes => ({
    type: OPEN_MARK_ALL_MENU,
})

export const openDigestMenu = (): ContextMenuActionTypes => ({
    type: OPEN_DIGEST_MENU,
})

export const openTranslateMenu = (): ContextMenuActionTypes => ({
    type: OPEN_TRANSLATE_MENU,
})

export const openRatingMenu = (): ContextMenuActionTypes => ({
    type: OPEN_RATING_MENU,
})

export function toggleMenu(): AppThunk {
    return (dispatch, getState) => {
        dispatch({ type: TOGGLE_MENU })
        window.settings.setDefaultMenu(getState().app.menu)
    }
}

export const toggleLogMenu = () => ({ type: TOGGLE_LOGS })

export function toggleDigest(date?: Date | null): AppThunk {
    return (dispatch, getState) => {
        dispatch({ type: TOGGLE_DIGEST, date })
    }
}

export const toggleTranslate = () => ({ type: TOGGLE_TRANSLATE })

export const setDigestGenerating = (isGenerating: boolean) => ({
    type: SET_DIGEST_GENERATING,
    payload: { isGenerating }
})

// Translation actions
export const startTranslate = (titles: string[], sourceIds?: number[], date?: Date | null) => ({
    type: START_TRANSLATE,
    payload: { titles, sourceIds, date }
})

export const startTranslateWithTimeRange = (date?: Date | null): AppThunk<Promise<void>> => {
    return async (dispatch, getState) => {
        try {
            const storeState: RootState = getState()
            const feedId = storeState.page.feedId
            const groups = storeState.groups

            let items: RSSItem[] = []

            if (feedId === ALL) {
                // All articles - get recent 50 from all sources
                let query
                if (date) {
                    query = db.itemsDB
                        .select()
                        .from(db.items)
                        .where(db.items.date.gte(date))
                        .orderBy(db.items.date, lf.Order.DESC)
                        .limit(50)
                } else {
                    query = db.itemsDB
                        .select()
                        .from(db.items)
                        .orderBy(db.items.date, lf.Order.DESC)
                        .limit(50)
                }
                items = await query.exec() as RSSItem[]
            } else if (feedId === SOURCE) {
                // Sources view - no articles to translate
                alert(intl.get("translate.selectSource"))
                return
            } else if (feedId.startsWith("s-")) {
                // Single source
                const sourceId = parseInt(feedId.substring(2))
                let query
                if (date) {
                    query = db.itemsDB
                        .select()
                        .from(db.items)
                        .where(lf.op.and(
                            db.items.source.eq(sourceId),
                            db.items.date.gte(date)
                        ))
                        .orderBy(db.items.date, lf.Order.DESC)
                        .limit(50)
                } else {
                    query = db.itemsDB
                        .select()
                        .from(db.items)
                        .where(db.items.source.eq(sourceId))
                        .orderBy(db.items.date, lf.Order.DESC)
                        .limit(50)
                }
                items = await query.exec() as RSSItem[]
            } else if (feedId.startsWith("g-")) {
                // Group - get all sources in group
                const groupIndex = parseInt(feedId.substring(2))
                const group = groups[groupIndex]
                if (group && group.sids) {
                    let query
                    if (date) {
                        query = db.itemsDB
                            .select()
                            .from(db.items)
                            .where(lf.op.and(
                                db.items.source.in(group.sids),
                                db.items.date.gte(date)
                            ))
                            .orderBy(db.items.date, lf.Order.DESC)
                            .limit(50)
                    } else {
                        query = db.itemsDB
                            .select()
                            .from(db.items)
                            .where(db.items.source.in(group.sids))
                            .orderBy(db.items.date, lf.Order.DESC)
                            .limit(50)
                    }
                    items = await query.exec() as RSSItem[]
                }
            }

            if (items.length === 0) {
                alert(intl.get("translate.noArticlesFound"))
                return
            }

            const titlesToTranslate = items.map(i => i.title)

            // Start translation
            dispatch(startTranslate(titlesToTranslate, undefined, date))

            const translatedTitles = await translateTitles(
                titlesToTranslate,
                (completed, total) => {
                    dispatch(translateProgress(completed, total))
                }
            )

            dispatch(translateComplete(translatedTitles))
            dispatch(translateCompleteNotify(intl.get("translate.completed", { count: translatedTitles.length })))

            // Store translated titles in session storage (temporary solution)
            const translations = {}
            items.forEach((item, index) => {
                if (translatedTitles[index] !== item.title) {
                    translations[item._id] = translatedTitles[index]
                }
            })
            sessionStorage.setItem('titleTranslations', JSON.stringify(translations))

            console.log("Translation complete:", translatedTitles.length, "titles")
        } catch (error) {
            console.error("Translation failed:", error)
            dispatch(translateComplete([]))
        }
    }
}

export const translateProgress = (completed: number, total: number) => ({
    type: TRANSLATE_PROGRESS,
    payload: { completed, total }
})

export const translateComplete = (translatedTitles: string[]) => ({
    type: TRANSLATE_COMPLETE,
    payload: { translatedTitles }
})

export const translateCompleteNotify = (message: string) => ({
    type: TRANSLATE_COMPLETE_NOTIFY,
    payload: { message }
})

export const clearTranslateNotification = () => ({
    type: CLEAR_TRANSLATE_NOTIFICATION
})

export const saveSettings = () => ({ type: SAVE_SETTINGS })

export const toggleSettings = (open = true, sids = new Array<number>()) => ({
    type: TOGGLE_SETTINGS,
    open: open,
    sids: sids,
})

export function exitSettings(): AppThunk<Promise<void>> {
    return async (dispatch, getState) => {
        if (!getState().app.settings.saving) {
            if (getState().app.settings.changed) {
                dispatch(saveSettings())
                dispatch(selectAllArticles(true))
                await dispatch(initFeeds(true))
                dispatch(toggleSettings(false))
                freeMemory()
            } else {
                dispatch(toggleSettings(false))
            }
        }
    }
}

function freeMemory(): AppThunk {
    return (dispatch, getState) => {
        const iids = new Set<number>()
        for (let feed of Object.values(getState().feeds)) {
            if (feed.loaded) feed.iids.forEach(iids.add, iids)
        }
        dispatch({
            type: FREE_MEMORY,
            iids: iids,
        })
    }
}

let fetchTimeout: NodeJS.Timeout
export function setupAutoFetch(): AppThunk {
    return (dispatch, getState) => {
        clearTimeout(fetchTimeout)
        const setupTimeout = (interval?: number) => {
            if (!interval) interval = window.settings.getFetchInterval()
            if (interval) {
                fetchTimeout = setTimeout(() => {
                    let state = getState()
                    if (!state.app.settings.display) {
                        if (!state.app.fetchingItems) dispatch(fetchItems(true))
                    } else {
                        setupTimeout(1)
                    }
                }, interval * 60000)
            }
        }
        setupTimeout()
    }
}

let digestInterval: NodeJS.Timeout
export function setupScheduledDigest(): AppThunk {
    return (dispatch, getState) => {
        if (digestInterval) clearInterval(digestInterval)
        digestInterval = setInterval(async () => {
            const settings = window.settings.getIntegrationSettings()
            if (!settings.autoPushEnabled || !settings.digestTime) return

            // Check if any LLM provider is configured (including Ollama)
            const hasLLMProvider = settings.openaiApiKey || 
                                   settings.nvidiaApiKey || 
                                   settings.deepseekApiKey || 
                                   (settings.ollamaApiUrl && settings.ollamaModel)
            if (!hasLLMProvider) return

            const now = new Date()
            const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
            const dateStr = now.toDateString()

            if (timeStr === settings.digestTime && settings.lastDigestDate !== dateStr) {
                // Trigger auto digest
                try {
                    const topics = settings.digestTopics ? settings.digestTopics.split(',').map(t => t.trim()) : []
                    const state = getState()
                    const briefing = await generateEnhancedDigest({
                        settings: settings,
                        language: state.app.locale,
                        topics: topics,
                        dalleEnabled: settings.dalleEnabled,
                        sourceIds: settings.digestSourceIds,
                        groupIds: settings.digestGroupIds,
                        groups: state.groups
                    })

                    // Push to enabled services
                    if (settings.dingtalkWebhook) {
                        await pushToDingTalk(settings.dingtalkWebhook, "Daily AI Briefing", briefing.content)
                    }
                    if (settings.wecomWebhook) {
                        await pushToWeCom(settings.wecomWebhook, briefing.content)
                    }

                    // Update last push date
                    window.settings.setIntegrationSettings({ ...settings, lastDigestDate: dateStr })
                } catch (e) {
                    console.error("Scheduled digest failed:", e)
                }
            }
        }, 60000) // Check every minute
    }
}

// Auto-rate new articles when rating is enabled
export function setupAutoRating(): AppThunk {
    return (dispatch, getState) => {
        const checkAndRate = async () => {
            const settings = window.settings.getIntegrationSettings()
            
            if (!settings.ratingEnabled || !settings.ratingAutoRate) {
                return
            }
            
            // Use ratingModel if specified, otherwise fall back to ollamaModel
            if (!settings.ollamaApiUrl || !(settings.ratingModel || settings.ollamaModel)) {
                return
            }
            
            const state = getState()
            const items = state.items
            
            // Find unread, unrated articles
            const { rateSingleArticle } = await import('../rating-service')
            const { getRatedArticleIds } = await import('../ratings-db')
            
            const ratedIds = await getRatedArticleIds()
            
            for (const key in items) {
                const item = items[key]
                if (!item.hasRead && !ratedIds.includes(item._id)) {
                    try {
                        console.log(`Auto-rating article ${item._id}: ${item.title}`)
                        await rateSingleArticle(item, settings)
                    } catch (e) {
                        console.error(`Failed to auto-rate article ${item._id}:`, e)
                    }
                }
            }
        }
        
        // Check every 5 minutes
        const ratingInterval = setInterval(checkAndRate, 300000)
        
        return () => clearInterval(ratingInterval)
    }
}


export function pushNotification(item: RSSItem): AppThunk {
    return (dispatch, getState) => {
        const sourceName = getState().sources[item.source].name
        if (!window.utils.isFocused()) {
            const options = { body: sourceName } as any
            if (item.thumb) options.icon = item.thumb
            const notification = new Notification(item.title, options)
            notification.onclick = () => {
                const state = getState()
                if (
                    state.sources[item.source].openTarget ===
                    SourceOpenTarget.External
                ) {
                    window.utils.openExternal(item.link)
                } else if (!state.app.settings.display) {
                    window.utils.focus()
                    dispatch(showItemFromId(item._id))
                }
            }
        }
        dispatch({
            type: PUSH_NOTIFICATION,
            iid: item._id,
            title: item.title,
            source: sourceName,
        })
    }
}

export const INIT_INTL = "INIT_INTL"
export interface InitIntlAction {
    type: typeof INIT_INTL
    locale: string
}
export const initIntlDone = (locale: string): InitIntlAction => {
    document.documentElement.lang = locale
    setThemeDefaultFont(locale)
    return {
        type: INIT_INTL,
        locale: locale,
    }
}

export function initIntl(): AppThunk<Promise<void>> {
    return dispatch => {
        let locale = getCurrentLocale()
        return intl
            .init({
                currentLocale: locale,
                locales: locales,
                fallbackLocale: "en-US",
            })
            .then(() => {
                dispatch(initIntlDone(locale))
            })
    }
}

export function initApp(): AppThunk {
    return (dispatch, getState) => {
        document.body.classList.add(window.utils.platform)
        dispatch(initIntl())
            .then(async () => {
                if (window.utils.platform === "darwin") initTouchBarWithTexts()
                // Ensure default filter type shows all articles (including read)
                // Only set if not already configured
                const currentFilter = window.settings.getFilterType()
                if (currentFilter === null || currentFilter === undefined) {
                    // 0 = FilterType.None (show all), | 16 = CaseInsensitive for search
                    window.settings.setFilterType(0 | 16)
                }
                await dispatch(initSources())
            })
            .then(async () => {
                // Fetch new items from sources FIRST (background mode, won't dismiss items)
                await dispatch(fetchItems(true))
                // THEN initialize feeds with the fetched items
                await dispatch(initFeeds())
                // Then select all articles page with init=true to reload feeds
                dispatch(selectAllArticles(true))
            })
            .then(() => {
                dispatch(updateFavicon())
                dispatch(setupScheduledDigest())
                dispatch(setupAutoRating())  // Start auto-rating
            })
    }
}

export function appReducer(
    state = new AppState(),
    action:
        | SourceActionTypes
        | ItemActionTypes
        | ContextMenuActionTypes
        | SettingsActionTypes
        | InitIntlAction
        | MenuActionTypes
        | LogMenuActionType
        | FeedActionTypes
        | PageActionTypes
        | SourceGroupActionTypes
        | ServiceActionTypes
        | ToggleDigestAction
        | ToggleTranslateAction
        | StartTranslateAction
        | TranslateProgressAction
        | TranslateCompleteAction
        | TranslateCompleteNotifyAction
        | ClearTranslateNotificationAction
        | OpenDigestMenuAction
        | OpenTranslateMenuAction
        | SetDigestGeneratingAction
): AppState {
    switch (action.type) {
        case TOGGLE_DIGEST:
            return {
                ...state,
                digestOn: !state.digestOn,
            }
        case TOGGLE_TRANSLATE:
            return {
                ...state,
                translateOn: !state.translateOn,
            }
        case SET_DIGEST_GENERATING:
            return {
                ...state,
                digestGenerating: action.payload.isGenerating,
            }
        case START_TRANSLATE:
            return {
                ...state,
                translating: true,
                translateProgress: { completed: 0, total: action.payload.titles.length }
            }
        case TRANSLATE_PROGRESS:
            return {
                ...state,
                translateProgress: action.payload
            }
        case TRANSLATE_COMPLETE:
            return {
                ...state,
                translating: false,
                translateProgress: { completed: 0, total: 0 },
                translateCompleteMessage: intl.get("translate.completed", { count: action.payload.translatedTitles.length })
            }
        case TRANSLATE_COMPLETE_NOTIFY:
            return {
                ...state,
                translateCompleteMessage: action.payload.message
            }
        case CLEAR_TRANSLATE_NOTIFICATION:
            return {
                ...state,
                translateCompleteMessage: null
            }
        case INIT_INTL:
            return {
                ...state,
                locale: action.locale,
            }
        case INIT_SOURCES:
            switch (action.status) {
                case ActionStatus.Success:
                    return {
                        ...state,
                        sourceInit: true,
                    }
                default:
                    return state
            }
        case ADD_SOURCE:
            switch (action.status) {
                case ActionStatus.Request:
                    return {
                        ...state,
                        fetchingItems: true,
                        settings: {
                            ...state.settings,
                            changed: true,
                            saving: true,
                        },
                    }
                default:
                    return {
                        ...state,
                        fetchingItems: state.fetchingTotal !== 0,
                        settings: {
                            ...state.settings,
                            saving: action.batch,
                        },
                    }
            }
        case UPDATE_SOURCE:
        case DELETE_SOURCE:
        case UPDATE_SOURCE_GROUP:
        case ADD_SOURCE_TO_GROUP:
        case REMOVE_SOURCE_FROM_GROUP:
        case REORDER_SOURCE_GROUPS:
        case DELETE_SOURCE_GROUP:
            return {
                ...state,
                settings: {
                    ...state.settings,
                    changed: true,
                },
            }
        case INIT_FEEDS:
            switch (action.status) {
                case ActionStatus.Request:
                    return state
                default:
                    return {
                        ...state,
                        feedInit: true,
                    }
            }
        case SYNC_SERVICE:
            switch (action.status) {
                case ActionStatus.Request:
                    return {
                        ...state,
                        syncing: true,
                    }
                case ActionStatus.Failure:
                    return {
                        ...state,
                        syncing: false,
                        logMenu: {
                            ...state.logMenu,
                            notify: true,
                            logs: [
                                ...state.logMenu.logs,
                                new AppLog(
                                    AppLogType.Failure,
                                    intl.get("log.syncFailure"),
                                    String(action.err)
                                ),
                            ],
                        },
                    }
                default:
                    return {
                        ...state,
                        syncing: false,
                    }
            }
        case FETCH_ITEMS:
            switch (action.status) {
                case ActionStatus.Request:
                    return {
                        ...state,
                        fetchingItems: true,
                        fetchingProgress: 0,
                        fetchingTotal: action.fetchCount,
                    }
                case ActionStatus.Failure:
                    return {
                        ...state,
                        logMenu: {
                            ...state.logMenu,
                            notify: !state.logMenu.display,
                            logs: [
                                ...state.logMenu.logs,
                                new AppLog(
                                    AppLogType.Failure,
                                    intl.get("log.fetchFailure", {
                                        name: action.errSource.name,
                                    }),
                                    String(action.err)
                                ),
                            ],
                        },
                    }
                case ActionStatus.Success:
                    return {
                        ...state,
                        fetchingItems: false,
                        fetchingTotal: 0,
                        logMenu:
                            action.items.length == 0
                                ? state.logMenu
                                : {
                                    ...state.logMenu,
                                    logs: [
                                        ...state.logMenu.logs,
                                        new AppLog(
                                            AppLogType.Info,
                                            intl.get("log.fetchSuccess", {
                                                count: action.items.length,
                                            })
                                        ),
                                    ],
                                },
                    }
                case ActionStatus.Intermediate:
                    return {
                        ...state,
                        fetchingProgress: state.fetchingProgress + 1,
                    }
                default:
                    return state
            }
        case SELECT_PAGE:
            switch (action.pageType) {
                case PageType.AllArticles:
                    return {
                        ...state,
                        menu: state.menu && action.keepMenu,
                        menuKey: ALL,
                        title: intl.get("allArticles"),
                    }
                case PageType.Sources:
                    return {
                        ...state,
                        menu: state.menu && action.keepMenu,
                        menuKey: action.menuKey,
                        title: action.title,
                    }
            }
        case CLOSE_CONTEXT_MENU:
            return {
                ...state,
                contextMenu: {
                    type: ContextMenuType.Hidden,
                },
            }
        case OPEN_ITEM_MENU:
            return {
                ...state,
                contextMenu: {
                    type: ContextMenuType.Item,
                    event: action.event,
                    target: [action.item, action.feedId],
                },
            }
        case OPEN_TEXT_MENU:
            return {
                ...state,
                contextMenu: {
                    type: ContextMenuType.Text,
                    position: action.position,
                    target: action.item,
                },
            }
        case OPEN_VIEW_MENU:
            return {
                ...state,
                contextMenu: {
                    type:
                        state.contextMenu.type === ContextMenuType.View
                            ? ContextMenuType.Hidden
                            : ContextMenuType.View,
                    event: "#view-toggle",
                },
            }
        case OPEN_GROUP_MENU:
            return {
                ...state,
                contextMenu: {
                    type: ContextMenuType.Group,
                    event: action.event,
                    target: action.sids,
                },
            }
        case OPEN_IMAGE_MENU:
            return {
                ...state,
                contextMenu: {
                    type: ContextMenuType.Image,
                    position: action.position,
                },
            }
        case OPEN_MARK_ALL_MENU:
            return {
                ...state,
                contextMenu: {
                    type:
                        state.contextMenu.type === ContextMenuType.MarkRead
                            ? ContextMenuType.Hidden
                            : ContextMenuType.MarkRead,
                    event: "#mark-all-toggle",
                },
            }
        case OPEN_DIGEST_MENU:
            return {
                ...state,
                contextMenu: {
                    type:
                        state.contextMenu.type === ContextMenuType.OpenDigest
                            ? ContextMenuType.Hidden
                            : ContextMenuType.OpenDigest,
                    event: "#digest-toggle",
                },
            }
        case OPEN_TRANSLATE_MENU:
            return {
                ...state,
                contextMenu: {
                    type:
                        state.contextMenu.type === ContextMenuType.OpenTranslate
                            ? ContextMenuType.Hidden
                            : ContextMenuType.OpenTranslate,
                    event: "#translate-toggle",
                },
            }
        case OPEN_RATING_MENU:
            return {
                ...state,
                contextMenu: {
                    type:
                        state.contextMenu.type === ContextMenuType.OpenRating
                            ? ContextMenuType.Hidden
                            : ContextMenuType.OpenRating,
                    event: "#rating-toggle",
                },
            }
        case TOGGLE_MENU:
            return {
                ...state,
                menu: !state.menu,
            }
        case SAVE_SETTINGS:
            return {
                ...state,
                settings: {
                    ...state.settings,
                    display: true,
                    changed: true,
                    saving: !state.settings.saving,
                },
            }
        case TOGGLE_SETTINGS:
            return {
                ...state,
                settings: {
                    display: action.open,
                    changed: false,
                    sids: action.sids,
                    saving: false,
                },
            }
        case TOGGLE_LOGS:
            return {
                ...state,
                logMenu: {
                    ...state.logMenu,
                    display: !state.logMenu.display,
                    notify: false,
                },
            }
        case PUSH_NOTIFICATION:
            return {
                ...state,
                logMenu: {
                    ...state.logMenu,
                    notify: true,
                    logs: [
                        ...state.logMenu.logs,
                        new AppLog(
                            AppLogType.Article,
                            action.title,
                            action.source,
                            action.iid
                        ),
                    ],
                },
            }
        default:
            return state
    }
}
