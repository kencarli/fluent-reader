/**
 * Window Settings 初始化
 * 确保在所有环境中 window.settings 和 window.utils 都可用
 */

import settingsBridge from '../bridges/settings'
import tauriSettingsBridge from '../bridges/tauri-settings'

// 防止重复初始化的标志
let hasInitialized = false

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
    if (typeof window === 'undefined' || hasInitialized) return
    
    // 检测是否在 Tauri 环境
    const isTauri = (window as any).__TAURI_INTERNALS__ !== undefined ||
                    (window as any).__TAURI__ !== undefined ||
                    (window as any).__TAURI_POST_MESSAGE__ !== undefined

    // 如果 window.utils 已经存在（index.html 中已初始化），则跳过
    if (window.utils) {
        console.log('[Utils] Already initialized, skipping')
        return
    }

    // 创建基础 utils 对象
    const baseUtils: any = {
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

    // 窗口控制（仅在 Tauri 环境）
    if (isTauri) {
        baseUtils.closeWindow = () => import('./tauri-bridge').then(m => m.closeWindow())
        baseUtils.minimizeWindow = () => import('./tauri-bridge').then(m => m.minimizeWindow())
        baseUtils.maximizeWindow = () => import('./tauri-bridge').then(m => m.maximizeWindow())
        baseUtils.startDraggingWindow = () => import('./tauri-bridge').then(m => m.startDragging())
        baseUtils.requestAttention = () => import('./tauri-bridge').then(m => m.requestAttention())
        baseUtils.openExternal = (url: string, _background?: boolean) => import('./tauri-bridge').then(m => m.openExternal(url))
        
        // 同步方法需要缓存状态
        let isMaximizedCache = false
        let isFullscreenCache = false
        let isFocusedCache = false
        
        // 异步初始化缓存
        import('./tauri-bridge').then(m => {
            m.isMaximized().then(v => isMaximizedCache = v)
            m.isFullscreen().then(v => isFullscreenCache = v)
            m.isFocused().then(v => isFocusedCache = v)
        })
        
        // 同步返回缓存值
        baseUtils.isMaximized = () => isMaximizedCache
        baseUtils.isFullscreen = () => isFullscreenCache
        baseUtils.isFocused = () => isFocusedCache

        // 文件对话框
        baseUtils.showOpenDialog = async (filters: any) => {
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
        
        baseUtils.showSaveDialog = async (filters: any, defaultPath: string) => {
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
        
        baseUtils.showFolderDialog = async () => {
            const { open } = await import('@tauri-apps/plugin-dialog')
            return await open({ directory: true })
        }
        
        // 窗口状态监听器（兼容 WindowStateListenerType 枚举）
        baseUtils.addWindowStateListener = async (callback: (type: number, state: boolean) => void) => {
            const { listen } = await import('@tauri-apps/api/event')
            
            // WindowStateListenerType 枚举值: Maximized=0, Focused=1, Fullscreen=2
            const Maximized = 0
            const Focused = 1
            const Fullscreen = 2
            
            // 监听窗口最大化/还原
            await listen('tauri://maximize', () => { 
                isMaximizedCache = true
                callback(Maximized, true) 
            })
            await listen('tauri://unmaximize', () => { 
                isMaximizedCache = false
                callback(Maximized, false) 
            })
            
            // 监听窗口全屏/退出全屏
            await listen('tauri://fullscreen', () => { 
                isFullscreenCache = true
                callback(Fullscreen, true) 
            })
            
            // 监听窗口焦点变化
            await listen('tauri://focus', () => { 
                isFocusedCache = true
                callback(Focused, true) 
            })
            await listen('tauri://blur', () => { 
                isFocusedCache = false
                callback(Focused, false) 
            })
        }
    }

    // 赋值给 window.utils
    (window as any).utils = baseUtils
}

/**
 * 初始化 window.settings
 * 在 Electron 环境中使用 Electron 的 settingsBridge
 * 在 Tauri 环境中使用 Tauri 的 tauriSettingsBridge
 */
export function initWindowSettings() {
    // 检查是否已初始化
    if (hasInitialized) {
        console.log('[Settings] Already initialized, skipping')
        return
    }

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
        } else {
            console.log('[Settings] Already initialized in HTML, skipping')
        }
    } else {
        // Electron 环境或浏览器环境
        if (!window.settings) {
            window.settings = settingsBridge
            console.log('[Settings] Using Electron settings bridge')
        }
    }

    // 设置初始化完成标志
    hasInitialized = true
}
