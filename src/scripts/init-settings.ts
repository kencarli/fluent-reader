/**
 * Window Settings 初始化
 * 确保在所有环境中 window.settings 和 window.utils 都可用
 */

import settingsBridge from '../bridges/settings'
import tauriSettingsBridge from '../bridges/tauri-settings'

/**
 * 检测平台
 */
function detectPlatform(): string {
    if (typeof navigator !== 'undefined') {
        if (navigator.userAgent.indexOf('Mac') !== -1) {
            return 'darwin'
        } else if (navigator.userAgent.indexOf('Linux') !== -1) {
            return 'linux'
        }
    }
    return 'win32'
}

/**
 * 初始化 window.utils
 */
function initWindowUtils() {
    if (typeof window !== 'undefined' && !window.utils) {
        // 检测是否在 Tauri 环境
        const isTauri = typeof window !== 'undefined' &&
                        (window as any).__TAURI_INTERNALS__ !== undefined

        const utils: any = {
            platform: detectPlatform(),
            isTauri: isTauri,  // 添加 Tauri 环境标识

            // 其他功能
            addMainContextListener: (callback: (pos: any, text: any) => void) => {
                console.log('[Utils] Context menu listener registered')
            },
            initFontList: async (): Promise<string[]> => {
                return []
            },
            showSaveDialog: async (filters: any, defaultPath: string) => {
                return null
            }
        }

        // 窗口控制（仅在 Tauri 环境）
        if (isTauri) {
            utils.closeWindow = () => import('./tauri-bridge').then(m => m.closeWindow())
            utils.minimizeWindow = () => import('./tauri-bridge').then(m => m.minimizeWindow())
            utils.maximizeWindow = () => import('./tauri-bridge').then(m => m.maximizeWindow())
            utils.isMaximized = () => import('./tauri-bridge').then(m => m.isMaximized())
            utils.isFullscreen = () => import('./tauri-bridge').then(m => m.isFullscreen())
            utils.isFocused = () => import('./tauri-bridge').then(m => m.isFocused())
            utils.startDraggingWindow = () => import('./tauri-bridge').then(m => m.startDragging())
        }

        window.utils = utils
    }
}

/**
 * 初始化 window.settings
 * 在 Electron 环境中使用 Electron 的 settingsBridge
 * 在 Tauri 环境中使用 Tauri 的 tauriSettingsBridge
 */
export function initWindowSettings() {
    // 先初始化 utils
    initWindowUtils()

    // 检查是否在 Tauri 环境中
    const isTauri = typeof window !== 'undefined' &&
                    (window as any).__TAURI_INTERNALS__ !== undefined

    if (isTauri) {
        // Tauri 环境
        if (!window.settings) {
            window.settings = tauriSettingsBridge
            console.log('[Settings] Using Tauri settings bridge')
        }
    } else {
        // Electron 环境或浏览器环境
        if (!window.settings) {
            window.settings = settingsBridge
            console.log('[Settings] Using Electron settings bridge')
        }
    }
}
