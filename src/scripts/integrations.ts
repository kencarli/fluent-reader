import { RSSItem } from "./models/item"
import { RSSSource } from "./models/source"
import { IntegrationSettings } from "../schema-types"
import { htmlToMarkdown } from "./exporter"

export function getObsidianUri(item: RSSItem, vaultName: string): string {
    const title = encodeURIComponent(item.title || "Untitled")
    const content = encodeURIComponent(htmlToMarkdown(item.content))
    // Uses the 'advanced-uri' format or standard 'obsidian://new'
    // Standard: obsidian://new?vault=VaultName&name=NoteName&content=Content
    return `obsidian://new?vault=${encodeURIComponent(vaultName)}&name=${title}&content=${content}`
}

export async function exportToNotion(item: RSSItem, settings: IntegrationSettings) {
    if (!settings.notionSecret || !settings.notionDatabaseId) {
        throw new Error("Notion integration not configured")
    }

    const { notionSecret, notionDatabaseId } = settings
    const title = item.title || "Untitled"
    const content = htmlToMarkdown(item.content)

    // Notion API requires rich blocks, but for simplicity we can send basic text
    // Or we use their 'children' block structure. 
    // Sending raw markdown as a single text block is easiest for a start.
    // However, Notion API text blocks have a 2000 char limit. 
    // A robust implementation requires parsing markdown to blocks.

    // For V1, we will try to just create the page properties and maybe a link.
    // Uploading full content via API is complex without a library.

    const body = {
        parent: { database_id: notionDatabaseId },
        properties: {
            Name: {
                title: [
                    {
                        text: {
                            content: title,
                        },
                    },
                ],
            },
            URL: {
                url: item.link,
            },
            // Add date if property exists? Schema dependent. Safer to stick to minimal.
        },
        children: [
            {
                object: "block",
                type: "paragraph",
                paragraph: {
                    rich_text: [
                        {
                            type: "text",
                            text: {
                                content: content.substring(0, 2000) + (content.length > 2000 ? "\n\n(Truncated...)" : ""),
                            },
                        },
                    ],
                },
            },
        ],
    }

    // We need to use Electron's net module or fetch via proxy if configured.
    // In renderer, fetch respects window proxy settings usually.

    const response = await fetch("https://api.notion.com/v1/pages", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${notionSecret}`,
            "Content-Type": "application/json",
            "Notion-Version": "2022-06-28",
        },
        body: JSON.stringify(body),
    })

    if (!response.ok) {
        const err = await response.text()
        throw new Error(`Notion API Error: ${err}`)
    }
}
