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
import { createTray, destroyTray } from "./scripts/tray-manager"

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
let _backgroundModeInitialized = false
async function setupBackgroundMode() {
    // 防止重复初始化
    if (_backgroundModeInitialized) {
        console.log('[Background] Already initialized, skipping')
        return
    }
    _backgroundModeInitialized = true
    console.log('[Background] Initializing background mode...')
    
    try {
        // 检查是否在 Tauri 环境中
        if (typeof window !== 'undefined' && ((window as any).__TAURI_INTERNALS__ || (window as any).__TAURI__)) {
            // 动态导入 Tauri API
            const { getCurrentWindow } = await import('@tauri-apps/api/window')
            
            // 获取主窗口
            const mainWindow = getCurrentWindow()
            
            // 检查是否启用了后台模式
            const backgroundModeEnabled = window.settings.getBackgroundMode() ?? true
            console.log('[Background] Background mode enabled:', backgroundModeEnabled)
            
            if (backgroundModeEnabled) {
                let isQuitting = false

                // 拦截窗口关闭事件：隐藏到后台而非退出
                await mainWindow.onCloseRequested(async (event) => {
                    if (isQuitting) return // 从托盘退出时放行
                    console.log('[Background] 窗口关闭事件触发，隐藏到后台')
                    event.preventDefault()
                    await mainWindow.hide()
                })

                // 创建系统托盘
                console.log('[Background] Creating tray...')
                await createTray({
                    onShow: () => {
                        console.log('[Tray] 从托盘显示窗口')
                    },
                    onQuit: async () => {
                        console.log('[Tray] 退出应用')
                        isQuitting = true
                        await destroyTray()
                    }
                })
                
                console.log('[Background] 后台运行模式已启用，系统托盘已创建')
            } else {
                console.log('[Background] 后台运行模式已禁用')
            }
        } else {
            console.log('[Background] Not in Tauri environment')
        }
    } catch (error) {
        console.warn('[Background] 无法启用后台运行模式:', error)
    }
}

// 设置后台运行模式（只执行一次）
setupBackgroundMode()

ReactDOM.render(
    <Provider store={rootStore}>
        <Root />
    </Provider>,
    document.getElementById("app")
)
