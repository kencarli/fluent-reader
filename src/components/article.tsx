import * as React from "react"
import intl from "react-intl-universal"
import { renderToString } from "react-dom/server"
import { RSSItem } from "../scripts/models/item"
import {
    Stack,
    CommandBarButton,
    IContextualMenuProps,
    FocusZone,
    ContextualMenuItemType,
    Spinner,
    Icon,
    Link,
} from "@fluentui/react"
import {
    RSSSource,
    SourceOpenTarget,
    SourceTextDirection,
} from "../scripts/models/source"
import { shareSubmenu } from "./context-menu"
import { platformCtrl, decodeFetchResponse } from "../scripts/utils"
import { translateHtml } from "../scripts/translate"
import { extractTextFromHtml, summarizeText } from "../scripts/summary"
import { generateFrontmatter, htmlToMarkdown } from "../scripts/exporter"
import { getObsidianUri, exportToNotion } from "../scripts/integrations"

const FONT_SIZE_OPTIONS = [12, 13, 14, 15, 16, 17, 18, 19, 20]

type ArticleProps = {
    item: RSSItem
    source: RSSSource
    locale: string
    shortcuts: (item: RSSItem, e: KeyboardEvent) => void
    dismiss: () => void
    offsetItem: (offset: number) => void
    toggleHasRead: (item: RSSItem) => void
    toggleStarred: (item: RSSItem) => void
    toggleHidden: (item: RSSItem) => void

    textMenu: (position: [number, number], text: string, url: string) => void
    imageMenu: (position: [number, number]) => void
    dismissContextMenu: () => void
    updateSourceTextDirection: (
        source: RSSSource,
        direction: SourceTextDirection
    ) => void
    search: (tag: string) => void
    findSimilar: (item: RSSItem) => void
}

type ArticleState = {
    fontFamily: string
    fontSize: number
    loadWebpage: boolean
    loadFull: boolean
    fullContent: string
    loaded: boolean
    error: boolean
    errorDescription: string
    translating: boolean
    translation: string
    showTranslation: boolean
    summarizing: boolean
    summary: string
    showSummary: boolean
}

class Article extends React.Component<ArticleProps, ArticleState> {
    webview: Electron.WebviewTag

    constructor(props: ArticleProps) {
        super(props)
        this.state = {
            fontFamily: window.settings.getFont(),
            fontSize: window.settings.getFontSize(),
            loadWebpage: props.source.openTarget === SourceOpenTarget.Webpage,
            loadFull: props.source.openTarget === SourceOpenTarget.FullContent,
            fullContent: "",
            loaded: false,
            error: false,
            errorDescription: "",
            translating: false,
            translation: null,
            showTranslation: false,
            summarizing: false,
            summary: null,
            showSummary: false,
        }
        window.utils.addWebviewContextListener(this.contextMenuHandler)
        window.utils.addWebviewKeydownListener(this.keyDownHandler)
        window.utils.addWebviewErrorListener(this.webviewError)
        if (props.source.openTarget === SourceOpenTarget.FullContent)
            this.loadFull()
    }

    setFontSize = (size: number) => {
        window.settings.setFontSize(size)
        this.setState({ fontSize: size })
    }
    setFont = (font: string) => {
        window.settings.setFont(font)
        this.setState({ fontFamily: font })
    }

    fontSizeMenuProps = (): IContextualMenuProps => ({
        items: FONT_SIZE_OPTIONS.map(size => ({
            key: String(size),
            text: String(size),
            canCheck: true,
            checked: size === this.state.fontSize,
            onClick: () => this.setFontSize(size),
        })),
    })

    fontFamilyMenuProps = (): IContextualMenuProps => ({
        items: window.fontList.map((font, idx) => ({
            key: String(idx),
            text: font === "" ? intl.get("default") : font,
            canCheck: true,
            checked: this.state.fontFamily === font,
            onClick: () => this.setFont(font),
        })),
    })

