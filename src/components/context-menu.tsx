import * as React from "react"
import intl from "react-intl-universal"
import QRCode from "qrcode.react"
import {
    cutText,
    webSearch,
    getSearchEngineName,
    platformCtrl,
} from "../scripts/utils"
import {
    ContextualMenu,
    IContextualMenuItem,
    ContextualMenuItemType,
    DirectionalHint,
} from "office-ui-fabric-react/lib/ContextualMenu"
import { closeContextMenu, ContextMenuType, toggleDigest, startTranslate, translateProgress, translateComplete, openRatingMenu, setDigestGenerating } from "../scripts/models/app"
import { getFeedScope, getSourceIdsFromCurrentFeed } from "../scripts/models/item"
import {
    markAllRead,
    markRead,
    markUnread,
    RSSItem,
    toggleHidden,
    toggleStarred,
} from "../scripts/models/item"
import { ViewType, ImageCallbackTypes, ViewConfigs } from "../schema-types"
import { FilterType, ALL, SOURCE } from "../scripts/models/feed"
import { useAppDispatch, useAppSelector, RootState } from "../scripts/reducer"
import * as db from "../scripts/db"
import lf from "lovefield"
import RatingMenu from "./rating-menu"
import {
    setViewConfigs,
    showItem,
    switchFilter,
    switchView,
    toggleFilter,
} from "../scripts/models/page"

export const shareSubmenu = (item: RSSItem): IContextualMenuItem[] => [
    { key: "qr", url: item.link, onRender: renderShareQR },
]

export const renderShareQR = (item: IContextualMenuItem) => (
    <div className="qr-container">
        <QRCode value={item.url} size={150} renderAs="svg" />
    </div>
)

function getSearchItem(text: string): IContextualMenuItem {
    const engine = window.settings.getSearchEngine()
    return {
        key: "searchText",
        text: intl.get("context.search", {
            text: cutText(text, 15),
            engine: getSearchEngineName(engine),
        }),
        iconProps: { iconName: "Search" },
        onClick: () => webSearch(text, engine),
    }
}

export function ContextMenu() {
    const { type } = useAppSelector(state => state.app.contextMenu)

    switch (type) {
        case ContextMenuType.Hidden:
            return null
        case ContextMenuType.Item:
            return <ItemContextMenu />
        case ContextMenuType.Text:
            return <TextContextMenu />
        case ContextMenuType.Image:
            return <ImageContextMenu />
        case ContextMenuType.View:
            return <ViewContextMenu />
        case ContextMenuType.Group:
            return <GroupContextMenu />
        case ContextMenuType.MarkRead:
            return <MarkReadContextMenu />
        case ContextMenuType.OpenDigest:
            return <OpenDigestMenu />
        case ContextMenuType.OpenTranslate:
            return <OpenTranslateMenu />
        case ContextMenuType.OpenRating:
            return <RatingMenuWrapper />
    }
}

function RatingMenuWrapper() {
    const { event, position } = useAppSelector(state => state.app.contextMenu)
    const dispatch = useAppDispatch()

    return (
        <RatingMenu
            target={null}
            event={event as any || undefined}
            position={position || undefined}
            onDismiss={() => dispatch(closeContextMenu())}
        />
    )
}

