/**
 * Tauri 适配层
 * 替换原有的 Electron IPC 调用
 */

import { invoke } from '@tauri-apps/api/core'
import { open, save, message } from '@tauri-apps/plugin-dialog'
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'
import { open as openUrl } from '@tauri-apps/plugin-shell'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { listen } from '@tauri-apps/api/event'

// ==================== RSS 相关 ====================

export async function fetchRSS(url: string): Promise<string> {
    return await invoke<string>('fetch_rss_feed', { url })
}

export async function fetchMultipleRSS(urls: string[]): Promise<[string, string | Error][]> {
    const results = await invoke<[string, string | Error][]>('fetch_multiple_feeds', { urls })
    return results.map(([url, result]) => {
        if (typeof result === 'string') {
            return [url, result] as [string, string]
        }
        return [url, new Error(String(result))] as [string, Error]
    })
}

// ==================== 网页内容获取 ====================

export async function fetchWebpage(url: string): Promise<string> {
    return await invoke<string>('fetch_webpage', { url })
}

// ==================== Ollama 代理 ====================

export async function proxyOllama(url: string, method: string = 'POST', body?: any): Promise<any> {
    return await invoke('proxy_ollama', { 
        request: { 
            url, 
            method, 
            body 
        } 
    })
}

// ==================== 文件操作 ====================

export async function openFile(filters: { name: string, extensions: string[] }[] = []): Promise<string | null> {
    const selected = await open({
        multiple: false,
        filters: filters.length > 0 ? filters : undefined
    })
    if (selected) {
        return await readTextFile(selected as string)
    }
    return null
}

export async function saveFile(defaultPath: string, content: string): Promise<boolean> {
    const selected = await save({
        defaultPath,
        filters: [{ name: 'Markdown', extensions: ['md'] }]
    })
    if (selected) {
        await writeTextFile(selected as string, content)
        return true
    }
    return false
}

export async function readFile(path: string): Promise<string> {
    return await readTextFile(path)
}

export async function writeFile(path: string, content: string): Promise<boolean> {
    try {
        await writeTextFile(path, content)
        return true
    } catch {
        return false
    }
}

// ==================== 系统操作 ====================

export async function openExternal(url: string, background = false): Promise<void> {
    await openUrl(url)
}

export function getAppVersion(): Promise<string> {
    return invoke('get_app_version')
}

export function getAppDataDir(): Promise<string> {
    return invoke('get_app_data_dir')
}

export async function writeClipboard(text: string): Promise<void> {
    await invoke('write_clipboard', { text })
}

export async function showErrorBox(title: string, content: string): Promise<void> {
    await invoke('show_error_box', { title, content })
}

export async function showMessageBox(
    title: string,
    msg: string,
    confirm: string,
    cancel: string,
    defaultCancel = false,
    type = 'none'
): Promise<boolean> {
    // 使用 Tauri 的对话框 API
    // Tauri v2 的 message 函数参数不同
    try {
        await message(msg, {
            title,
            kind: type === 'error' ? 'error' : type === 'warning' ? 'warning' : 'info'
        })
        return true // 假设用户确认
    } catch {
        return false // 用户取消或错误
    }
}

// ==================== 窗口操作 ====================

export async function closeWindow(): Promise<void> {
    await getCurrentWindow().close()
}

export async function minimizeWindow(): Promise<void> {
    await getCurrentWindow().minimize()
}

export async function maximizeWindow(): Promise<void> {
    await getCurrentWindow().toggleMaximize()
}

export async function isMaximized(): Promise<boolean> {
    return await getCurrentWindow().isMaximized()
}

export async function isFullscreen(): Promise<boolean> {
    return await getCurrentWindow().isFullscreen()
}

export async function isFocused(): Promise<boolean> {
    return await getCurrentWindow().isFocused()
}

export async function requestFocus(): Promise<void> {
    await getCurrentWindow().setFocus()
}

export async function requestAttention(): Promise<void> {
    try {
        const win = getCurrentWindow()
        // 设置窗口置顶以吸引注意
        await win.setAlwaysOnTop(true)
        // 1秒后恢复
        setTimeout(async () => {
            await win.setAlwaysOnTop(false)
        }, 1000)
    } catch (error) {
        console.warn('[Tauri] requestAttention failed:', error)
    }
}

// ==================== 窗口拖拽（无标题栏模式）====================

/**
 * 启动窗口拖拽（用于自定义标题栏）
 */
export async function startDragging(): Promise<void> {
    try {
        await getCurrentWindow().startDragging()
    } catch (error) {
        console.error('[Tauri] Start dragging failed:', error)
    }
}

// ==================== 设置管理 ====================

export async function setSetting(key: string, value: any): Promise<void> {
    await invoke('set_setting', { key, value })
}

export async function getSetting(key: string): Promise<any> {
    return await invoke('get_setting', { key })
}

export async function getAllSettings(): Promise<any> {
    return await invoke('get_all_settings')
}

export async function importAllSettings(configs: any): Promise<void> {
    await invoke('import_all_settings', { configs })
}

// ==================== 缓存管理 ====================

export async function getCacheItem(key: string): Promise<any> {
    return await invoke('get_cache_item', { key })
}

export async function setCacheItem(key: string, value: any, ttl?: number): Promise<void> {
    await invoke('set_cache_item', { key, value, ttl })
}

export async function clearCache(): Promise<void> {
    await invoke('clear_cache')
}

export async function getCacheSize(): Promise<number> {
    return await invoke('get_cache_size')
}

// ==================== 事件监听 ====================

export async function addWindowStateListener(callback: (event: string) => void): Promise<void> {
    // 监听窗口最大化/全屏状态变化
    await listen('tauri://maximize', () => callback('maximized'))
    await listen('tauri://unmaximize', () => callback('unmaximized'))
    await listen('tauri://fullscreen', () => callback('enter-fullscreen'))
    await listen('tauri://window-resized', () => callback('resize'))
}

export async function addWindowFocusListener(callback: (focused: boolean) => void): Promise<void> {
    await listen('tauri://focus', () => callback(true))
    await listen('tauri://blur', () => callback(false))
}

// ==================== 字体列表（需要前端实现） ====================

export async function initFontList(): Promise<string[]> {
    // Tauri 没有内置字体列表 API，需要前端使用 document.fonts 获取
    return []
}

// ==================== 高亮功能（需要前端实现） ====================

export async function createHighlight(itemId: number, text: string, range: string): Promise<void> {
    // 高亮功能需要前端实现
    console.log('Create highlight:', { itemId, text, range })
}

export async function addHighlightCreatedListener(callback: (itemId: number, text: string, range: string) => void): Promise<void> {
    // 高亮创建监听器需要前端实现
    console.log('Highlight created listener registered')
}
