import * as React from "react"
import intl from "react-intl-universal"
import {
    ContextualMenu,
    IContextualMenuItem,
    ContextualMenuItemType,
    DirectionalHint,
} from "office-ui-fabric-react/lib/ContextualMenu"
import { useAppDispatch, useAppSelector } from "../scripts/reducer"
import { FilterType, ALL, SOURCE } from "../scripts/models/feed"
import { getFeedScope } from "../scripts/models/item"

type RatingMenuProps = {
    target: any
    onDismiss: () => void
    position?: [number, number]
    event?: MouseEvent
}

export default function RatingMenu({ target, onDismiss, position, event }: RatingMenuProps) {
    const dispatch = useAppDispatch()
    const [isRating, setIsRating] = React.useState(false)
    const [ratingProgress, setRatingProgress] = React.useState({ completed: 0, total: 0 })
    const [ratingStats, setRatingStats] = React.useState({ ratedCount: 0, totalCount: 0 })

    // Load rating stats on mount and when feed changes
    React.useEffect(() => {
        let isMounted = true
        const loadStats = async () => {
            try {
                const { getRatedArticleIds } = await import('../scripts/ratings-db')
                const storeState = (window as any).__STORE__.getState()
                const items = storeState.items
                const feedId = storeState.page.feedId
                const groups = storeState.groups

                // Get rated IDs
                const allRatedIds = await getRatedArticleIds()
                const ratedIdSet = new Set(allRatedIds)

                // Filter by current feed
                let totalCount = 0
                let ratedCount = 0

                if (feedId === 'all') {
                    // All articles
                    totalCount = Object.keys(items).length
                    ratedCount = allRatedIds.length
                } else if (feedId.startsWith('s-')) {
                    // Single source
                    const sourceId = parseInt(feedId.substring(2))
                    const sourceItems = Object.values(items).filter((i: any) => i.source === sourceId)
                    totalCount = sourceItems.length
                    ratedCount = sourceItems.filter((i: any) => ratedIdSet.has(i._id)).length
                } else if (feedId.startsWith('g-')) {
                    // Group
                    const groupIndex = parseInt(feedId.substring(2))
                    const group = groups[groupIndex]
                    if (group && group.sids) {
                        const groupItems = Object.values(items).filter((i: any) => group.sids.includes(i.source))
                        totalCount = groupItems.length
                        ratedCount = groupItems.filter((i: any) => ratedIdSet.has(i._id)).length
                    }
                }

                if (isMounted) {
                    setRatingStats({ ratedCount, totalCount })
                }
            } catch (e) {
                console.error('Failed to load rating stats:', e)
            }
        }
        loadStats()

        return () => {
            isMounted = false
        }
    }, [])

    const handleFilterChange = async (filterType: number) => {
        const storeState = (window as any).__STORE__.getState()
        const feedId = storeState.page.feedId

        // No longer restrict SOURCE view - allow rating operations on all articles

        // Get current filter from page.filter
        const currentFilter = storeState.page.filter
        if (!currentFilter) {
            onDismiss()
            return
        }

        // Define filter bit masks
        const RATING_MASK = 128 | 256  // RatedOnly | HighRated

        // Clear existing rating filters
        let newType = currentFilter.type & ~RATING_MASK

        // Apply new rating filter
        if (filterType === -1) {
            // Unrated only - this is a special case, we'll handle it in loadFeed
            // For now, just clear rating bits and let the UI handle it
        } else if (filterType & 256) {
            // 4-star+: Set HighRated bit
            newType = newType | 256
        } else if (filterType & 128) {
            // 3-star+ or Rated only: Set RatedOnly bit
            newType = newType | 128
        }
        // else: filterType = 0 means "all articles", no rating bits set

        // Close menu first
        onDismiss()

        // Then dispatch actions with async filter initialization
        setTimeout(async () => {
            const { applyFilter } = require('../scripts/models/page')
            const { FeedFilter } = require('../scripts/models/feed')

            // Use async factory method to load rating IDs if needed
            const needsRating = (newType & 128) || (newType & 256) || (filterType === -1)

            let filter
            if (needsRating) {
                filter = await FeedFilter.withRatingIds(newType, currentFilter.search, filterType === -1)
            } else {
                filter = new FeedFilter(newType, currentFilter.search)
            }

            dispatch(applyFilter(filter))
        }, 50)
    }

    const handleRateFeed = async (date: Date | null = null) => {
        setIsRating(true)
        try {
            const storeState = (window as any).__STORE__.getState()
            const items = storeState.items
            const sources = storeState.sources
            const feedScope = getFeedScope(storeState)

            // 与 markAllRead 保持一致：获取当前视图的订阅源范围
            let sourceIds = feedScope.sourceIds
            if (sourceIds.length === 0) {
                // 全部文章视图或 SOURCE 视图：使用所有非隐藏源
                sourceIds = Object.values(sources).map((s: any) => s.sid)
            }
            let itemList: any[] = []
            let scopeText = ''

            // 根据 sourceIds 获取文章
            if (sourceIds.length === 0) {
                // 理论上不会发生（上面已经处理）
                itemList = Object.values(items).filter((i: any) => i._id && i.title)
                scopeText = intl.get('rating.allArticles')
            } else if (sourceIds.length === 1) {
                // 单个订阅源
                const sourceId = sourceIds[0]
                itemList = Object.values(items).filter((i: any) =>
                    i._id && i.title && i.source === sourceId
                )
                scopeText = intl.get('rating.currentSource')
            } else {
                // 订阅组（多个源）
                itemList = Object.values(items).filter((i: any) =>
                    i._id && i.title && sourceIds.includes(i.source)
                )
                scopeText = intl.get('rating.currentGroup')
            }

            // 按日期过滤
            let dateText = ''
            if (date) {
                const now = new Date()
                const days = Math.floor((now.getTime() - date.getTime()) / 86400000)
                dateText = intl.get('rating.recentDays', { days })
                itemList = itemList.filter((i: any) => i.date >= date)
            }

            // 只评分未评分的文章
            const { getRatedArticleIds } = await import('../scripts/ratings-db')
            const allRatedIds = await getRatedArticleIds()
            const ratedIdSet = new Set(allRatedIds)
            const unratedItems = itemList.filter((i: any) => !ratedIdSet.has(i._id))

            if (unratedItems.length === 0) {
                alert(intl.get('rating.noUnratedArticles', { scope: scopeText, dateRange: dateText }))
                setIsRating(false)
                return
            }

            setRatingProgress({ completed: 0, total: unratedItems.length })

            const { batchRateArticles } = await import('../scripts/rating-service')

            await batchRateArticles(
                unratedItems as any[],
                window.settings.getIntegrationSettings(),
                (completed, total) => {
                    setRatingProgress({ completed, total })
                }
            )

            alert(intl.get('rating.ratingCompleted', { count: unratedItems.length, scope: scopeText, dateRange: dateText }))

            // Refresh rating stats
            const newRatedIds = await getRatedArticleIds()
            const newRatedIdSet = new Set(newRatedIds)
            const totalCount = itemList.length
            const ratedCount = itemList.filter((i: any) => newRatedIdSet.has(i._id)).length
            setRatingStats({ ratedCount, totalCount })
        } catch (error) {
            alert(intl.get('rating.ratingFailed', { error: error.message }))
        } finally {
            setIsRating(false)
            setRatingProgress({ completed: 0, total: 0 })
        }
    }

    const openRatingSettings = () => {
        const { toggleSettings } = require('../scripts/models/app')
        dispatch(toggleSettings())
        onDismiss()
    }

    // 获取当前视图名称
    const getViewName = () => {
        const storeState = (window as any).__STORE__.getState()
        const feedId = storeState.page.feedId
        if (feedId === ALL || feedId === 'all') return intl.get('rating.allArticles')
        if (feedId.startsWith('s-')) return intl.get('rating.currentSource')
        if (feedId.startsWith('g-')) return intl.get('rating.currentGroup')
        return intl.get('rating.notSelected')
    }

    const viewName = getViewName()

    const menuItems: IContextualMenuItem[] = [
        {
            key: "section_filter",
            itemType: ContextualMenuItemType.Section,
            sectionProps: {
                title: intl.get('rating.filterTitle', { viewName, rated: ratingStats.ratedCount, total: ratingStats.totalCount }),
                items: [
                    {
                        key: "all",
                        text: intl.get('rating.filterAll'),
                        iconProps: { iconName: "Filter" },
                        onClick: () => {
                            handleFilterChange(0)
                        },
                    },
                    {
                        key: "4star",
                        text: intl.get('rating.filter4Star'),
                        iconProps: { iconName: "FavoriteStar" },
                        onClick: () => {
                            handleFilterChange(256)
                        },
                    },
                    {
                        key: "3star",
                        text: intl.get('rating.filter3Star'),
                        iconProps: { iconName: "FavoriteStar" },
                        onClick: () => {
                            handleFilterChange(128)  // Use RatedOnly for 3+ stars
                        },
                    },
                    {
                        key: "unrated",
                        text: intl.get('rating.filterUnrated'),
                        iconProps: { iconName: "CircleRing" },
                        onClick: () => {
                            handleFilterChange(-1)  // Special value for unrated
                        },
                    },
                ],
            },
        },
        {
            key: "divider_1",
            itemType: ContextualMenuItemType.Divider,
        },
        {
            key: "section_actions",
            itemType: ContextualMenuItemType.Section,
            sectionProps: {
                title: intl.get('rating.actionsTitle', { viewName }),
                items: [
                    {
                        key: "rate_all",
                        text: isRating ? intl.get('rating.ratingInProgress', { completed: ratingProgress.completed, total: ratingProgress.total }) : intl.get('rating.rateAll'),
                        iconProps: { iconName: isRating ? "Sync" : "FavoriteStar" },
                        disabled: isRating,
                        onClick: () => {
                            handleRateFeed(null)
                        },
                    },
                    {
                        key: "rate_1d",
                        text: isRating ? intl.get('rating.ratingInProgress', { completed: ratingProgress.completed, total: ratingProgress.total }) : intl.get('rating.rateLastDays', { days: 1 }),
                        iconProps: { iconName: isRating ? "Sync" : "Clock" },
                        disabled: isRating,
                        onClick: () => {
                            let date = new Date()
                            date.setTime(date.getTime() - 86400000)
                            handleRateFeed(date)
                        },
                    },
                    {
                        key: "rate_3d",
                        text: isRating ? intl.get('rating.ratingInProgress', { completed: ratingProgress.completed, total: ratingProgress.total }) : intl.get('rating.rateLastDays', { days: 3 }),
                        iconProps: { iconName: isRating ? "Sync" : "Clock" },
                        disabled: isRating,
                        onClick: () => {
                            let date = new Date()
                            date.setTime(date.getTime() - 3 * 86400000)
                            handleRateFeed(date)
                        },
                    },
                    {
                        key: "rate_7d",
                        text: isRating ? intl.get('rating.ratingInProgress', { completed: ratingProgress.completed, total: ratingProgress.total }) : intl.get('rating.rateLastDays', { days: 7 }),
                        iconProps: { iconName: isRating ? "Sync" : "Clock" },
                        disabled: isRating,
                        onClick: () => {
                            let date = new Date()
                            date.setTime(date.getTime() - 7 * 86400000)
                            handleRateFeed(date)
                        },
                    },
                    {
                        key: "settings",
                        text: intl.get('rating.settings'),
                        iconProps: { iconName: "Settings" },
                        onClick: openRatingSettings,
                    },
                ],
            },
        },
    ]

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
            onDismiss={onDismiss}
        />
    )
}
