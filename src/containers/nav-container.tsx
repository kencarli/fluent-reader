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
    openDigestMenu,
    openTranslateMenu,
    openRatingMenu,
    toggleDigest,
    startTranslateWithTimeRange,
    clearTranslateNotification,
} from "../scripts/models/app"
import { toggleSearch } from "../scripts/models/page"
import { ViewType } from "../schema-types"
import Nav from "../components/nav"

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
    rating: () => dispatch(openRatingMenu()),
    clearTranslateNotification: () => dispatch(clearTranslateNotification()),
})

const NavContainer = connect(mapStateToProps, mapDispatchToProps)(Nav)
export default NavContainer
