import * as React from "react"
import * as ReactDOM from "react-dom"
import { Provider } from "react-redux"
import { initializeIcons } from "@fluentui/react/lib/Icons"
import { registerIcons } from "@uifabric/styling"
import Root from "./components/root"
import { applyThemeSettings } from "./scripts/settings"
import { initApp, openTextMenu } from "./scripts/models/app"
import { rootStore } from "./scripts/reducer"

window.settings.setProxy()

applyThemeSettings()
initializeIcons("icons/")
registerIcons({
    icons: {
        'StatusCheck': '\uE930',
        'FolderOpen': '\uED25',
        'Database': '\uEC7C',
        'Settings': '\uE713',
        'Clock': '\uE952',
        'Cloud': '\uE753',
        'ChevronDownMed': '\uE972',
        'ChevronRightMed': '\uE96C',
        'Back': '\uE72B'
    }
})

rootStore.dispatch(initApp())

window.utils.addMainContextListener((pos, text) => {
    rootStore.dispatch(openTextMenu(pos, text))
})

window.fontList = [""]
window.utils.initFontList().then(fonts => {
    window.fontList.push(...fonts)
})

ReactDOM.render(
    <Provider store={rootStore}>
        <Root />
    </Provider>,
    document.getElementById("app")
)
