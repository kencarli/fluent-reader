
export async function translateText(
    text: string,
    toLang: string = "zh-CN"
): Promise<string> {
    try {
        const url =
            `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${toLang}&dt=t&q=` +
            encodeURIComponent(text)
        const response = await fetch(url)
        if (!response.ok) {
            throw new Error(`Translation failed: ${response.statusText}`)
        }
        const data = await response.json()
        if (data && data[0]) {
            return data[0].map((item: any) => item[0]).join("")
        }
        return text
    } catch (error) {
        console.error("Translation error:", error)
        throw error
    }
}

export async function translateHtml(html: string, toLang: string = "zh-CN"): Promise<string> {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, "text/html")
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, null)
    const nodes: Node[] = []
    let node: Node
    while (node = walker.nextNode()) {
        if (node.nodeValue && node.nodeValue.trim().length > 0) {
            nodes.push(node)
        }
    }

    if (nodes.length === 0) return html

    // Batching
    const chunks: Node[][] = []
    let currentChunk: Node[] = []
    let currentLength = 0
    const MAX_LEN = 1500 // Conservative limit

    for (const n of nodes) {
        const len = n.nodeValue!.length
        // If a single node is too large, we might skip or truncate? 
        // For now, include it but force chunk break after
        if (currentLength + len > MAX_LEN && currentChunk.length > 0) {
            chunks.push(currentChunk)
            currentChunk = []
            currentLength = 0
        }
        currentChunk.push(n)
        currentLength += len
    }
    if (currentChunk.length > 0) chunks.push(currentChunk)

    for (const chunk of chunks) {
        // Use a delimiter that is unlikely to be messed up. 
        // Although Google Translate usually preserves newlines.
        const delimiter = "\n\n"
        const textToTranslate = chunk.map(n => n.nodeValue).join(delimiter)
        try {
            const translated = await translateText(textToTranslate, toLang)
            const translatedParts = translated.split(delimiter)

            // Assign back. If count mismatch, just try best effort.
            for (let i = 0; i < chunk.length && i < translatedParts.length; i++) {
                chunk[i].nodeValue = translatedParts[i]
            }
        } catch (e) {
            console.error("Chunk translation failed", e)
        }
    }

    return doc.body.innerHTML
}