    updateTextDirection = (direction: SourceTextDirection) => {
        this.props.updateSourceTextDirection(this.props.source, direction)
    }

    directionMenuProps = (): IContextualMenuProps => ({
        items: [
            {
                key: "LTR",
                text: intl.get("article.LTR"),
                iconProps: { iconName: "Forward" },
                canCheck: true,
                checked: this.props.source.textDir === SourceTextDirection.LTR,
                onClick: () =>
                    this.updateTextDirection(SourceTextDirection.LTR),
            },
            {
                key: "RTL",
                text: intl.get("article.RTL"),
                iconProps: { iconName: "Back" },
                canCheck: true,
                checked: this.props.source.textDir === SourceTextDirection.RTL,
                onClick: () =>
                    this.updateTextDirection(SourceTextDirection.RTL),
            },
            {
                key: "Vertical",
                text: intl.get("article.Vertical"),
                iconProps: { iconName: "Down" },
                canCheck: true,
                checked:
                    this.props.source.textDir === SourceTextDirection.Vertical,
                onClick: () =>
                    this.updateTextDirection(SourceTextDirection.Vertical),
            },
        ],
    })

    moreMenuProps = (): IContextualMenuProps => ({
        items: [

            {
                key: "openInBrowser",
                text: intl.get("openExternal"),
                iconProps: { iconName: "NavigateExternalInline" },
                onClick: e => {
                    window.utils.openExternal(
                        this.props.item.link,
                        platformCtrl(e)
                    )
                },
            },
            {
                key: "findSimilar",
                text: "Find similar articles",
                iconProps: { iconName: "WaitlistConfirm" },
                onClick: () => {
                    this.props.findSimilar(this.props.item)
                },
            },
            {
                key: "copyURL",
                text: intl.get("context.copyURL"),
                iconProps: { iconName: "Link" },
                onClick: () => {
                    window.utils.writeClipboard(this.props.item.link)
                },
            },
            {
                key: "toggleHidden",
                text: this.props.item.hidden
                    ? intl.get("article.unhide")
                    : intl.get("article.hide"),
                iconProps: {
                    iconName: this.props.item.hidden ? "View" : "Hide3",
                },
                onClick: () => {
                    this.props.toggleHidden(this.props.item)
                },
            },
            {
                key: "fontMenu",
                text: intl.get("article.font"),
                iconProps: { iconName: "Font" },
                disabled: this.state.loadWebpage,
                subMenuProps: this.fontFamilyMenuProps(),
            },
            {
                key: "fontSizeMenu",
                text: intl.get("article.fontSize"),
                iconProps: { iconName: "FontSize" },
                disabled: this.state.loadWebpage,
                subMenuProps: this.fontSizeMenuProps(),
            },
            {
                key: "directionMenu",
                text: intl.get("article.textDir"),
                iconProps: { iconName: "ChangeEntitlements" },
                disabled: this.state.loadWebpage,
                subMenuProps: this.directionMenuProps(),
            },
            {
                key: "divider_1",
                itemType: ContextualMenuItemType.Divider,
            },
            {
                key: "exportMarkdown",
                text: intl.get("export.markdown") || "Copy Markdown", // Fallback if no intl key
                iconProps: { iconName: "MarkdownLogo" },
                onClick: () => {
                    const content = this.state.loadFull ? this.state.fullContent : this.props.item.content
                    const md = htmlToMarkdown(content)
                    const fm = generateFrontmatter(this.props.item, this.props.source)
                    window.utils.writeClipboard(fm + md)
                }
            },
            {
                key: "exportObsidian",
                text: "Export to Obsidian",
                iconProps: { iconName: "OneNoteLogo" }, // Use OneNote as placeholder
                disabled: !window.settings.getIntegrationSettings().obsidianVaultName,
                title: !window.settings.getIntegrationSettings().obsidianVaultName ? "Configure Vault Name in Settings > Integrations" : "Open in Obsidian",
                onClick: () => {
                    const vault = window.settings.getIntegrationSettings().obsidianVaultName
                    if (vault) {
                        const uri = getObsidianUri(this.props.item, vault)
                        window.utils.openExternal(uri)
                    }
                }
            },
            {
                key: "exportNotion",
                text: "Export to Notion",
                iconProps: { iconName: "Database" },
                disabled: !window.settings.getIntegrationSettings().notionSecret,
                title: !window.settings.getIntegrationSettings().notionSecret ? "Configure Notion API in Settings > Integrations" : "Upload to Notion",
                onClick: async () => {
                    try {
                        await exportToNotion(this.props.item, window.settings.getIntegrationSettings())
                        window.utils.showMessageBox("Success", "Article exported to Notion", "OK", "", false)
                    } catch (e) {
                        window.utils.showMessageBox("Export Failed", e.message, "OK", "", false, "error")
                    }
                }
            },
            {
                key: "saveMarkdown",
                text: "Save as Markdown",
                iconProps: { iconName: "Download" },
                onClick: () => {
                    const content = this.state.loadFull ? this.state.fullContent : this.props.item.content
                    const md = htmlToMarkdown(content)
                    const fm = generateFrontmatter(this.props.item, this.props.source)
                    const blob = new Blob([fm + md], { type: "text/markdown;charset=utf-8" })
                    const a = document.createElement("a")
                    a.href = URL.createObjectURL(blob)
                    const safeTitle = (this.props.item.title || "article").replace(/[\\/:*?"<>|]/g, "_")
                    a.download = `${safeTitle}.md`
                    a.click()
                }
            },
            {
                key: "divider_export",
                itemType: ContextualMenuItemType.Divider,
            },
            ...shareSubmenu(this.props.item),
        ],
    })

    contextMenuHandler = (pos: [number, number], text: string, url: string) => {
        if (pos) {
            if (text || url) this.props.textMenu(pos, text, url)
            else this.props.imageMenu(pos)
        } else {
            this.props.dismissContextMenu()
        }
    }

    keyDownHandler = (input: Electron.Input) => {
        if (input.type === "keyDown") {
            switch (input.key) {
                case "Escape":
                    this.props.dismiss()
                    break
                case "ArrowLeft":
                case "ArrowRight":
                    this.props.offsetItem(input.key === "ArrowLeft" ? -1 : 1)
                    break
                case "l":
                case "L":
                    this.toggleWebpage()
                    break
                case "w":
                case "W":
                    this.toggleFull()
                    break
                case "H":
                case "h":
                    if (!input.meta) this.props.toggleHidden(this.props.item)
                    break
                default:
                    const keyboardEvent = new KeyboardEvent("keydown", {
                        code: input.code,
                        key: input.key,
                        shiftKey: input.shift,
                        altKey: input.alt,
                        ctrlKey: input.control,
                        metaKey: input.meta,
                        repeat: input.isAutoRepeat,
                        bubbles: true,
                    })
                    this.props.shortcuts(this.props.item, keyboardEvent)
                    document.dispatchEvent(keyboardEvent)
                    break
            }
        }
    }

    webviewLoaded = () => {
        this.setState({ loaded: true })
    }
    webviewError = (reason: string) => {
        this.setState({ error: true, errorDescription: reason })
    }
    webviewReload = () => {
        if (this.webview) {
            this.setState({ loaded: false, error: false })
            this.webview.reload()
        } else if (this.state.loadFull) {
            this.loadFull()
        }
    }

    componentDidMount = () => {
        let webview = document.getElementById("article") as Electron.WebviewTag
        if (webview != this.webview) {
            this.webview = webview
            if (webview) {
                webview.focus()
                this.setState({ loaded: false, error: false })
                webview.addEventListener("did-stop-loading", this.webviewLoaded)
                let card = document.querySelector(
                    `#refocus div[data-iid="${this.props.item._id}"]`
                ) as HTMLElement
                // @ts-ignore
                if (card) card.scrollIntoViewIfNeeded()
            }
        }
    }
    componentDidUpdate = (prevProps: ArticleProps) => {
        if (prevProps.item._id != this.props.item._id) {
            this.setState({
                loadWebpage:
                    this.props.source.openTarget === SourceOpenTarget.Webpage,
                loadFull:
                    this.props.source.openTarget ===
                    SourceOpenTarget.FullContent,
                translating: false,
                translation: null,
                showTranslation: false,
                summarizing: false,
                summary: null,
                showSummary: false,
            })
            if (this.props.source.openTarget === SourceOpenTarget.FullContent)
                this.loadFull()
        }
        this.componentDidMount()
    }

    componentWillUnmount = () => {
        let refocus = document.querySelector(
            `#refocus div[data-iid="${this.props.item._id}"]`
        ) as HTMLElement
        if (refocus) refocus.focus()
    }

    toggleWebpage = () => {
        if (this.state.loadWebpage) {
            this.setState({ loadWebpage: false })
        } else if (
            this.props.item.link.startsWith("https://") ||
            this.props.item.link.startsWith("http://")
        ) {
            this.setState({ loadWebpage: true, loadFull: false })
        }
    }

    toggleFull = () => {
        if (this.state.loadFull) {
            this.setState({ loadFull: false })
        } else if (
            this.props.item.link.startsWith("https://") ||
            this.props.item.link.startsWith("http://")
        ) {
            this.setState({ loadFull: true, loadWebpage: false })
            this.loadFull()
        }
    }
    toggleTranslation = async () => {
        if (this.state.loadWebpage) return
        if (this.state.showTranslation) {
            this.setState({ showTranslation: false })
        } else if (this.state.translation) {
            this.setState({ showTranslation: true })
        } else {
            this.setState({ translating: true })
            try {
                const content = this.state.loadFull
                    ? this.state.fullContent
                    : this.props.item.content
                const translation = await translateHtml(content)
                this.setState({
                    translation: translation,
                    showTranslation: true,
                })
                if (this.state.showSummary) {
                    this.generateSummary(translation)
                }
            } catch (e) {
                console.error(e)
            } finally {
                this.setState({ translating: false })
            }
        }
    }

    generateSummary = async (htmlContent: string) => {
        this.setState({ summarizing: true })
        try {
            const text = extractTextFromHtml(htmlContent)
            // Use setTimeout to avoid freezing UI (basic async)
            await new Promise(resolve => setTimeout(resolve, 10))
            const summary = summarizeText(text, 5) // Extract 5 top sentences
            this.setState({
                summary: summary,
                showSummary: true,
            })
        } catch (e) {
            console.error(e)
        } finally {
            this.setState({ summarizing: false })
        }
    }

    toggleSummary = async () => {
        if (this.state.loadWebpage) return
        if (this.state.showSummary) {
            this.setState({ showSummary: false })
        } else if (this.state.summary && !this.state.showTranslation) {
            // If we have a summary and not translating, just show it.
            // But if we are translating, strict sync might require re-check,
            // However, let's assume if it exists and matches mode it's fine.
            // Actually, simplest is to always regenerate if switching on?
            // Or optimize.
            // Use case: Translate ON -> Summary ON. Need translated summary.
            // Use case: Summary ON -> Translate ON. Handler in toggleTranslation does it.
            // Use case: Translate OFF -> Summary ON. Need original summary.

            // Check if we need to regenerate
            const content = this.state.showTranslation && this.state.translation
                ? this.state.translation
                : this.state.loadFull
                    ? this.state.fullContent
                    : this.props.item.content

            // For now simple logic: if we have a summary, show it. 
            // Ideally we should track "summaryLanguage" or similar.
            // Let's just always generate to ensure sync, speed is fast enough for local textrank.
            this.generateSummary(content)
        } else {
            const content = this.state.showTranslation && this.state.translation
                ? this.state.translation
                : this.state.loadFull
                    ? this.state.fullContent
                    : this.props.item.content
            this.generateSummary(content)
        }
    }

    loadFull = async () => {
        this.setState({ fullContent: "", loaded: false, error: false })
        const link = this.props.item.link
        try {
            const result = await fetch(link)
            if (!result || !result.ok) throw new Error()
            const html = await decodeFetchResponse(result, true)
            if (link === this.props.item.link) {
                this.setState({ fullContent: html })
            }
        } catch {
            if (link === this.props.item.link) {
                this.setState({
                    loaded: true,
                    error: true,
                    errorDescription: "MERCURY_PARSER_FAILURE",
                })
            }
        }
    }

    articleView = () => {
        const content =
            this.state.showTranslation && this.state.translation
                ? this.state.translation
                : this.state.loadFull
                    ? this.state.fullContent
                    : this.props.item.content
        const a = encodeURIComponent(content)
        const h = encodeURIComponent(
            renderToString(
                <>
                    <p className="title">{this.props.item.title}</p>
                    <p className="date">
                        {this.props.item.date.toLocaleString(
                            this.props.locale,
                            { hour12: !this.props.locale.startsWith("zh") }
                        )}
                    </p>
                    {this.state.showSummary && this.state.summary && (
                        <div className="article-summary-block" style={{
                            padding: "12px 16px",
                            margin: "16px 0",
                            background: "var(--bg-secondary)",
                            borderLeft: "4px solid var(--theme-primary)",
                            borderRadius: "4px",
                            fontSize: "0.95em",
                            lineHeight: "1.6",
                            color: "var(--text-primary)"
                        }}>
                            <strong style={{ display: "block", marginBottom: "8px", opacity: 0.8 }}>AI Summary</strong>
                            {this.state.summary}
                        </div>
                    )}
                    {this.props.item.tags && this.props.item.tags.length > 0 && (
                        <div className="tags" style={{ marginBottom: 16 }}>
                            {this.props.item.tags.split(",").map(t => (
                                <span key={t}
                                    onClick={() => this.props.search(t)}
                                    style={{
                                        display: "inline-block",
                                        padding: "2px 8px",
                                        marginRight: 8,
                                        borderRadius: 12,
                                        fontSize: "0.85em",
                                        background: "var(--bg-secondary)",
                                        color: "var(--text-secondary)",
                                        border: "1px solid var(--border-color)",
                                        cursor: "pointer",
                                        userSelect: "none"
                                    }}>#{t}</span>
                            ))}
                        </div>
                    )}
                    <article></article>
                </>
            )
        )
        return `article/article.html?a=${a}&h=${h}&f=${encodeURIComponent(
            this.state.fontFamily
        )}&s=${this.state.fontSize}&d=${this.props.source.textDir}&u=${this.props.item.link
            }&m=${this.state.loadFull ? 1 : 0}`
    }

    render = () => (
        <FocusZone className="article">
            <Stack horizontal style={{ height: 36 }}>
                <span style={{ width: 96 }}></span>
                <Stack
                    className="actions"
                    grow
                    horizontal
                    tokens={{ childrenGap: 12 }}>
                    <Stack.Item grow>
                        <span className="source-name">
                            {this.state.loaded ? (
                                this.props.source.iconurl && (
                                    <img
                                        className="favicon"
                                        src={this.props.source.iconurl}
                                    />
                                )
                            ) : (
                                <Spinner size={1} />
                            )}
                            {this.props.source.name}
                            {this.props.item.creator && (
                                <span className="creator">
                                    {this.props.item.creator}
                                </span>
                            )}
                        </span>
                    </Stack.Item>
                    <CommandBarButton
                        title={
                            this.props.item.hasRead
                                ? intl.get("article.markUnread")
                                : intl.get("article.markRead")
                        }
                        iconProps={
                            this.props.item.hasRead
                                ? { iconName: "StatusCircleRing" }
                                : {
                                    iconName: "RadioBtnOn",
                                    style: {
                                        fontSize: 14,
                                        textAlign: "center",
                                    },
                                }
                        }
                        onClick={() =>
                            this.props.toggleHasRead(this.props.item)
                        }
                    />
                    <CommandBarButton
                        title={
                            this.props.item.starred
                                ? intl.get("article.unstar")
                                : intl.get("article.star")
                        }
                        iconProps={{
                            iconName: this.props.item.starred
                                ? "FavoriteStarFill"
                                : "FavoriteStar",
                        }}
                        onClick={() =>
                            this.props.toggleStarred(this.props.item)
                        }
                    />
                    <CommandBarButton
                        title={intl.get("article.loadFull")}
                        className={this.state.loadFull ? "active" : ""}
                        iconProps={{ iconName: "RawSource" }}
                        onClick={this.toggleFull}
                    />
                    <CommandBarButton
                        title={intl.get("article.loadWebpage")}
                        className={this.state.loadWebpage ? "active" : ""}
                        iconProps={{ iconName: "Globe" }}
                        onClick={this.toggleWebpage}
                    />
                    <CommandBarButton
                        title={
                            this.state.translating
                                ? intl.get("article.translating") ||
                                "Translating..."
                                : intl.get("article.translate") || "Translate"
                        }
                        className={this.state.showTranslation ? "active" : ""}
                        iconProps={{ iconName: "Dictionary" }}
                        disabled={
                            this.state.loadWebpage || this.state.translating
                        }
                        onClick={this.toggleTranslation}
                    />
                    <CommandBarButton
                        title={
                            this.state.summarizing
                                ? "Summarizing..."
                                : "AI Summary"
                        }
                        className={this.state.showSummary ? "active" : ""}
                        iconProps={{ iconName: "LightningBolt" }}
                        disabled={
                            this.state.loadWebpage || this.state.summarizing
                        }
                        onClick={this.toggleSummary}
                    />
                    <CommandBarButton
                        title={intl.get("more")}
                        iconProps={{ iconName: "More" }}
                        menuIconProps={{ style: { display: "none" } }}
                        menuProps={this.moreMenuProps()}
                    />

                </Stack>
                <Stack horizontal horizontalAlign="end" style={{ width: 112 }}>
                    <CommandBarButton
                        title={intl.get("close")}
                        iconProps={{ iconName: "BackToWindow" }}
                        onClick={this.props.dismiss}
                    />
                </Stack>
            </Stack>
            {(!this.state.loadFull || this.state.fullContent) && (
                <webview
                    id="article"
                    className={this.state.error ? "error" : ""}
                    key={
                        this.props.item._id +
                        (this.state.loadWebpage ? "_" : "") +
                        (this.state.loadFull ? "__" : "")
                    }
                    src={
                        this.state.loadWebpage
                            ? this.props.item.link
                            : this.articleView()
                    }
                    allowpopups={"true" as unknown as boolean}
                    webpreferences="contextIsolation,autoplayPolicy=document-user-activation-required"
                    partition={this.state.loadWebpage ? "sandbox" : undefined}
                />
            )}
            {this.state.error && (
                <Stack
                    className="error-prompt"
                    verticalAlign="center"
                    horizontalAlign="center"
                    tokens={{ childrenGap: 12 }}>
                    <Icon iconName="HeartBroken" style={{ fontSize: 32 }} />
                    <Stack
                        horizontal
                        horizontalAlign="center"
                        tokens={{ childrenGap: 7 }}>
                        <small>{intl.get("article.error")}</small>
                        <small>
                            <Link onClick={this.webviewReload}>
                                {intl.get("article.reload")}
                            </Link>
                        </small>
                    </Stack>
                    <span style={{ fontSize: 11 }}>
                        {this.state.errorDescription}
                    </span>
                </Stack>
            )}
        </FocusZone>
    )
}

export default Article
