import { connect } from "react-redux"
import { createSelector } from "reselect"
import { RootState } from "../scripts/reducer"
import { exitSettings } from "../scripts/models/app"
import Settings from "../components/settings"

const getApp = (state: RootState) => state.app

const mapStateToProps = createSelector([getApp], app => ({
    display: app.settings.display,
    // Only block if actively saving or syncing, allow viewing settings during initial load
    // This prevents the settings page from appearing blank when sourceInit is false
    blocked: app.syncing || app.settings.saving,
    exitting: app.settings.saving,
}))

const mapDispatchToProps = dispatch => {
    return {
        close: () => dispatch(exitSettings()),
    }
}

const SettingsContainer = connect(mapStateToProps, mapDispatchToProps)(Settings)
export default SettingsContainer
