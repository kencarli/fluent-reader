import { RSSItem } from "./models/item"
import { RSSSource } from "./models/source"

export function generateFrontmatter(item: RSSItem, source: RSSSource): string {
    const safeTitle = (item.title || "Untitled").replace(/"/g, '\\"')
    const dateStr = new Date(item.date).toISOString()

    return `---
title: "${safeTitle}"
source: "${source.name}"
author: "${item.creator || ""}"
date: ${dateStr}
url: "${item.link}"
---

`
}

export function htmlToMarkdown(html: string): string {
    if (!html) return ""

    const parser = new DOMParser()
    const doc = parser.parseFromString(html, "text/html")

    // Helper to traverse and convert
    function convertNode(node: Node): string {
        if (node.nodeType === Node.TEXT_NODE) {
            return node.textContent || ""
        }

        if (node.nodeType !== Node.ELEMENT_NODE) {
            return ""
        }

        const el = node as HTMLElement
        const tagName = el.tagName.toLowerCase()

        // Process children first
        let childrenMarkdown = Array.from(el.childNodes)
            .map(convertNode)
            .join("")

        // Clean up whitespace for block elements
        // This is a naive implementation

        switch (tagName) {
            case "h1": return `\n# ${childrenMarkdown}\n`
            case "h2": return `\n## ${childrenMarkdown}\n`
            case "h3": return `\n### ${childrenMarkdown}\n`
            case "h4": return `\n#### ${childrenMarkdown}\n`
            case "h5": return `\n##### ${childrenMarkdown}\n`
            case "h6": return `\n###### ${childrenMarkdown}\n`

            case "p": return `\n${childrenMarkdown}\n`
            case "br": return "  \n"
            case "hr": return "\n---\n"

            case "b":
            case "strong": return `**${childrenMarkdown}**`

            case "i":
            case "em": return `*${childrenMarkdown}*`

            case "a":
                const href = el.getAttribute("href") || ""
                return `[${childrenMarkdown}](${href})`

            case "img":
                const src = el.getAttribute("src") || ""
                const alt = el.getAttribute("alt") || "image"
                return `![${alt}](${src})`

            case "code": return `\`${childrenMarkdown}\``
            case "pre": return `\n\`\`\`\n${childrenMarkdown}\n\`\`\`\n`

            case "blockquote":
                return `\n> ${childrenMarkdown.replace(/\n/g, "\n> ")}\n`

            case "ul":
                // This is tricky without knowing context, simplistically handling direct li children
                return `\n${childrenMarkdown}\n`
            case "ol":
                return `\n${childrenMarkdown}\n`
            case "li":
                return `- ${childrenMarkdown}\n`

            default:
                return childrenMarkdown
        }
    }

    // Process body
    let md = convertNode(doc.body)

    // Post-processing cleanup
    // Remove excessive newlines
    md = md.replace(/\n{3,}/g, "\n\n").trim()

    return md
}