function ItemContextMenu() {
    const dispatch = useAppDispatch()
    const viewConfigs = useAppSelector(state => state.page.viewConfigs)
    const target = useAppSelector(state => state.app.contextMenu.target)
    const item = target[0] as RSSItem
    const feedId = target[1] as string

    const menuItems: IContextualMenuItem[] = [
        {
            key: "showItem",
            text: intl.get("context.read"),
            iconProps: { iconName: "TextDocument" },
            onClick: () => {
                dispatch(markRead(item))
                dispatch(showItem(feedId, item))
            },
        },
        {
            key: "openInBrowser",
            text: intl.get("openExternal"),
            iconProps: { iconName: "NavigateExternalInline" },
            onClick: e => {
                dispatch(markRead(item))
                window.utils.openExternal(item.link, platformCtrl(e))
            },
        },
        {
            key: "markAsRead",
            text: item.hasRead
                ? intl.get("article.markUnread")
                : intl.get("article.markRead"),
            iconProps: item.hasRead
                ? {
                      iconName: "RadioBtnOn",
                      style: { fontSize: 14, textAlign: "center" },
                  }
                : { iconName: "StatusCircleRing" },
            onClick: () => {
                if (item.hasRead) {
                    dispatch(markUnread(item))
                } else {
                    dispatch(markRead(item))
                }
            },
            split: true,
            subMenuProps: {
                items: [
                    {
                        key: "markBelow",
                        text: intl.get("article.markBelow"),
                        iconProps: {
                            iconName: "Down",
                            style: { fontSize: 14 },
                        },
                        onClick: () => {
                            dispatch(markAllRead(null, item.date))
                        },
                    },
                    {
                        key: "markAbove",
                        text: intl.get("article.markAbove"),
                        iconProps: {
                            iconName: "Up",
                            style: { fontSize: 14 },
                        },
                        onClick: () => {
                            dispatch(markAllRead(null, item.date, false))
                        },
                    },
                ],
            },
        },
        {
            key: "toggleStarred",
            text: item.starred
                ? intl.get("article.unstar")
                : intl.get("article.star"),
            iconProps: {
                iconName: item.starred ? "FavoriteStar" : "FavoriteStarFill",
            },
            onClick: () => {
                dispatch(toggleStarred(item))
            },
        },
        {
            key: "toggleHidden",
            text: item.hidden
                ? intl.get("article.unhide")
                : intl.get("article.hide"),
            iconProps: {
                iconName: item.hidden ? "View" : "Hide3",
            },
            onClick: () => {
                dispatch(toggleHidden(item))
            },
        },
        {
            key: "divider_1",
            itemType: ContextualMenuItemType.Divider,
        },
        {
            key: "share",
            text: intl.get("context.share"),
            iconProps: { iconName: "Share" },
            subMenuProps: {
                items: shareSubmenu(item),
            },
        },
        {
            key: "copyTitle",
            text: intl.get("context.copyTitle"),
            onClick: () => {
                window.utils.writeClipboard(item.title)
            },
        },
        {
            key: "copyURL",
            text: intl.get("context.copyURL"),
            onClick: () => {
                window.utils.writeClipboard(item.link)
            },
        },
        ...(viewConfigs !== undefined
            ? [
                  {
                      key: "divider_2",
                      itemType: ContextualMenuItemType.Divider,
                  },
                  {
                      key: "view",
                      text: intl.get("context.view"),
                      subMenuProps: {
                          items: [
                              {
                                  key: "showCover",
                                  text: intl.get("context.showCover"),
                                  canCheck: true,
                                  checked: Boolean(
                                      viewConfigs & ViewConfigs.ShowCover
                                  ),
                                  onClick: () =>
                                      dispatch(
                                          setViewConfigs(
                                              viewConfigs ^
                                                  ViewConfigs.ShowCover
                                          )
                                      ),
                              },
                              {
                                  key: "showSnippet",
                                  text: intl.get("context.showSnippet"),
                                  canCheck: true,
                                  checked: Boolean(
                                      viewConfigs & ViewConfigs.ShowSnippet
                                  ),
                                  onClick: () =>
                                      dispatch(
                                          setViewConfigs(
                                              viewConfigs ^
                                                  ViewConfigs.ShowSnippet
                                          )
                                      ),
                              },
                              {
                                  key: "fadeRead",
                                  text: intl.get("context.fadeRead"),
                                  canCheck: true,
                                  checked: Boolean(
                                      viewConfigs & ViewConfigs.FadeRead
                                  ),
                                  onClick: () =>
                                      dispatch(
                                          setViewConfigs(
                                              viewConfigs ^ ViewConfigs.FadeRead
                                          )
                                      ),
                              },
                          ],
                      },
                  },
              ]
            : []),
    ]
    return <ContextMenuBase menuItems={menuItems} />
}

