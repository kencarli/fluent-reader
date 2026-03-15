import * as React from "react"
import * as ReactDOM from "react-dom"
import { Provider } from "react-redux"
import { initializeIcons } from "@fluentui/react/lib/Icons"
import { registerIcons } from "@uifabric/styling"
import Root from "./components/root"
import { applyThemeSettings } from "./scripts/settings"
import { initApp, openTextMenu } from "./scripts/models/app"
import { rootStore } from "./scripts/reducer"

// Expose store to window for access in containers
(window as any).__STORE__ = rootStore

window.settings.setProxy()

applyThemeSettings()

// Register local icon fonts
registerIcons({
    icons: {
        'StatusCheck': '\uE930',
        'markdownlogo': '\uF31B',
        'RemoveDuplicate': '\uEBA5'
    }
})

// Initialize icons with local path (relative to dist/index.html)
initializeIcons('./icons/')

rootStore.dispatch(initApp())

window.utils.addMainContextListener((pos, text) => {
    rootStore.dispatch(openTextMenu(pos, text))
})

window.fontList = [""]
window.utils.initFontList().then(fonts => {
    window.fontList.push(...fonts)
}).catch(err => {
    console.warn("Failed to load font list:", err)
})

ReactDOM.render(
    <Provider store={rootStore}>
        <Root />
    </Provider>,
    document.getElementById("app")
)
