import {
    SourceGroup,
    ViewType,
    ThemeSettings,
    SearchEngines,
    ServiceConfigs,
    ViewConfigs,
    IntegrationSettings,
} from "../schema-types"

// Try to use ipcRenderer if available (Electron environment)
// Fallback to localStorage for web/Tauri environments
let ipcRenderer: any = null
try {
    if (typeof window !== 'undefined' && (window as any).require) {
        ipcRenderer = (window as any).require('electron').ipcRenderer
    }
} catch (e) {
    // Not in Electron environment, use localStorage
    console.log('[Settings] Using localStorage fallback')
}

// Helper functions for localStorage fallback
const getFromStorage = (key: string, defaultValue: any = null): any => {
    try {
        const value = localStorage.getItem(key)
        return value !== null ? JSON.parse(value) : defaultValue
    } catch (e) {
        return defaultValue
    }
}

const setToStorage = (key: string, value: any): void => {
    try {
        localStorage.setItem(key, JSON.stringify(value))
    } catch (e) {
        console.error('[Settings] Failed to save to localStorage:', e)
    }
}

const settingsBridge = {
    saveGroups: (groups: SourceGroup[]) => {
        if (ipcRenderer) {
            ipcRenderer.invoke("set-groups", groups)
        } else {
            setToStorage("groups", groups)
        }
    },
    loadGroups: (): SourceGroup[] => {
        if (ipcRenderer) {
            return ipcRenderer.sendSync("get-groups")
        } else {
            return getFromStorage("groups", [])
        }
    },

    getDefaultMenu: (): boolean => {
        if (ipcRenderer) {
            return ipcRenderer.sendSync("get-menu")
        } else {
            return getFromStorage("defaultMenu", true)
        }
    },
    setDefaultMenu: (state: boolean) => {
        if (ipcRenderer) {
            ipcRenderer.invoke("set-menu", state)
        } else {
            setToStorage("defaultMenu", state)
        }
    },

    getProxyStatus: (): boolean => {
        if (ipcRenderer) {
            return ipcRenderer.sendSync("get-proxy-status")
        } else {
            return getFromStorage("proxyEnabled", false)
        }
    },
    toggleProxyStatus: () => {
        const current = settingsBridge.getProxyStatus()
        if (ipcRenderer) {
            ipcRenderer.send("toggle-proxy-status")
        } else {
            setToStorage("proxyEnabled", !current)
        }
    },
    getProxy: (): string => {
        if (ipcRenderer) {
            return ipcRenderer.sendSync("get-proxy")
        } else {
            return getFromStorage("proxy", "")
        }
    },
    setProxy: (address: string = null) => {
        if (ipcRenderer) {
            ipcRenderer.invoke("set-proxy", address)
        } else {
            setToStorage("proxy", address)
        }
    },

    getDefaultView: (): ViewType => {
        if (ipcRenderer) {
            return ipcRenderer.sendSync("get-view")
        } else {
            return getFromStorage("defaultView", ViewType.Cards)
        }
    },
    setDefaultView: (viewType: ViewType) => {
        if (ipcRenderer) {
            ipcRenderer.invoke("set-view", viewType)
        } else {
            setToStorage("defaultView", viewType)
        }
    },

    getThemeSettings: (): ThemeSettings => {
        if (ipcRenderer) {
            return ipcRenderer.sendSync("get-theme")
        } else {
            return getFromStorage("theme", ThemeSettings.Default)
        }
    },
    setThemeSettings: (theme: ThemeSettings) => {
        if (ipcRenderer) {
            ipcRenderer.invoke("set-theme", theme)
        } else {
            setToStorage("theme", theme)
        }
    },
    shouldUseDarkColors: (): boolean => {
        if (ipcRenderer) {
            return ipcRenderer.sendSync("get-theme-dark-color")
        } else {
            const theme = settingsBridge.getThemeSettings()
            if (theme === ThemeSettings.Light) return false
            if (theme === ThemeSettings.Dark) return true
            // Follow system
            return window.matchMedia('(prefers-color-scheme: dark)').matches
        }
    },
    addThemeUpdateListener: (callback: (shouldDark: boolean) => any) => {
        if (ipcRenderer) {
            ipcRenderer.on("theme-updated", (_, shouldDark) => {
                callback(shouldDark)
            })
        } else {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                callback(e.matches)
            })
        }
    },

    setLocaleSettings: (option: string) => {
        if (ipcRenderer) {
            ipcRenderer.invoke("set-locale", option)
        } else {
            setToStorage("locale", option)
        }
    },
    getLocaleSettings: (): string => {
        if (ipcRenderer) {
            return ipcRenderer.sendSync("get-locale-settings")
        } else {
            return getFromStorage("locale", "en-US")
        }
    },
    getCurrentLocale: (): string => {
        if (ipcRenderer) {
            return ipcRenderer.sendSync("get-locale")
        } else {
            return getFromStorage("currentLocale", "en-US")
        }
    },

    getFontSize: (): number => {
        if (ipcRenderer) {
            return ipcRenderer.sendSync("get-font-size")
        } else {
            return getFromStorage("fontSize", 16)
        }
    },
    setFontSize: (size: number) => {
        if (ipcRenderer) {
            ipcRenderer.invoke("set-font-size", size)
        } else {
            setToStorage("fontSize", size)
        }
    },

    getFont: (): string => {
        if (ipcRenderer) {
            return ipcRenderer.sendSync("get-font")
        } else {
            return getFromStorage("font", "")
        }
    },
    setFont: (font: string) => {
        if (ipcRenderer) {
            ipcRenderer.invoke("set-font", font)
        } else {
            setToStorage("font", font)
        }
    },

    getFetchInterval: (): number => {
        if (ipcRenderer) {
            return ipcRenderer.sendSync("get-fetch-interval")
        } else {
            return getFromStorage("fetchInterval", 30)
        }
    },
    setFetchInterval: (interval: number) => {
        if (ipcRenderer) {
            ipcRenderer.invoke("set-fetch-interval", interval)
        } else {
            setToStorage("fetchInterval", interval)
        }
    },

    getSearchEngine: (): SearchEngines => {
        if (ipcRenderer) {
            return ipcRenderer.sendSync("get-search-engine")
        } else {
            return getFromStorage("searchEngine", SearchEngines.Google)
        }
    },
    setSearchEngine: (engine: SearchEngines) => {
        if (ipcRenderer) {
            ipcRenderer.invoke("set-search-engine", engine)
        } else {
            setToStorage("searchEngine", engine)
        }
    },

    getServiceConfigs: (): ServiceConfigs => {
        if (ipcRenderer) {
            return ipcRenderer.sendSync("get-service-configs")
        } else {
            return getFromStorage("serviceConfigs", {})
        }
    },
    setServiceConfigs: (configs: ServiceConfigs) => {
        if (ipcRenderer) {
            ipcRenderer.invoke("set-service-configs", configs)
        } else {
            setToStorage("serviceConfigs", configs)
        }
    },

    getFilterType: (): number => {
        if (ipcRenderer) {
            return ipcRenderer.sendSync("get-filter-type")
        } else {
            return getFromStorage("filterType", null)
        }
    },
    setFilterType: (filterType: number) => {
        if (ipcRenderer) {
            ipcRenderer.invoke("set-filter-type", filterType)
        } else {
            setToStorage("filterType", filterType)
        }
    },

    getViewConfigs: (view: ViewType): ViewConfigs => {
        if (ipcRenderer) {
            return ipcRenderer.sendSync("get-view-configs", view)
        } else {
            return getFromStorage(`viewConfigs_${view}`, ViewConfigs.ShowCover)
        }
    },
    setViewConfigs: (view: ViewType, configs: ViewConfigs) => {
        if (ipcRenderer) {
            ipcRenderer.invoke("set-view-configs", view, configs)
        } else {
            setToStorage(`viewConfigs_${view}`, configs)
        }
    },

    getNeDBStatus: (): boolean => {
        if (ipcRenderer) {
            return ipcRenderer.sendSync("get-nedb-status")
        } else {
            return getFromStorage("nedbStatus", true)
        }
    },
    setNeDBStatus: (flag: boolean) => {
        if (ipcRenderer) {
            ipcRenderer.invoke("set-nedb-status", flag)
        } else {
            setToStorage("nedbStatus", flag)
        }
    },

    getAll: () => {
        if (ipcRenderer) {
            return ipcRenderer.sendSync("get-all-settings")
        } else {
            return { ...localStorage }
        }
    },

    setAll: configs => {
        if (ipcRenderer) {
            ipcRenderer.invoke("import-all-settings", configs)
        } else {
            Object.keys(configs).forEach(key => {
                setToStorage(key, configs[key])
            })
        }
    },

    getIntegrationSettings: (): IntegrationSettings => {
        if (ipcRenderer) {
            return ipcRenderer.sendSync("get-integration-settings")
        } else {
            return getFromStorage("integrationSettings", {})
        }
    },
    setIntegrationSettings: (settings: IntegrationSettings) => {
        if (ipcRenderer) {
            ipcRenderer.invoke("set-integration-settings", settings)
        } else {
            setToStorage("integrationSettings", settings)
        }
    },
    getSourceStatus: () => {
        if (ipcRenderer) {
            return ipcRenderer.sendSync("get-source-status")
        } else {
            return getFromStorage("sourceStatus", {})
        }
    },
    setSourceStatus: (status) => {
        if (ipcRenderer) {
            ipcRenderer.invoke("set-source-status", status)
        } else {
            setToStorage("sourceStatus", status)
        }
    },
}

declare global {
    interface Window {
        settings: typeof settingsBridge
    }
}

export default settingsBridge
