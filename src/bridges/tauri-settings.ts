/**
 * Tauri Settings Bridge
 * 在 Tauri 环境中提供与 Electron 相同的 settings API
 */

import { invoke } from '@tauri-apps/api/core'
import { SourceGroup } from '../schema-types'

// 内存中的设置缓存
let settingsCache: any = {}

// 从 Tauri 后端加载设置
async function loadSettingsFromTauri() {
    try {
        const allSettings = await invoke<any>('get_all_settings')
        settingsCache = { ...settingsCache, ...allSettings }
    } catch (e) {
        console.warn('[Tauri Settings] Failed to load settings:', e)
    }
}

// 保存设置到 Tauri 后端
async function saveSettingToTauri(key: string, value: any) {
    try {
        await invoke('set_setting', { key, value })
        settingsCache[key] = value
    } catch (e) {
        console.warn('[Tauri Settings] Failed to save setting:', e)
    }
}

// 初始化设置
loadSettingsFromTauri()

// 检测平台
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

// 初始化 window.utils
if (typeof window !== 'undefined' && !window.utils) {
    (window as any).utils = {
        platform: detectPlatform(),
        addMainContextListener: (callback: (pos: any, text: any) => void) => {
            console.log('[Utils] Context menu listener registered (Tauri)')
        },
        initFontList: async (): Promise<string[]> => {
            return []
        },
        showSaveDialog: async (filters: any, defaultPath: string) => {
            // 这个需要在 HTML 中实现，因为需要访问 __TAURI_INTERNALS__
            return null
        }
    }
}

const tauriSettingsBridge = {
    // Groups
    saveGroups: (groups: SourceGroup[]) => {
        saveSettingToTauri('groups', groups)
    },
    loadGroups: (): SourceGroup[] => {
        return settingsCache['groups'] || []
    },

    // Menu
    getDefaultMenu: (): boolean => {
        return settingsCache['defaultMenu'] ?? true
    },
    setDefaultMenu: (state: boolean) => {
        settingsCache['defaultMenu'] = state
        saveSettingToTauri('defaultMenu', state)
    },

    // Proxy
    getProxyStatus: (): boolean => {
        return settingsCache['proxyEnabled'] ?? false
    },
    toggleProxyStatus: () => {
        const current = tauriSettingsBridge.getProxyStatus()
        const newValue = !current
        // 先同步更新缓存,确保 UI 能立即反映变化
        settingsCache['proxyEnabled'] = newValue
        // 再异步保存到后端
        saveSettingToTauri('proxyEnabled', newValue)
    },
    getProxy: (): string => {
        return settingsCache['proxy'] || ''
    },
    setProxy: (address: string = null) => {
        settingsCache['proxy'] = address
        saveSettingToTauri('proxy', address)
    },

    // View
    getDefaultView: (): any => {
        return settingsCache['defaultView'] || 0 // ViewType.Cards
    },
    setDefaultView: (viewType: any) => {
        settingsCache['defaultView'] = viewType
        saveSettingToTauri('defaultView', viewType)
    },
    getViewConfigs: (viewType: any): any => {
        const key = `viewConfigs_${viewType}`
        return settingsCache[key] || {}
    },
    setViewConfigs: (viewType: any, configs: any) => {
        const key = `viewConfigs_${viewType}`
        settingsCache[key] = configs
        saveSettingToTauri(key, configs)
    },

    // Theme
    getThemeSettings: (): any => {
        return settingsCache['themeSettings'] || {}
    },
    setThemeSettings: (theme: any) => {
        settingsCache['themeSettings'] = theme
        saveSettingToTauri('themeSettings', theme)
    },
    shouldUseDarkColors: (): boolean => {
        return settingsCache['shouldUseDarkColors'] ?? false
    },
    addThemeUpdateListener: (callback: (shouldDark: boolean) => void) => {
        // Tauri 中暂不支持主题变化监听
        console.log('[Tauri Settings] Theme listener not implemented')
    },

    // Locale
    getCurrentLocale: (): string => {
        // Try localStorage first for synchronous access
        try {
            const cached = localStorage.getItem('localeSettings')
            if (cached) return cached
        } catch (e) {}
        return settingsCache['localeSettings'] || 'en-US'
    },
    setLocaleSettings: (locale: string) => {
        // Save to localStorage for synchronous access
        try {
            localStorage.setItem('localeSettings', locale)
        } catch (e) {}
        saveSettingToTauri('localeSettings', locale)
    },
    getLocaleSettings: (): string => {
        // Try localStorage first for synchronous access
        try {
            const cached = localStorage.getItem('localeSettings')
            if (cached) return cached
        } catch (e) {}
        return settingsCache['localeSettings'] || 'en-US'
    },

    // Fetch
    getFetchInterval: (): number => {
        return settingsCache['fetchInterval'] || 30
    },
    setFetchInterval: (interval: number) => {
        settingsCache['fetchInterval'] = interval
        saveSettingToTauri('fetchInterval', interval)
    },

    // Search
    getSearchEngine: (): number => {
        return settingsCache['searchEngine'] || 0
    },
    setSearchEngine: (engine: number) => {
        settingsCache['searchEngine'] = engine
        saveSettingToTauri('searchEngine', engine)
    },

    // Filter
    getFilterType: (): number => {
        return settingsCache['filterType'] ?? 0
    },
    setFilterType: (type: number) => {
        settingsCache['filterType'] = type
        saveSettingToTauri('filterType', type)
    },

    // Integration
    getIntegrationSettings: (): any => {
        // Try localStorage first for synchronous access
        try {
            const cached = localStorage.getItem('integrationSettings')
            if (cached) return JSON.parse(cached)
        } catch (e) {}
        return settingsCache['integrationSettings'] || {}
    },
    setIntegrationSettings: (settings: any) => {
        // Save to localStorage for synchronous access
        try {
            localStorage.setItem('integrationSettings', JSON.stringify(settings))
        } catch (e) {}
        settingsCache['integrationSettings'] = settings
        saveSettingToTauri('integrationSettings', settings)
    },

    // Service
    getServiceConfigs: (): any => {
        return settingsCache['serviceConfigs'] || { type: 0 } // SyncService.None
    },
    setServiceConfigs: (configs: any) => {
        settingsCache['serviceConfigs'] = configs
        saveSettingToTauri('serviceConfigs', configs)
    },

    // Source Status
    getSourceStatus: (): any => {
        return settingsCache['sourceStatus'] || {}
    },
    setSourceStatus: (status: any) => {
        settingsCache['sourceStatus'] = status
        saveSettingToTauri('sourceStatus', status)
    },

    // NeDB
    getNeDBStatus: (): boolean => {
        return settingsCache['neDBStatus'] ?? false
    },
    setNeDBStatus: (status: boolean) => {
        settingsCache['neDBStatus'] = status
        saveSettingToTauri('neDBStatus', status)
    },

    // Font
    getFont: (): string => {
        return settingsCache['font'] || ''
    },
    setFont: (font: string) => {
        settingsCache['font'] = font
        saveSettingToTauri('font', font)
    },
    getFontSize: (): number => {
        return settingsCache['fontSize'] || 14
    },
    setFontSize: (size: number) => {
        settingsCache['fontSize'] = size
        saveSettingToTauri('fontSize', size)
    },

    // All settings
    getAll: (): any => {
        return { ...settingsCache }
    },
    setAll: (configs: any) => {
        settingsCache = { ...settingsCache, ...configs }
        // 保存到 Tauri 后端
        Object.keys(configs).forEach(key => {
            saveSettingToTauri(key, configs[key])
        })
    },
}

export default tauriSettingsBridge