function TextContextMenu() {
    const target = useAppSelector(state => state.app.contextMenu.target) as [
        string,
        string
    ]
    const text = target[0]
    const url = target[1]
    const menuItems: IContextualMenuItem[] = text
        ? [
              {
                  key: "copyText",
                  text: intl.get("context.copy"),
                  iconProps: { iconName: "Copy" },
                  onClick: () => {
                      window.utils.writeClipboard(text)
                  },
              },
              getSearchItem(text),
          ]
        : []
    if (url) {
        menuItems.push({
            key: "urlSection",
            itemType: ContextualMenuItemType.Section,
            sectionProps: {
                topDivider: menuItems.length > 0,
                items: [
                    {
                        key: "openInBrowser",
                        text: intl.get("openExternal"),
                        iconProps: {
                            iconName: "NavigateExternalInline",
                        },
                        onClick: e => {
                            window.utils.openExternal(url, platformCtrl(e))
                        },
                    },
                    {
                        key: "copyURL",
                        text: intl.get("context.copyURL"),
                        iconProps: { iconName: "Link" },
                        onClick: () => {
                            window.utils.writeClipboard(url)
                        },
                    },
                ],
            },
        })
    }
    return <ContextMenuBase menuItems={menuItems} />
}

function ImageContextMenu() {
    const menuItems: IContextualMenuItem[] = [
        {
            key: "openInBrowser",
            text: intl.get("openExternal"),
            iconProps: { iconName: "NavigateExternalInline" },
            onClick: e => {
                if (platformCtrl(e)) {
                    window.utils.imageCallback(
                        ImageCallbackTypes.OpenExternalBg
                    )
                } else {
                    window.utils.imageCallback(ImageCallbackTypes.OpenExternal)
                }
            },
        },
        {
            key: "saveImageAs",
            text: intl.get("context.saveImageAs"),
            iconProps: { iconName: "SaveTemplate" },
            onClick: () => {
                window.utils.imageCallback(ImageCallbackTypes.SaveAs)
            },
        },
        {
            key: "copyImage",
            text: intl.get("context.copyImage"),
            iconProps: { iconName: "FileImage" },
            onClick: () => {
                window.utils.imageCallback(ImageCallbackTypes.Copy)
            },
        },
        {
            key: "copyImageURL",
            text: intl.get("context.copyImageURL"),
            iconProps: { iconName: "Link" },
            onClick: () => {
                window.utils.imageCallback(ImageCallbackTypes.CopyLink)
            },
        },
    ]
    return <ContextMenuBase menuItems={menuItems} />
}

