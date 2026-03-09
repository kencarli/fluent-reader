import intl from "react-intl-universal"
import { connect } from "react-redux"
import { createSelector } from "reselect"
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

const getState = (state: RootState) => state.app
const getItemShown = (state: RootState) =>
    state.page.itemId && state.page.viewType !== ViewType.List

const mapStateToProps = createSelector(
    [getState, getItemShown],
    (state, itemShown) => ({
        state: state,
        itemShown: itemShown,
    })
)

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
            // Get recent articles from database
            const items = await db.itemsDB
                .select()
                .from(db.items)
                .orderBy(db.items.date, lf.Order.DESC)
                .limit(50) // Limit to 50 articles for batch translation
                .exec() as RSSItem[]
            
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
