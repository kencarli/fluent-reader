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

// Prevent duplicate icon initialization
const iconsInitializedKey = '__FLUENT_READER_ICONS_INITIALIZED__'
if (!(window as any)[iconsInitializedKey]) {
    // 使用本地图标文件
    initializeIcons("icons/")
    
    // Only register custom icons that are not in Fluent UI
    registerIcons({
        icons: {
            'markdownlogo': '\uF31B',
        }
    } as any)
    
    ;(window as any)[iconsInitializedKey] = true
    console.log('[Icons] Initialized with local icons successfully')
} else {
    console.log('[Icons] Already initialized, skipping')
}

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

// ==================== 后台运行功能 ====================
async function setupBackgroundMode() {
    try {
        // 检查是否在 Tauri 环境中
        if (typeof window !== 'undefined' && (window as any).__TAURI__) {
            // 动态导入 Tauri API
            const { Window } = await import('@tauri-apps/api/window')
            
            // 获取主窗口
            const mainWindow = await Window.getCurrent()
            
            // 监听窗口关闭事件，改为隐藏到后台
            window.addEventListener('beforeunload', async (e) => {
                // 阻止默认关闭行为
                e.preventDefault()
                // 隐藏窗口到后台
                await mainWindow.hide()
            })
            
            console.log('[Background] 后台运行模式已启用')
        }
    } catch (error) {
        console.warn('[Background] 无法启用后台运行模式:', error)
    }
}

// 设置后台运行模式
setupBackgroundMode()

ReactDOM.render(
    <Provider store={rootStore}>
        <Root />
    </Provider>,
    document.getElementById("app")
)
