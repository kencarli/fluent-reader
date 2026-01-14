import { RSSItem, updateSyncStatus, SyncStatus } from "./models/item"
import { AppThunk } from "./utils"
import { IntegrationSettings } from "../schema-types"
import { htmlToMarkdown } from "./exporter"
import Mustache from "mustache"
import path from "path"

import Parser from "@postlight/parser"

// Sanitize title for use as a filename
function sanitizeTitle(title: string): string {
    return title.replace(/[\\/:"*?<>|]+/g, "-")
}

export function sendToObsidian(item: RSSItem): AppThunk<Promise<void>> {
    return async (dispatch, getState) => {
        const settings = window.settings.getIntegrationSettings()
        if (!settings.obsidianVaultPath || !settings.obsidianTemplate) {
            window.utils.showMessageBox(
                "Obsidian Sync Failed", 
                "Obsidian Vault Path or Template is not configured.", 
                "OK", "", false, "error"
            )
            return
        }
        dispatch(updateSyncStatus(item, SyncStatus.Syncing))
        try {
            const { obsidianVaultPath, obsidianTemplate } = settings
            
            // L1: Full-text extraction
            let articleContent = item.content;
            try {
                const parsed = await Parser.parse(item.link);
                if (parsed && parsed.content) {
                    articleContent = parsed.content;
                }
            } catch (error) {
                console.warn(`Failed to parse full content for ${item.link}, falling back to RSS content.`, error);
            }

            // TODO: Fetch highlights for the item. For now, using a placeholder.
            const highlights = [] 

            const data = {
                title: item.title || "Untitled",
                url: item.link,
                content: htmlToMarkdown(articleContent),
                tags: item.tags || "",
                author: item.creator || 'N/A',
                publicationDate: item.date.toISOString().split('T')[0], // YYYY-MM-DD
                feedTitle: getState().sources[item.source].name,
                highlights: highlights,
            }

            // L2: Structured Metadata (YAML Frontmatter)
            const frontmatter = `---
url: ${data.url}
author: ${data.author}
publication_date: ${data.publicationDate}
source: "${data.feedTitle}"
tags: [${data.tags.split(',').map(t => t.trim()).filter(t => t).join(', ')}]
---

`
            const finalContent = frontmatter + Mustache.render(obsidianTemplate, data)
            const fileName = sanitizeTitle(data.title) + ".md"
            const filePath = path.join(obsidianVaultPath, fileName)

            const success = await window.utils.writeFile(filePath, finalContent)

            if (success) {
                // L3: Actionable Feedback
                const obsidianUri = `obsidian://open?path=${encodeURIComponent(filePath)}`
                window.utils.showMessageBox(
                    "Obsidian Sync Successful",
                    `Successfully sent to Obsidian. <a href="${obsidianUri}">View Note</a>`,
                    "OK",
                    "",
                    true // Set to true to interpret the message as HTML
                );
                dispatch(updateSyncStatus(item, SyncStatus.Synced))
            } else {
                // Error message is shown by the main process
                dispatch(updateSyncStatus(item, SyncStatus.Failed))
            }
        } catch (err: unknown) {
            let errorMessage = String(err);
            if (err instanceof Error) {
                errorMessage = err.message;
            } else if (typeof err === 'object' && err !== null && 'message' in err && typeof (err as any).message === 'string') {
                errorMessage = (err as any).message;
            }
            dispatch(updateSyncStatus(item, SyncStatus.Failed))
            console.error(err)
            window.utils.showMessageBox("Obsidian Sync Failed", errorMessage, "OK", "", false, "error")
        }
    }
}

function markdownToNotionBlocks(markdown: string): any[] {
    const blocks = [];
    const lines = markdown.split('\n');
    let inCodeBlock = false;
    let codeBlockContent = '';
    let language = '';

    for (const line of lines) {
        if (inCodeBlock) {
            if (line.startsWith('```')) {
                blocks.push({
                    object: 'block',
                    type: 'code',
                    code: {
                        rich_text: [{ type: 'text', text: { content: codeBlockContent } }],
                        language: language || 'plain text',
                    },
                });
                inCodeBlock = false;
                codeBlockContent = '';
            } else {
                codeBlockContent += line + '\n';
            }
            continue;
        }

        if (line.startsWith('```')) {
            inCodeBlock = true;
            language = line.substring(3).trim();
            continue;
        }

        if (line.startsWith('# ')) {
            blocks.push({ object: 'block', type: 'heading_1', heading_1: { rich_text: [{ type: 'text', text: { content: line.substring(2) } }] } });
        } else if (line.startsWith('## ')) {
            blocks.push({ object: 'block', type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: line.substring(3) } }] } });
        } else if (line.startsWith('### ')) {
            blocks.push({ object: 'block', type: 'heading_3', heading_3: { rich_text: [{ type: 'text', text: { content: line.substring(4) } }] } });
        } else if (line.startsWith('- ')) {
            blocks.push({ object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ type: 'text', text: { content: line.substring(2) } }] } });
        } else if (line.trim().length > 0) {
            blocks.push({ object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: line } }] } });
        }
    }
    return blocks;
}

