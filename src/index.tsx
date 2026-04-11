import * as React from "react"
import * as ReactDOM from "react-dom"
import { Provider } from "react-redux"
import { initializeIcons } from "@fluentui/react/lib/Icons"
import { registerIcons } from "@uifabric/styling"
import Root from "./components/root"
import { applyThemeSettings } from "./scripts/settings"
import { initApp, openTextMenu } from "./scripts/models/app"
import { rootStore } from "./scripts/reducer"
import { initWindowSettings } from "./scripts/init-settings"

// Initialize window.settings for all environments
initWindowSettings()

// Initialize settings if available (Electron environment)
if (typeof window !== 'undefined' && window.settings) {
    window.settings.setProxy()
}

applyThemeSettings()
initializeIcons("icons/") // 使用本地图标文件

// Only register custom icons that are not in Fluent UI
registerIcons({
    icons: {
        'StatusCheck': '\uE930',
        'markdownlogo': '\uF31B',
    }
} as any)

// Expose rootStore to window for use in containers
;(window as any).__STORE__ = rootStore

rootStore.dispatch(initApp())

if (typeof window !== 'undefined' && window.utils) {
    window.utils.addMainContextListener((pos, text) => {
        rootStore.dispatch(openTextMenu(pos, text))
    })
}

window.fontList = [""]
if (typeof window !== 'undefined' && window.utils) {
    window.utils.initFontList().then(fonts => {
        window.fontList.push(...fonts)
    })
}

ReactDOM.render(
    <Provider store={rootStore}>
        <Root />
    </Provider>,
    document.getElementById("app")
)
