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
    if (typeof window !== 'undefined') {
        // 检测是否在 Tauri 环境
        // Tauri v2: Check for __TAURI__ object
        const isTauri = typeof window !== 'undefined' && (
            (window as any).__TAURI_INTERNALS__ !== undefined ||
            (window as any).__TAURI__ !== undefined ||
            (window as any).__TAURI_POST_MESSAGE__ !== undefined
        )

        // 如果 window.utils 不存在，创建基础对象
        if (!window.utils) {
            (window as any).utils = {
                platform: detectPlatform(),
                isTauri: isTauri,
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
        } else {
            // 如果已存在，添加缺失的属性
            if (!(window.utils as any).isTauri) {
                (window.utils as any).isTauri = isTauri
            }
        }

        // 窗口控制（仅在 Tauri 环境）
        if (isTauri) {
            (window.utils as any).closeWindow = () => import('./tauri-bridge').then(m => m.closeWindow())
            ;(window.utils as any).minimizeWindow = () => import('./tauri-bridge').then(m => m.minimizeWindow())
            ;(window.utils as any).maximizeWindow = () => import('./tauri-bridge').then(m => m.maximizeWindow())
            ;(window.utils as any).isMaximized = () => import('./tauri-bridge').then(m => m.isMaximized())
            ;(window.utils as any).isFullscreen = () => import('./tauri-bridge').then(m => m.isFullscreen())
            ;(window.utils as any).isFocused = () => import('./tauri-bridge').then(m => m.isFocused())
            ;(window.utils as any).startDraggingWindow = () => import('./tauri-bridge').then(m => m.startDragging())
            ;(window.utils as any).requestAttention = () => import('./tauri-bridge').then(m => m.requestAttention())
            ;(window.utils as any).openExternal = (url: string, _background?: boolean) => import('./tauri-bridge').then(m => m.openExternal(url))

            // 文件对话框
            ;(window.utils as any).showOpenDialog = async (filters: any) => {
                try {
                    const { open } = await import('@tauri-apps/plugin-dialog')
                    const { readTextFile } = await import('@tauri-apps/plugin-fs')
                    
                    // 转换过滤器格式
                    const tauriFilters: any = {}
                    if (filters && Array.isArray(filters)) {
                        filters.forEach((f: any) => {
                            if (f.name && f.extensions) {
                                tauriFilters[f.name] = f.extensions
                            }
                        })
                    }
                    
                    const selected = await open({
                        multiple: false,
                        filters: Object.keys(tauriFilters).length > 0 ? 
                            Object.entries(tauriFilters).map(([name, extensions]) => ({
                                name,
                                extensions: extensions as string[]
                            })) : undefined
                    })
                    
                    if (selected && typeof selected === 'string') {
                        // 读取文件内容并返回
                        return await readTextFile(selected)
                    }
                    return null
                } catch (error) {
                    console.error('[Utils] showOpenDialog error:', error)
                    return null
                }
            }
            ;(window.utils as any).showSaveDialog = async (filters: any, defaultPath: string) => {
                try {
                    const { save } = await import('@tauri-apps/plugin-dialog')
                    
                    // 转换过滤器格式
                    const tauriFilters: any = {}
                    if (filters && Array.isArray(filters)) {
                        filters.forEach((f: any) => {
                            if (f.name && f.extensions) {
                                tauriFilters[f.name] = f.extensions
                            }
                        })
                    }
                    
                    const selected = await save({
                        defaultPath,
                        filters: Object.keys(tauriFilters).length > 0 ? 
                            Object.entries(tauriFilters).map(([name, extensions]) => ({
                                name,
                                extensions: extensions as string[]
                            })) : undefined
                    })
                    
                    if (selected) {
                        // 返回一个回调函数,用于写入文件内容
                        return async (content: string, errmsg: string) => {
                            try {
                                const { writeTextFile } = await import('@tauri-apps/plugin-fs')
                                await writeTextFile(selected as string, content)
                                return true
                            } catch (e) {
                                console.error('[Utils] showSaveDialog write error:', e)
                                return false
                            }
                        }
                    }
                    return null
                } catch (error) {
                    console.error('[Utils] showSaveDialog error:', error)
                    return null
                }
            }
            ;(window.utils as any).showFolderDialog = async () => {
                const { open } = await import('@tauri-apps/plugin-dialog')
                return await open({ directory: true })
            }
        }
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
