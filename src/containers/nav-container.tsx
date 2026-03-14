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
    openTranslateMenu,
    openDigestMenu,
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
    digest: () => dispatch(openDigestMenu()),
    translate: () => dispatch(openTranslateMenu()),
})

const NavContainer = connect(mapStateToProps, mapDispatchToProps)(Nav)
export default NavContainer