export function sendToNotion(item: RSSItem): AppThunk<Promise<void>> {
    return async (dispatch, getState) => {
        const settings = window.settings.getIntegrationSettings()
        if (!settings.notionSecret || !settings.notionDatabaseId) return
        dispatch(updateSyncStatus(item, SyncStatus.Syncing))
        try {
            const {
                notionSecret,
                notionDatabaseId,
                notionTitlePropertyName,
                notionUrlPropertyName,
                notionTagsPropertyName,
                notionAuthorPropertyName,
                notionDatePropertyName,
                notionSourcePropertyName,
            } = settings
            const title = item.title || "Untitled"

            // L1: Full-text extraction
            let articleContent = item.content;
            try {
                const parsed = await Parser.parse(item.link);
                if (parsed && parsed.content) {
                    articleContent = parsed.content;
                }
            } catch (error) {
                console.warn(`Failed to parse full content for ${item.link}, falling back to RSS content.`, error);
            }

            const content = htmlToMarkdown(articleContent)
            const blocks = markdownToNotionBlocks(content);

            // L2: Structured Metadata
            const properties: any = {
                [notionTitlePropertyName || "Name"]: {
                    title: [{ text: { content: title } }],
                },
            };

            if (notionUrlPropertyName) {
                properties[notionUrlPropertyName] = { url: item.link };
            }
            if (notionTagsPropertyName && item.tags) {
                properties[notionTagsPropertyName] = {
                    multi_select: item.tags.split(',').map(t => t.trim()).filter(t => t).map(name => ({ name })),
                };
            }
            if (notionAuthorPropertyName && item.creator) {
                properties[notionAuthorPropertyName] = {
                    rich_text: [{ text: { content: item.creator } }],
                };
            }
            if (notionDatePropertyName && item.date) {
                properties[notionDatePropertyName] = {
                    date: { start: item.date.toISOString().split('T')[0] },
                };
            }
            if (notionSourcePropertyName) {
                const feedTitle = getState().sources[item.source].name;
                properties[notionSourcePropertyName] = {
                    select: { name: feedTitle },
                };
            }

            const body = {
                parent: { database_id: notionDatabaseId },
                properties: properties,
                children: blocks,
            }
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
                const errText = await response.text();
                let err: { message?: string } = {};
                try {
                    err = JSON.parse(errText);
                } catch (e) {
                    err = { message: errText };
                }
                throw new Error(`Notion API Error: ${err.message || errText}`)
            }

            const notionPage = await response.json();
            
            // L3: Actionable Feedback
            window.utils.showMessageBox(
                "Notion Sync Successful", 
                `Successfully sent to Notion. <a href="${notionPage.url}" target="_blank">View Note</a>`,
                "OK",
                "",
                true // Set to true to interpret the message as HTML
            );

            dispatch(updateSyncStatus(item, SyncStatus.Synced))
        } catch (err: unknown) {
            let errorMessage = String(err);
            if (err instanceof Error) {
                errorMessage = err.message;
            } else if (typeof err === 'object' && err !== null && 'message' in err && typeof (err as any).message === 'string') {
                errorMessage = (err as any).message;
            }
            dispatch(updateSyncStatus(item, SyncStatus.Failed))
            console.log(err)
            window.utils.showMessageBox("Notion Sync Failed", errorMessage, "OK", "", false, "error")
        }
    }
}

export function testObsidianConnection(settings: IntegrationSettings): boolean {
    return !!settings.obsidianVaultPath
}

export async function getNotionDatabases(token: string): Promise<any[]> {
    const response = await fetch("https://api.notion.com/v1/search", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
            "Notion-Version": "2022-06-28",
        },
        body: JSON.stringify({
            filter: {
                value: "database",
                property: "object",
            },
        }),
    })
    if (!response.ok) {
        const err = await response.json()
        throw new Error(`Notion API Error: ${err.message}`)
    }
    const data = await response.json()
    return data.results
}

export async function getNotionDatabaseProperties(token: string, databaseId: string): Promise<any> {
    const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Notion-Version": "2022-06-28",
        },
    })
    if (!response.ok) {
        const err = await response.json()
        throw new Error(`Notion API Error: ${err.message}`)
    }
    const data = await response.json()
    return data.properties
}

export async function testNotionConnection(settings: IntegrationSettings): Promise<boolean> {
    if (!settings.notionSecret || !settings.notionDatabaseId) {
        throw new Error("Notion Integration Token or Database ID is not configured.")
    }

    const response = await fetch("https://api.notion.com/v1/users", {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${settings.notionSecret}`,
            "Notion-Version": "2022-06-28",
        },
    })

    if (!response.ok) {
        const err = await response.text()
        throw new Error(`Notion API Error: ${err}`)
    }

    return true
}