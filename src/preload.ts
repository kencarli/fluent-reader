import { contextBridge, ipcRenderer } from "electron"
import settingsBridge from "./bridges/settings"
import utilsBridge from "./bridges/utils"

contextBridge.exposeInMainWorld("settings", settingsBridge)
contextBridge.exposeInMainWorld("utils", utilsBridge)

// Direct electron IPC bridge for translation
contextBridge.exposeInMainWorld("electron", {
    invoke: async (channel: string, ...args: any[]): Promise<any> => {
        return await ipcRenderer.invoke(channel, ...args)
    }
})