function ViewContextMenu() {
    const dispatch = useAppDispatch()
    const viewType = useAppSelector(state => state.page.viewType)
    const filter = useAppSelector(state => state.page.filter.type)

    const menuItems: IContextualMenuItem[] = [
        {
            key: "section_1",
            itemType: ContextualMenuItemType.Section,
            sectionProps: {
                title: intl.get("context.view"),
                bottomDivider: true,
                items: [
                    {
                        key: "cardView",
                        text: intl.get("context.cardView"),
                        iconProps: { iconName: "GridViewMedium" },
                        canCheck: true,
                        checked: viewType === ViewType.Cards,
                        onClick: () => dispatch(switchView(ViewType.Cards)),
                    },
                    {
                        key: "listView",
                        text: intl.get("context.listView"),
                        iconProps: { iconName: "BacklogList" },
                        canCheck: true,
                        checked: viewType === ViewType.List,
                        onClick: () => dispatch(switchView(ViewType.List)),
                    },
                    {
                        key: "magazineView",
                        text: intl.get("context.magazineView"),
                        iconProps: { iconName: "Articles" },
                        canCheck: true,
                        checked: viewType === ViewType.Magazine,
                        onClick: () => dispatch(switchView(ViewType.Magazine)),
                    },
                    {
                        key: "compactView",
                        text: intl.get("context.compactView"),
                        iconProps: { iconName: "BulletedList" },
                        canCheck: true,
                        checked: viewType === ViewType.Compact,
                        onClick: () => dispatch(switchView(ViewType.Compact)),
                    },
                ],
            },
        },
        {
            key: "section_2",
            itemType: ContextualMenuItemType.Section,
            sectionProps: {
                title: intl.get("context.filter"),
                bottomDivider: true,
                items: [
                    {
                        key: "allArticles",
                        text: intl.get("allArticles"),
                        iconProps: { iconName: "ClearFilter" },
                        canCheck: true,
                        checked:
                            (filter & ~FilterType.Toggles) ==
                            FilterType.Default,
                        onClick: () =>
                            dispatch(switchFilter(FilterType.Default)),
                    },
                    {
                        key: "unreadOnly",
                        text: intl.get("context.unreadOnly"),
                        iconProps: {
                            iconName: "RadioBtnOn",
                            style: {
                                fontSize: 14,
                                textAlign: "center",
                            },
                        },
                        canCheck: true,
                        checked:
                            (filter & ~FilterType.Toggles) ==
                            FilterType.UnreadOnly,
                        onClick: () =>
                            dispatch(switchFilter(FilterType.UnreadOnly)),
                    },
                    {
                        key: "starredOnly",
                        text: intl.get("context.starredOnly"),
                        iconProps: { iconName: "FavoriteStarFill" },
                        canCheck: true,
                        checked:
                            (filter & ~FilterType.Toggles) ==
                            FilterType.StarredOnly,
                        onClick: () =>
                            dispatch(switchFilter(FilterType.StarredOnly)),
                    },
                ],
            },
        },
        {
            key: "section_3",
            itemType: ContextualMenuItemType.Section,
            sectionProps: {
                title: intl.get("search"),
                bottomDivider: true,
                items: [
                    {
                        key: "caseSensitive",
                        text: intl.get("context.caseSensitive"),
                        iconProps: {
                            style: {
                                fontSize: 12,
                                fontStyle: "normal",
                            },
                            children: "Aa",
                        },
                        canCheck: true,
                        checked: !(filter & FilterType.CaseInsensitive),
                        onClick: () =>
                            dispatch(toggleFilter(FilterType.CaseInsensitive)),
                    },
                    {
                        key: "fullSearch",
                        text: intl.get("context.fullSearch"),
                        iconProps: { iconName: "Breadcrumb" },
                        canCheck: true,
                        checked: Boolean(filter & FilterType.FullSearch),
                        onClick: () =>
                            dispatch(toggleFilter(FilterType.FullSearch)),
                    },
                ],
            },
        },
        {
            key: "showHidden",
            text: intl.get("context.showHidden"),
            canCheck: true,
            checked: Boolean(filter & FilterType.ShowHidden),
            onClick: () => dispatch(toggleFilter(FilterType.ShowHidden)),
        },
    ]
    return <ContextMenuBase menuItems={menuItems} />
}

function GroupContextMenu() {
    const dispatch = useAppDispatch()
    const sids = useAppSelector(
        state => state.app.contextMenu.target
    ) as number[]

    const menuItems: IContextualMenuItem[] = [
        {
            key: "markAllRead",
            text: intl.get("nav.markAllRead"),
            iconProps: { iconName: "CheckMark" },
            onClick: () => {
                dispatch(markAllRead(sids))
            },
        },
        {
            key: "refresh",
            text: intl.get("nav.refresh"),
            iconProps: { iconName: "Sync" },
            onClick: () => {
                dispatch(markAllRead(sids))
            },
        },
        {
            key: "manage",
            text: intl.get("context.manageSources"),
            iconProps: { iconName: "Settings" },
            onClick: () => {
                dispatch(markAllRead(sids))
            },
        },
    ]
    return <ContextMenuBase menuItems={menuItems} />
}

