import { DOMParser as XDOMParser } from "@xmldom/xmldom"

class SilentDOMParser extends XDOMParser {
    constructor(options?: any) {
        super({
            errorHandler: {
                warning: () => { },
                error: () => { },
                fatalError: () => { }
            },
            ...options
        })
    }
}

; (global as any).DOMParser = SilentDOMParser
    ; (global as any).navigator = { userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" }
    ; (global as any).requestAnimationFrame = (callback) => setTimeout(callback, 0)
    ; (global as any).cancelAnimationFrame = (id) => clearTimeout(id)
    ; (global as any).self = global
