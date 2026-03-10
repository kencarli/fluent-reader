import intl from "react-intl-universal"
import { connect } from "react-redux"
import { RootState } from "../scripts/reducer"
import { fetchItems, markAllRead } from "../scripts/models/item"
import {
    toggleMenu,
    toggleLogMenu,
    toggleSettings,
    openViewMenu,
    openMarkAllMenu,
    toggleDigest,
    startTranslate,
    translateProgress,
    translateComplete,
} from "../scripts/models/app"
import { toggleSearch } from "../scripts/models/page"
import { ViewType } from "../schema-types"
import Nav from "../components/nav"
import { translateTitles } from "../scripts/translate"
import * as db from "../scripts/db"
import { RSSItem } from "../scripts/models/item"
import lf from "lovefield"
import { ALL, SOURCE } from "../scripts/models/feed"

const getItemShown = (state: RootState) =>
    state.page.itemId && state.page.viewType !== ViewType.List

const mapStateToProps = (state: RootState) => ({
    state: state.app,
    itemShown: getItemShown(state),
})

const mapDispatchToProps = dispatch => ({
    fetch: () => dispatch(fetchItems()),
    menu: () => dispatch(toggleMenu()),
    logs: () => dispatch(toggleLogMenu()),
    views: () => dispatch(openViewMenu()),
    settings: () => dispatch(toggleSettings()),
    search: () => dispatch(toggleSearch()),
    markAllRead: () => dispatch(openMarkAllMenu()),
    digest: () => dispatch(toggleDigest()),
    translate: async () => {
        try {
            // Access store directly to get feedId and groups
            const storeState: RootState = (window as any).__STORE__.getState()
            const feedId = storeState.page.feedId
            const groups = storeState.groups
            
            let items: RSSItem[] = []
            
            if (feedId === ALL) {
                // All articles - get recent 50 from all sources
                items = await db.itemsDB
                    .select()
                    .from(db.items)
                    .orderBy(db.items.date, lf.Order.DESC)
                    .limit(50)
                    .exec() as RSSItem[]
            } else if (feedId === SOURCE) {
                // Sources view - no articles to translate
                alert("Please select a specific source or group first")
                return
            } else if (feedId.startsWith("s-")) {
                // Single source
                const sourceId = parseInt(feedId.substring(2))
                items = await db.itemsDB
                    .select()
                    .from(db.items)
                    .where(db.items.source.eq(sourceId))
                    .orderBy(db.items.date, lf.Order.DESC)
                    .limit(50)
                    .exec() as RSSItem[]
            } else if (feedId.startsWith("g-")) {
                // Group - get all sources in group
                const groupIndex = parseInt(feedId.substring(2))
                const group = groups[groupIndex]
                if (group && group.sids) {
                    items = await db.itemsDB
                        .select()
                        .from(db.items)
                        .where(db.items.source.in(group.sids))
                        .orderBy(db.items.date, lf.Order.DESC)
                        .limit(50)
                        .exec() as RSSItem[]
                }
            }

            if (items.length === 0) {
                alert("No articles to translate")
                return
            }

            const titlesToTranslate = items.map(i => i.title)

            // Start translation
            dispatch(startTranslate(titlesToTranslate))

            const translatedTitles = await translateTitles(
                titlesToTranslate,
                (completed, total) => {
                    dispatch(translateProgress(completed, total))
                }
            )

            dispatch(translateComplete(translatedTitles))

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
    },
})

const NavContainer = connect(mapStateToProps, mapDispatchToProps)(Nav)
export default NavContainer