function MarkReadContextMenu() {
    const dispatch = useAppDispatch()

    const menuItems: IContextualMenuItem[] = [
        {
            key: "section_1",
            itemType: ContextualMenuItemType.Section,
            sectionProps: {
                title: intl.get("nav.markAllRead"),
                items: [
                    {
                        key: "all",
                        text: intl.get("allArticles"),
                        iconProps: { iconName: "ReceiptCheck" },
                        onClick: () => {
                            dispatch(markAllRead())
                        },
                    },
                    {
                        key: "1d",
                        text: intl.get("app.daysAgo", { days: 1 }),
                        onClick: () => {
                            let date = new Date()
                            date.setTime(date.getTime() - 86400000)
                            dispatch(markAllRead(null, date))
                        },
                    },
                    {
                        key: "3d",
                        text: intl.get("app.daysAgo", { days: 3 }),
                        onClick: () => {
                            let date = new Date()
                            date.setTime(date.getTime() - 3 * 86400000)
                            dispatch(markAllRead(null, date))
                        },
                    },
                    {
                        key: "7d",
                        text: intl.get("app.daysAgo", { days: 7 }),
                        onClick: () => {
                            let date = new Date()
                            date.setTime(date.getTime() - 7 * 86400000)
                            dispatch(markAllRead(null, date))
                        },
                    },
                ],
            },
        },
    ]
    return <ContextMenuBase menuItems={menuItems} />
}

