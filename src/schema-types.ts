export class SourceGroup {
    isMultiple: boolean
    sids: number[]
    name?: string
    expanded?: boolean
    index?: number // available only from menu or groups tab container

    constructor(sids: number[], name: string = null) {
        name = (name && name.trim()) || "Source group"
        if (sids.length == 1) {
            this.isMultiple = false
        } else {
            this.isMultiple = true
            this.name = name
            this.expanded = true
        }
        this.sids = sids
    }
}

export const enum ViewType {
    Cards,
    List,
    Magazine,
    Compact,
    Customized,
}

export const enum ViewConfigs {
    ShowCover = 1 << 0,
    ShowSnippet = 1 << 1,
    FadeRead = 1 << 2,
}

export const enum ThemeSettings {
    Default = "system",
    Light = "light",
    Dark = "dark",
}

export const enum SearchEngines {
    Google,
    Bing,
    Baidu,
    DuckDuckGo,
}

export const enum ImageCallbackTypes {
    OpenExternal,
    OpenExternalBg,
    SaveAs,
    Copy,
    CopyLink,
}

export const enum SyncService {
    None,
    Fever,
    Feedbin,
    GReader,
    Inoreader,
    Miniflux,
    Nextcloud,
}
export interface ServiceConfigs {
    type: SyncService
    importGroups?: boolean
}

export interface IntegrationSettings {
    obsidianVaultPath?: string
    obsidianTemplate?: string
    obsidianImageStrategy?: "hotlink" | "download"
    notionSecret?: string
    notionDatabaseId?: string
    notionTitlePropertyName?: string
    notionUrlPropertyName?: string
    notionTagsPropertyName?: string
    notionAuthorPropertyName?: string
    notionDatePropertyName?: string
    notionSourcePropertyName?: string
    onenoteAccessToken?: string
    onenoteUserId?: string
    onenoteUserName?: string
    onenoteNotebookId?: string
    onenoteAuthorized?: boolean
    evernoteToken?: string
    evernoteNotebookGuid?: string
    evernoteUserName?: string
    evernoteAuthorized?: boolean
    baiduTranslateAppId?: string
    baiduTranslateSecret?: string
    youdaoTranslateAppId?: string
    youdaoTranslateSecret?: string
    translationService?: "google" | "baidu" | "youdao" | "ollama" | "auto"
    translationMode?: "full" | "bilingual"
    ollamaApiUrl?: string
    ollamaModel?: string
    openaiApiKey?: string
    nvidiaApiKey?: string
    deepseekApiKey?: string
    dingtalkWebhook?: string
    wecomWebhook?: string
    digestTime?: string
    digestTopics?: string
    digestFeedId?: string       // Feed ID for digest (e.g., "s-1" for source, "g-1" for group, "all" for all)
    digestFilters?: DigestFilters  // Content filters for digest
    autoPushEnabled?: boolean
    dalleEnabled?: boolean
    lastDigestDate?: string
    _migratedToAutomation?: boolean  // Flag to track migration to automation rules
    syncRules?: SyncRule[]
}

// ============ Automation Rules ============

export type AutomationTrigger =
    | { type: 'schedule'; time: string; enabled: boolean }      //定时触发（如 "09:00"）
    | { type: 'newArticle'; sourceIds?: number[] }               // 新文章
    | { type: 'onRead'; sourceIds?: number[] }                   // 阅读时

export type AutomationAction =
    | { type: 'aiDigest'; provider?: 'openai' | 'nvidia' | 'deepseek' | 'ollama'; topics?: string[]; dalleEnabled?: boolean }
    | { type: 'pushDingTalk'; webhook: string; keyword?: string }
    | { type: 'pushWeCom'; webhook: string }
    | { type: 'sendToObsidian'; vaultPath?: string; template?: string }
    | { type: 'sendToNotion'; databaseId?: string }
    | { type: 'sendToOneNote'; notebookId?: string }
    | { type: 'sendToEvernote'; notebookGuid?: string }
    | { type: 'multiple'; actions: AutomationAction[] }  // 组合动作

export interface AutomationCondition {
    sourceIds?: number[]      // 订阅源 ID（已废弃，保留用于兼容）
    sourceNames?: string[]    // 订阅源名称（逗号分隔）
    feedId?: string           // 订阅源/组 ID (e.g., "s-1", "g-1")
    filterType?: string       // 过滤类型：'title' 或 'content'
    titleContains?: string[]  // 标题关键词
    contentContains?: string[] // 内容关键词
    authorContains?: string[]  // 作者关键词
    starredOnly?: boolean     // 仅星标文章
    articleDateRange?: string // 文章日期范围：'all' | '1d' | '3d' | '7d'
}

export interface AutomationRule {
    id: string
    name: string
    enabled: boolean
    trigger: AutomationTrigger
    condition: AutomationCondition
    actions: AutomationAction[]
    lastExecuted?: string
    executionCount?: number
    createdAt?: string
    updatedAt?: string
}

export type DigestFilters = {
    titleContains?: string[]    // Filter by title keywords
    contentContains?: string[]  // Filter by content keywords
    sourceIds?: number[]        // Filter by specific source IDs
    minArticles?: number        // Minimum number of articles required
    maxArticles?: number        // Maximum number of articles to include
}

// ============ Unified Automation Rules (replaces SyncRule) ============

export type SyncRuleCondition = {
    field: "sourceId" | "title" | "content" | "author" | "starred";
    operator: "is" | "isNot" | "contains" | "notContains";
    value: string;
};

export type SyncRuleAction = {
    type: "sendToObsidian" | "sendToNotion" | "sendToOneNote" | "sendToEvernote";
    destination?: string;
};

export type SyncRule = {
    id: string;
    name: string;
    enabled: boolean;  // Added for unified rules
    trigger: "newArticle" | "onRead";  // Added for unified rules
    conditions: SyncRuleCondition[];
    action: SyncRuleAction;
};

export const enum WindowStateListenerType {
    Maximized,
    Focused,
    Fullscreen,
}

export interface TouchBarTexts {
    menu: string
    search: string
    refresh: string
    markAll: string
    notifications: string
}

export type SchemaTypes = {
    version: string
    theme: ThemeSettings
    pac: string
    pacOn: boolean
    view: ViewType
    locale: string
    sourceGroups: SourceGroup[]
    fontSize: number
    fontFamily: string
    menuOn: boolean
    fetchInterval: number
    searchEngine: SearchEngines
    serviceConfigs: ServiceConfigs
    filterType: number
    listViewConfigs: ViewConfigs
    useNeDB: boolean
    integration: IntegrationSettings
    sourceStatus: { [sid: number]: { status: 'ok' | 'error' | 'checking' | null, timestamp: number } }
}
