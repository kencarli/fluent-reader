import { TrayIcon, TrayIconOptions } from '@tauri-apps/api/tray'
import { Image } from '@tauri-apps/api/image'
import { Menu, MenuItem, PredefinedMenuItem } from '@tauri-apps/api/menu'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { resourceDir } from '@tauri-apps/api/path'
import { join } from '@tauri-apps/api/path'
import { emit } from '@tauri-apps/api/event'

const TRAY_ID = 'fluent-reader'
let tray: TrayIcon | null = null
let isWindowVisible = true // 跟踪窗口可见状态


export interface TrayManagerOptions {
    onShow?: () => void
    onQuit?: () => void
}

/**
 * 创建系统托盘
 */
const SESSION_KEY = '_fluent_tray_created'

export async function createTray(options?: TrayManagerOptions): Promise<void> {
    // sessionStorage 在同一页面加载中持久存在，防止重复创建
    if (sessionStorage.getItem(SESSION_KEY)) {
        console.log('[Tray] 本页面已创建过托盘，跳过')
        return
    }

    // 先移除可能残留的同 ID 托盘图标，确保不重复
    try {
        await TrayIcon.removeById(TRAY_ID)
        console.log('[Tray] 已清理残留托盘（ID: ' + TRAY_ID + '）')
    } catch (_) {}
    tray = null

    sessionStorage.setItem(SESSION_KEY, '1')

    try {
        // 创建托盘菜单
        const menu = await Menu.new({
            items: [
                await MenuItem.new({
                    text: '显示 Fluent Reader',
                    action: async () => {
                        const mainWindow = getCurrentWindow()
                        await mainWindow.show()
                        await mainWindow.setFocus()
                        await mainWindow.unminimize()
                        isWindowVisible = true
                        options?.onShow?.()
                    }
                }),
                await PredefinedMenuItem.new({ item: 'Separator' }),
                await MenuItem.new({
                    text: '退出 Fluent Reader',
                    action: async () => {
                        options?.onQuit?.()
                        // 真正退出应用
                        const mainWindow = getCurrentWindow()
                        await mainWindow.close()
                    }
                })
            ]
        })

        // 创建托盘图标
        const resourcePath = await resourceDir()
        const iconPath = await join(resourcePath, 'icons/icon.ico')
        const iconImage = await Image.fromPath(iconPath)
        tray = await TrayIcon.new({
            id: TRAY_ID,
            icon: iconImage,
            menu: menu,
            tooltip: 'Fluent Reader',
            iconAsTemplate: false,
            // 左键点击不显示菜单，由 action 处理
            menuOnLeftClick: false,
            // 处理托盘事件
            action: async (event) => {
                // 左键单击：切换窗口显示/隐藏（排除右键）
                if (event.type === 'Click') {
                    const clickEvent = event as any
                    if (clickEvent.button !== 'Left') return // 右键由系统菜单处理
                    console.log('[Tray] Left click detected, isWindowVisible:', isWindowVisible)
                    
                    const mainWindow = getCurrentWindow()
                    
                    // 使用我们自己的状态跟踪，而不是依赖 Tauri API
                    if (!isWindowVisible) {
                        console.log('[Tray] Showing window')
                        await mainWindow.show()
                        await mainWindow.setFocus()
                        await mainWindow.unminimize()
                        await mainWindow.setFocus()
                        isWindowVisible = true
                        options?.onShow?.()
                    } else {
                        console.log('[Tray] Hiding window')
                        await mainWindow.hide()
                        isWindowVisible = false
                    }
                }
                // 双击：也切换窗口显示/隐藏
                else if (event.type === 'DoubleClick') {
                    console.log('[Tray] Double click detected, isWindowVisible:', isWindowVisible)
                    const mainWindow = getCurrentWindow()
                    
                    if (!isWindowVisible) {
                        console.log('[Tray] Showing window')
                        await mainWindow.show()
                        await mainWindow.setFocus()
                        await mainWindow.unminimize()
                        await mainWindow.setFocus()
                        isWindowVisible = true
                        options?.onShow?.()
                    } else {
                        console.log('[Tray] Hiding window')
                        await mainWindow.hide()
                        isWindowVisible = false
                    }
                }
                // 右键：显示菜单（Tauri 会自动处理）
            }
        })

        console.log('[Tray] 系统托盘已创建')
    } catch (error) {
        console.error('[Tray] 创建系统托盘失败:', error)
    }
}

/**
 * 销毁系统托盘
 */
export async function destroyTray(): Promise<void> {
    if (tray) {
        try {
            await tray.close()
            tray = null
            console.log('[Tray] 系统托盘已销毁')
        } catch (error) {
            console.error('[Tray] 销毁系统托盘失败:', error)
        }
    }
}

/**
 * 更新托盘菜单
 */
export async function updateTrayMenu(options?: TrayManagerOptions): Promise<void> {
    if (tray) {
        try {
            const menu = await Menu.new({
                items: [
                    await MenuItem.new({
                        text: '显示 Fluent Reader',
                        action: async () => {
                            const mainWindow = getCurrentWindow()
                            await mainWindow.show()
                            await mainWindow.setFocus()
                            options?.onShow?.()
                        }
                    }),
                    await PredefinedMenuItem.new({ item: 'Separator' }),
                    await MenuItem.new({
                        text: '退出 Fluent Reader',
                        action: async () => {
                            options?.onQuit?.()
                            const mainWindow = getCurrentWindow()
                            await mainWindow.close()
                        }
                    })
                ]
            })
            await tray.setMenu(menu)
        } catch (error) {
            console.error('[Tray] 更新托盘菜单失败:', error)
        }
    }
}