function OpenDigestMenu() {
    const dispatch = useAppDispatch()
    const [generating, setGenerating] = React.useState(false)
    const state = (window as any).__STORE__.getState() as RootState
    const feedId = state.page.feedId

    const generateDigest = async (date: Date | null) => {
        if (generating) return
        setGenerating(true)
        // Set global generating state for progress indicator
        dispatch(setDigestGenerating(true))

        try {
            const settings = window.settings.getIntegrationSettings()

            // Check if any LLM provider is configured (including Ollama)
            const hasOpenAI = !!settings.openaiApiKey
            const hasNvidia = !!settings.nvidiaApiKey
            const hasDeepSeek = !!settings.deepseekApiKey
            const hasOllama = !!(settings.ollamaApiUrl && settings.ollamaModel)
            const hasProvider = hasOpenAI || hasNvidia || hasDeepSeek || hasOllama

            if (!hasProvider) {
                // Build detailed error message
                const missingServices = []
                if (!settings.openaiApiKey && !settings.nvidiaApiKey && !settings.deepseekApiKey && !settings.ollamaApiUrl) {
                    missingServices.push('OpenAI/NVIDIA/DeepSeek API Key 或 Ollama API 地址')
                }
                if (settings.ollamaApiUrl && !settings.ollamaModel) {
                    missingServices.push('Ollama 模型名称')
                }
                alert(`未配置 AI 服务。请在设置 > 集成 > AI 服务中配置：\n${missingServices.join('、')}`)
                setGenerating(false)
                dispatch(setDigestGenerating(false))
                return
            }

            const { generateEnhancedDigest } = await import("../scripts/digest-service")
            const state = (window as any).__STORE__.getState() as RootState
            const groups = state.groups

            const topics = settings.digestTopics ? settings.digestTopics.split(',').map(t => t.trim()) : []

            // Get source IDs from current feed view
            let sourceIds = getSourceIdsFromCurrentFeed(state)

            // If empty array, use all sources
            if (sourceIds.length === 0) {
                sourceIds = undefined
            }

            // 手动触发遵循当前视图范围，自动推送才使用自定义源配置
            const finalSourceIds = sourceIds
            const finalGroupIds = undefined

            // Calculate hours based on selected date
            const hours = date ? (Date.now() - date.getTime()) / 3600000 : 24
            const hoursRounded = Math.round(hours * 100) / 100  // Round to 2 decimal places
            const daysText = hours >= 24 ? Math.floor(hours / 24) + '天' : hoursRounded + '小时'
            console.log(`[Digest] Selected time range: ${daysText} (${hoursRounded} hours)`)

            // Check articles in the selected time range
            const { getRecentItems } = await import("../scripts/digest-service")
            const allItems = await getRecentItems(hours, finalSourceIds)
            console.log(`[Digest] Articles found in last ${daysText}: ${allItems.length}`)

            if (allItems.length === 0) {
                alert(`数据库中没有最近${daysText}的文章。请先刷新订阅源获取新文章。`)
                setGenerating(false)
                dispatch(setDigestGenerating(false))
                return
            }

            const result = await generateEnhancedDigest({
                settings,
                language: state.app.locale,
                topics,
                dalleEnabled: settings.dalleEnabled,
                sourceIds: finalSourceIds,
                groupIds: finalGroupIds,
                groups,
                hours: hours
            })

            // Store result for digest-view to display
            sessionStorage.setItem('digestResult', JSON.stringify({
                content: result.content,
                timestamp: result.timestamp,
                articleCount: result.articleCount,
                coverUrl: result.coverUrl
            }))

            // Open digest view modal
            dispatch(toggleDigest(null))

        } catch (error) {
            console.error("Digest generation failed:", error)
            
            // Provide more specific error messages
            let errorMessage = "摘要生成失败"
            if (error.message.includes('Ollama 连接测试失败')) {
                errorMessage = `摘要生成失败：${error.message}\n\n请检查：\n1. Ollama 服务是否正在运行\n2. 网络连接是否正常\n3. 设置中的 Ollama API 地址是否正确`
            } else if (error.message.includes('No LLM provider configured')) {
                errorMessage = "摘要生成失败：未配置 AI 服务\n\n请在 设置 > 集成 > AI 服务 中配置 OpenAI、NVIDIA、DeepSeek 或 Ollama"
            } else if (error.message.includes('Failed to fetch')) {
                errorMessage = `摘要生成失败：网络连接错误\n\n${error.message}\n\n请检查网络连接或 API 配置`
            } else {
                errorMessage = `摘要生成失败：${error.message}`
            }
            
            alert(errorMessage)
        } finally {
            setGenerating(false)
            dispatch(setDigestGenerating(false))
        }
    }

    const menuItems: IContextualMenuItem[] = [
        {
            key: "section_1",
            itemType: ContextualMenuItemType.Section,
            sectionProps: {
                title: generating ? "⏳ 正在生成摘要..." : "📰 每日摘要",
                items: [
                    {
                        key: "all",
                        text: "📝 全部文章",
                        iconProps: { iconName: generating ? "Sync" : "LightningBolt" },
                        disabled: generating,
                        onClick: () => {
                            console.log('[Digest] Clicked: 全部文章 (无时间限制)')
                            generateDigest(null)
                        },
                    },
                    {
                        key: "1d",
                        text: "🕐 最近 1 天",
                        disabled: generating,
                        onClick: () => {
                            let date = new Date()
                            date.setTime(date.getTime() - 86400000)
                            console.log('[Digest] Clicked: 最近 1 天')
                            console.log('[Digest] Time range:', date.toISOString(), 'to', new Date().toISOString())
                            console.log('[Digest] Milliseconds:', 86400000)
                            generateDigest(date)
                        },
                    },
                    {
                        key: "3d",
                        text: "🕐 最近 3 天",
                        disabled: generating,
                        onClick: () => {
                            let date = new Date()
                            date.setTime(date.getTime() - 3 * 86400000)
                            console.log('[Digest] Clicked: 最近 3 天')
                            console.log('[Digest] Time range:', date.toISOString(), 'to', new Date().toISOString())
                            console.log('[Digest] Milliseconds:', 3 * 86400000)
                            generateDigest(date)
                        },
                    },
                    {
                        key: "7d",
                        text: "🕐 最近 7 天",
                        disabled: generating,
                        onClick: () => {
                            let date = new Date()
                            date.setTime(date.getTime() - 7 * 86400000)
                            console.log('[Digest] Clicked: 最近 7 天')
                            console.log('[Digest] Time range:', date.toISOString(), 'to', new Date().toISOString())
                            console.log('[Digest] Milliseconds:', 7 * 86400000)
                            generateDigest(date)
                        },
                    },
                ],
            },
        },
    ]
    return <ContextMenuBase menuItems={menuItems} />
}

function OpenTranslateMenu() {
    const dispatch = useAppDispatch()
    const state = (window as any).__STORE__.getState() as RootState
    const feedScope = getFeedScope(state)

    // All view and SOURCE view use null, otherwise keeps source IDs for source/group
    const sourceIds = (feedScope.isAll || feedScope.isSourceRoot) ? null : feedScope.sourceIds

    const translateItems = async (date: Date | null) => {
        try {
            // Check if database is initialized
            if (!db.dbInitialized || !db.itemsDB || !db.items) {
                console.error('[Translate] Database not initialized. dbInitialized:', db.dbInitialized)
                alert("数据库未初始化。请刷新页面。")
                return
            }

            let items: RSSItem[] = []

            if (sourceIds === null) {
                // All articles - get recent 50 from all sources
                console.log('[Translate] Translating all articles')
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
            } else if (sourceIds.length === 1) {
                // Single source
                console.log('[Translate] Translating source:', sourceIds[0])
                let query
                if (date) {
                    query = db.itemsDB
                        .select()
                        .from(db.items)
                        .where(lf.op.and(
                            db.items.source.eq(sourceIds[0]),
                            db.items.date.gte(date)
                        ))
                        .orderBy(db.items.date, lf.Order.DESC)
                        .limit(50)
                } else {
                    query = db.itemsDB
                        .select()
                        .from(db.items)
                        .where(db.items.source.eq(sourceIds[0]))
                        .orderBy(db.items.date, lf.Order.DESC)
                        .limit(50)
                }
                items = await query.exec() as RSSItem[]
            } else {
                // Group (multiple sources)
                console.log('[Translate] Translating group:', sourceIds)
                let query
                if (date) {
                    query = db.itemsDB
                        .select()
                        .from(db.items)
                        .where(lf.op.and(
                            db.items.source.in(sourceIds),
                            db.items.date.gte(date)
                        ))
                        .orderBy(db.items.date, lf.Order.DESC)
                        .limit(50)
                } else {
                    query = db.itemsDB
                        .select()
                        .from(db.items)
                        .where(db.items.source.in(sourceIds))
                        .orderBy(db.items.date, lf.Order.DESC)
                        .limit(50)
                }
                items = await query.exec() as RSSItem[]
            }

            console.log('[Translate] Items fetched:', items.length)

            if (items.length === 0) {
                alert("没有找到可翻译的文章。请先刷新订阅源获取新文章，或选择不同的时间范围。")
                return
            }

            const titlesToTranslate = items.map(i => i.title)
            console.log(`[Translate] Starting translation of ${titlesToTranslate.length} titles:`, titlesToTranslate.slice(0, 5))
            dispatch(startTranslate(titlesToTranslate))

            const { translateTitles } = await import("../scripts/translate")
            const translatedTitles = await translateTitles(
                titlesToTranslate,
                (completed, total) => {
                    dispatch(translateProgress(completed, total))
                }
            )

            console.log(`[Translate] Translated ${translatedTitles.length} titles:`, translatedTitles.slice(0, 5))
            dispatch(translateComplete(translatedTitles))

            const translations = {}
            items.forEach((item, index) => {
                if (translatedTitles[index] !== item.title) {
                    translations[item._id] = translatedTitles[index]
                }
            })
            sessionStorage.setItem('titleTranslations', JSON.stringify(translations))
            console.log(`[Translate] Stored ${Object.keys(translations).length} translations in sessionStorage`)

            console.log("Translation complete:", translatedTitles.length, "titles")

            // Trigger UI refresh
            window.dispatchEvent(new Event('translation-updated'))
        } catch (error) {
            console.error("Translation failed:", error)

            // Provide more specific error messages
            let errorMessage = "翻译失败"
            if (error.code === 516 || (error.message && error.message.includes('lovefield'))) {
                errorMessage = "翻译失败：数据库未初始化或访问失败\n\n请刷新页面后重试。"
            } else if (error.message.includes('Ollama 连接测试失败')) {
                errorMessage = `翻译失败：${error.message}\n\n请检查：\n1. Ollama 服务是否正在运行\n2. 网络连接是否正常\n3. 设置中的 Ollama API 地址是否正确`
            } else if (error.message.includes('No articles to translate')) {
                errorMessage = "翻译失败：没有找到可翻译的文章"
            } else if (error.message.includes('Failed to fetch')) {
                errorMessage = `翻译失败：网络连接错误\n\n${error.message}\n\n请检查网络连接或翻译服务配置`
            } else {
                errorMessage = `翻译失败：${error.message}`
            }

            alert(errorMessage)
            dispatch(translateComplete([]))
        }
    }

    const menuItems: IContextualMenuItem[] = [
        {
            key: "section_1",
            itemType: ContextualMenuItemType.Section,
            sectionProps: {
                title: "🌐 翻译",
                items: [
                    {
                        key: "all",
                        text: "📝 全部文章",
                        iconProps: { iconName: "Translate" },
                        onClick: () => {
                            console.log('[Translate] Clicked: 全部文章 (无时间限制)')
                            translateItems(null)
                        },
                    },
                    {
                        key: "1d",
                        text: "🕐 最近 1 天",
                        iconProps: { iconName: "Translate" },
                        onClick: () => {
                            let date = new Date()
                            date.setTime(date.getTime() - 86400000)
                            console.log('[Translate] Clicked: 最近 1 天')
                            console.log('[Translate] Time range:', date.toISOString(), 'to', new Date().toISOString())
                            console.log('[Translate] Milliseconds:', 86400000)
                            translateItems(date)
                        },
                    },
                    {
                        key: "3d",
                        text: "🕐 最近 3 天",
                        iconProps: { iconName: "Translate" },
                        onClick: () => {
                            let date = new Date()
                            date.setTime(date.getTime() - 3 * 86400000)
                            console.log('[Translate] Clicked: 最近 3 天')
                            console.log('[Translate] Time range:', date.toISOString(), 'to', new Date().toISOString())
                            console.log('[Translate] Milliseconds:', 3 * 86400000)
                            translateItems(date)
                        },
                    },
                    {
                        key: "7d",
                        text: "🕐 最近 7 天",
                        iconProps: { iconName: "Translate" },
                        onClick: () => {
                            let date = new Date()
                            date.setTime(date.getTime() - 7 * 86400000)
                            console.log('[Translate] Clicked: 最近 7 天')
                            console.log('[Translate] Time range:', date.toISOString(), 'to', new Date().toISOString())
                            console.log('[Translate] Milliseconds:', 7 * 86400000)
                            translateItems(date)
                        },
                    },
                ],
            },
        },
    ]
    return <ContextMenuBase menuItems={menuItems} />
}

function ContextMenuBase({
    menuItems,
}: Readonly<{ menuItems: IContextualMenuItem[] }>) {
    const { event, position } = useAppSelector(state => state.app.contextMenu)
    const dispatch = useAppDispatch()

    return (
        <ContextualMenu
            directionalHint={DirectionalHint.bottomLeftEdge}
            items={menuItems}
            target={
                event ||
                (position && {
                    left: position[0],
                    top: position[1],
                })
            }
            onDismiss={() => dispatch(closeContextMenu())}
        />
    )
}

