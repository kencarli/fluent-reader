import * as React from "react"
import intl from "react-intl-universal"
import {
    Label,
    Stack,
    TextField,
    PrimaryButton,
    Toggle,
    Dropdown,
    DefaultButton,
    Link,
    MessageBar,
    MessageBarType,
} from "@fluentui/react"
import { IntegrationSettings } from "../../schema-types"
import { testObsidianConnection, testNotionConnection } from "../../scripts/integrations"
import ObsidianSettingsModal from "./obsidian-modal"
import NotionSettingsModal from "./notion-modal"
import AIServicesModal from "./ai-services-modal"
import CloudNoteServicesModal from "./cloud-note-services-modal"
import { migrateDailyBriefingToRules } from "../../scripts/automation-service"

type IntegrationTabState = {
    settings: IntegrationSettings,
    notionDatabases: { key: string, text: string }[],
    notionProperties: any,
    isLoadingDatabases: boolean,
    isObsidianModalOpen: boolean,
    isNotionModalOpen: boolean,
    isAIServicesModalOpen: boolean,
    isCloudNoteServicesModalOpen: boolean,
    isTranslationModalOpen: boolean,
    translationTestResult: string | null,
    isTranslationTesting: boolean,
}

class IntegrationTab extends React.Component<{}, IntegrationTabState> {
    constructor(props) {
        super(props)
        this.state = {
            settings: window.settings.getIntegrationSettings() || {},
            notionDatabases: [],
            notionProperties: {},
            isLoadingDatabases: false,
            isObsidianModalOpen: false,
            isNotionModalOpen: false,
            isAIServicesModalOpen: false,
            isCloudNoteServicesModalOpen: false,
            isTranslationModalOpen: false,
            translationTestResult: null,
            isTranslationTesting: false,
        }

        // Migrate old daily briefing settings to automation rules
        migrateDailyBriefingToRules()
    }

    handleInputChange = (
        event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>,
        newValue?: string
    ) => {
        const name = (event.target as HTMLInputElement).name
        this.setState(prevState => {
            const newSettings = { ...prevState.settings, [name]: newValue }
            window.settings.setIntegrationSettings(newSettings)
            return { settings: newSettings }
        })
    }

    handleToggleChange = (
        event: React.FormEvent<HTMLElement>,
        checked: any,
        name?: string
    ) => {
        if (!name && event) name = (event.currentTarget as HTMLInputElement).name
        this.setState(prevState => {
            const newSettings = { ...prevState.settings, [name]: checked }
            window.settings.setIntegrationSettings(newSettings)
            return { settings: newSettings }
        })
    }

    openObsidianModal = () => {
        this.setState({ isObsidianModalOpen: true })
    }

    closeObsidianModal = () => {
        this.setState({ isObsidianModalOpen: false })
    }

    saveObsidianSettings = (settings: IntegrationSettings) => {
        this.setState({ settings })
        window.settings.setIntegrationSettings(settings)
    }

    openNotionModal = () => {
        this.setState({ isNotionModalOpen: true })
    }

    closeNotionModal = () => {
        this.setState({ isNotionModalOpen: false })
    }

    saveNotionSettings = (settings: IntegrationSettings) => {
        this.setState({ settings })
        window.settings.setIntegrationSettings(settings)
    }

    handleLoadNotionDatabases = async () => {
        if (!this.state.settings.notionSecret) {
            window.utils.showMessageBox("Error", intl.get("settings.integrations.pleaseEnterNotionToken"), "OK", "", false, "error");
            return;
        }
        this.setState({ isLoadingDatabases: true });
        try {
            const dbs = await window.utils.getNotionDatabases(this.state.settings.notionSecret);
            this.setState({
                notionDatabases: dbs.map(db => ({ key: db.id, text: db.title[0]?.plain_text || "Untitled" })),
                isLoadingDatabases: false,
            });
        } catch (err: unknown) {
            let errorMessage = String(err);
            if (err instanceof Error) {
                errorMessage = err.message;
            } else if (typeof err === 'object' && err !== null && 'message' in err && typeof (err as any).message === 'string') {
                errorMessage = (err as any).message;
            }
            window.utils.showMessageBox(intl.get("settings.integrations.errorLoadingDatabases"), errorMessage, "OK", "", false, "error");
            this.setState({ isLoadingDatabases: false });
        }
    }

    handleLoadNotionProperties = async (databaseId: string) => {
        if (!this.state.settings.notionSecret) return;
        try {
            const props = await window.utils.getNotionDatabaseProperties(this.state.settings.notionSecret, databaseId);
            this.setState({ notionProperties: props });
        } catch (err: unknown) {
            let errorMessage = String(err);
            if (err instanceof Error) {
                errorMessage = err.message;
            } else if (typeof err === 'object' && err !== null && 'message' in err && typeof (err as any).message === 'string') {
                errorMessage = (err as any).message;
            }
            window.utils.showMessageBox(intl.get("settings.integrations.errorLoadingProperties"), errorMessage, "OK", "", false, "error");
        }
    }

    handleNotionDbChange = (databaseId: string) => {
        this.handleToggleChange(null, databaseId, "notionDatabaseId");
        this.handleLoadNotionProperties(databaseId);
    }

    openAIServicesModal = () => {
        this.setState({ isAIServicesModalOpen: true })
    }

    closeAIServicesModal = () => {
        this.setState({ isAIServicesModalOpen: false })
    }

    saveAIServicesSettings = (settings: IntegrationSettings) => {
        this.setState({ settings })
        window.settings.setIntegrationSettings(settings)
    }

    openCloudNoteServicesModal = () => {
        this.setState({ isCloudNoteServicesModalOpen: true })
    }

    closeCloudNoteServicesModal = () => {
        this.setState({ isCloudNoteServicesModalOpen: false })
    }

    saveCloudNoteServicesSettings = (settings: IntegrationSettings) => {
        this.setState({ settings })
        window.settings.setIntegrationSettings(settings)
    }

    openTranslationModal = () => {
        this.setState({ isTranslationModalOpen: true })
    }

    closeTranslationModal = () => {
        this.setState({ isTranslationModalOpen: false })
    }

    saveTranslationSettings = (settings: IntegrationSettings) => {
        this.setState({ settings })
        window.settings.setIntegrationSettings(settings)
    }

    handleTestTranslation = async (service?: string) => {
        this.setState({ isTranslationTesting: true, translationTestResult: null })

        const { settings } = this.state
        const serviceToTest = service || settings.translationService || "auto"

        try {
            let success = false
            let message = ""

            if (serviceToTest === "baidu" || serviceToTest === "auto") {
                if (settings.baiduTranslateAppId && settings.baiduTranslateSecret) {
                    success = true
                    message = "百度翻译配置成功！"
                }
            }

            if (serviceToTest === "youdao" || serviceToTest === "auto") {
                if (settings.youdaoTranslateAppId && settings.youdaoTranslateSecret) {
                    try {
                        const { translateText } = await import('../../scripts/translate')
                        const testText = "Hello"
                        const result = await translateText(testText, "zh-CN")
                        if (result && result !== testText) {
                            success = true
                            message = `有道翻译测试成功！"${testText}" → "${result}"`
                        } else {
                            message = `有道翻译返回了原文，请检查密钥是否正确`
                        }
                    } catch (error) {
                        message = `有道翻译测试失败：${error instanceof Error ? error.message : '未知错误'}`
                    }
                }
            }

            if (serviceToTest === "google") {
                success = true
                message = "Google 翻译无需配置，可直接使用"
            }

            if (serviceToTest === "ollama" || serviceToTest === "auto") {
                if (settings.ollamaApiUrl && settings.ollamaModel) {
                    try {
                        const url = settings.ollamaApiUrl.replace(/\/$/, '') + '/api/tags'
                        const response = await fetch(url, { method: 'GET' })
                        if (response.ok) {
                            const data = await response.json()
                            const models = data.models || []
                            const hasModel = models.some((m: any) => m.name === settings.ollamaModel || m.name.startsWith(settings.ollamaModel + ':'))
                            if (hasModel) {
                                success = true
                                message = `Ollama 连接成功！模型 "${settings.ollamaModel}" 可用`
                            } else {
                                success = true
                                message = `Ollama 连接成功，但未找到模型 "${settings.ollamaModel}"。可用模型：${models.map((m: any) => m.name).join(', ')}`
                            }
                        } else {
                            message = `Ollama 连接失败：${response.statusText}`
                        }
                    } catch (error) {
                        message = `Ollama 连接失败：${error instanceof Error ? error.message : '无法连接到 Ollama 服务'}`
                    }
                }
            }

            if (!success) {
                message = "请先配置 API 密钥"
            }

            this.setState({ translationTestResult: message, isTranslationTesting: false })
        } catch (error) {
            this.setState({
                translationTestResult: `测试失败：${error instanceof Error ? error.message : '未知错误'}`,
                isTranslationTesting: false
            })
        }
    }


    handleTestObsidianConnection = async () => {
        const { obsidianVaultPath } = this.state.settings
        if (!obsidianVaultPath) {
            window.utils.showMessageBox(
                intl.get("settings.integrations.testConnection"),
                "Obsidian Vault Path is not configured.",
                intl.get("confirm"),
                "",
                false,
                "error"
            )
            return
        }
        try {
            const success = testObsidianConnection(this.state.settings)
            if (success) {
                window.utils.showMessageBox(
                    intl.get("settings.integrations.testConnection"),
                    "Obsidian connection successful!",
                    intl.get("confirm"),
                    "",
                    false
                )
            } else {
                window.utils.showMessageBox(
                    intl.get("settings.integrations.testConnection"),
                    "Obsidian vault path is not set.",
                    intl.get("confirm"),
                    "",
                    false,
                    "error"
                )
            }
        } catch (error) {
            window.utils.showMessageBox(
                intl.get("settings.integrations.testConnection"),
                `Obsidian connection failed: ${error.message}`,
                intl.get("confirm"),
                "",
                false,
                "error"
            )
        }
    }

    handleTestNotionConnection = async () => {
        const { notionSecret, notionDatabaseId } = this.state.settings
        if (!notionSecret || !notionDatabaseId) {
            window.utils.showMessageBox(
                intl.get("settings.integrations.testConnection"),
                "Notion Integration Token or Database ID is not configured.",
                intl.get("confirm"),
                "",
                false,
                "error"
            )
            return
        }
        try {
            await testNotionConnection(this.state.settings)
            window.utils.showMessageBox(
                intl.get("settings.integrations.testConnection"),
                "Notion connection successful!",
                intl.get("confirm"),
                "",
                false
            )
        } catch (error) {
            window.utils.showMessageBox(
                intl.get("settings.integrations.testConnection"),
                `Notion connection failed: ${error.message}`,
                intl.get("confirm"),
                "",
                false,
                "error"
            )
        }
    }

    render() {
        const { settings } = this.state
        return (
            <div className="tab-body">
                <ObsidianSettingsModal
                    isOpen={this.state.isObsidianModalOpen}
                    settings={this.state.settings}
                    onDismiss={this.closeObsidianModal}
                    onSave={this.saveObsidianSettings}
                />

                <NotionSettingsModal
                    isOpen={this.state.isNotionModalOpen}
                    settings={this.state.settings}
                    notionDatabases={this.state.notionDatabases}
                    notionProperties={this.state.notionProperties}
                    isLoadingDatabases={this.state.isLoadingDatabases}
                    onDismiss={this.closeNotionModal}
                    onSave={this.saveNotionSettings}
                    onLoadDatabases={this.handleLoadNotionDatabases}
                    onDatabaseChange={this.handleNotionDbChange}
                />

                <AIServicesModal
                    isOpen={this.state.isAIServicesModalOpen}
                    settings={this.state.settings}
                    onDismiss={this.closeAIServicesModal}
                    onSave={this.saveAIServicesSettings}
                />

                <CloudNoteServicesModal
                    isOpen={this.state.isCloudNoteServicesModalOpen}
                    settings={this.state.settings}
                    onDismiss={this.closeCloudNoteServicesModal}
                    onSave={this.saveCloudNoteServicesSettings}
                />

                {/* Translation Services Section */}
                <Label
                    style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                    {intl.get("settings.translation.title")}
                </Label>
                <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 16 }} style={{ marginBottom: 16 }}>
                    <Stack.Item grow>
                        <Stack horizontal tokens={{ childrenGap: 8 }} wrap>
                            {this.getTranslationSummary().split('\n').map((text, index) => (
                                <Label key={index} style={{ fontSize: 12, color: text.includes("Not configured") ? "var(--neutralTertiary)" : "var(--green)", margin: 0, paddingRight: 8 }}>
                                    {text}
                                </Label>
                            ))}
                        </Stack>
                    </Stack.Item>
                    <Stack.Item>
                        <PrimaryButton
                            text={intl.get("settings.translation.configure")}
                            onClick={this.openTranslationModal}
                            allowDisabledFocus
                            iconProps={{ iconName: "Translate" }}
                        />
                    </Stack.Item>
                </Stack>

                {this.state.isTranslationModalOpen && (
                    <div style={{ padding: 16, background: 'var(--neutralLighter)', borderRadius: 4, marginBottom: 16 }}>
                        <Stack tokens={{ childrenGap: 12 }}>
                            <Label style={{ fontSize: 14, fontWeight: 600 }}>快速配置</Label>

                            {/* 翻译服务和翻译模式在同一行 */}
                            <Stack horizontal tokens={{ childrenGap: 16 }} style={{ alignItems: 'flex-end' }}>
                                <Dropdown
                                    label="翻译服务"
                                    selectedKey={settings.translationService || "auto"}
                                    options={[
                                        { key: "auto", text: "自动（失败时切换）" },
                                        { key: "google", text: "Google 翻译" },
                                        { key: "baidu", text: "百度翻译" },
                                        { key: "youdao", text: "有道翻译" },
                                        { key: "ollama", text: "Ollama (本地 AI)" },
                                    ]}
                                    onChange={(_, option) => {
                                        this.setState(prevState => ({
                                            settings: { ...prevState.settings, translationService: option.key as "auto" | "google" | "baidu" | "youdao" | "ollama" }
                                        }))
                                        window.settings.setIntegrationSettings({ ...settings, translationService: option.key as "auto" | "google" | "baidu" | "youdao" | "ollama" })
                                    }}
                                    styles={{ root: { width: 220 } }}
                                />

                                <Dropdown
                                    label="翻译模式"
                                    selectedKey={settings.translationMode || "full"}
                                    options={[
                                        { key: "full", text: "仅目标语言" },
                                        { key: "bilingual", text: "双语对照" },
                                    ]}
                                    onChange={(_, option) => {
                                        this.setState(prevState => ({
                                            settings: { ...prevState.settings, translationMode: option.key as "full" | "bilingual" }
                                        }))
                                        window.settings.setIntegrationSettings({ ...settings, translationMode: option.key as "full" | "bilingual" })
                                    }}
                                    styles={{ root: { width: 180 } }}
                                />
                            </Stack>

                            {/* Baidu */}
                            <Stack horizontal tokens={{ childrenGap: 8 }} style={{ alignItems: 'flex-end' }}>
                                <TextField
                                    label="百度翻译 AppID"
                                    value={settings.baiduTranslateAppId || ""}
                                    onChange={(e, v) => {
                                        this.setState(prevState => ({ settings: { ...prevState.settings, baiduTranslateAppId: v } }))
                                        window.settings.setIntegrationSettings({ ...settings, baiduTranslateAppId: v })
                                    }}
                                    styles={{ root: { width: 200 } }}
                                />
                                <TextField
                                    label="百度密钥"
                                    type="password"
                                    value={settings.baiduTranslateSecret || ""}
                                    onChange={(e, v) => {
                                        this.setState(prevState => ({ settings: { ...prevState.settings, baiduTranslateSecret: v } }))
                                        window.settings.setIntegrationSettings({ ...settings, baiduTranslateSecret: v })
                                    }}
                                    styles={{ root: { width: 250 } }}
                                />
                                <DefaultButton
                                    text="测试"
                                    onClick={() => this.handleTestTranslation("baidu")}
                                    disabled={this.state.isTranslationTesting || !settings.baiduTranslateAppId || !settings.baiduTranslateSecret}
                                />
                            </Stack>
                            <Link href="https://fanyi-api.baidu.com/" target="_blank">申请百度翻译 API</Link>

                            {/* Youdao */}
                            <MessageBar messageBarType={MessageBarType.warning}>
                                有道翻译需要使用<strong>应用密钥（密钥）</strong>，32 位字符，不是 16 位应用 ID
                            </MessageBar>
                            <Stack horizontal tokens={{ childrenGap: 8 }} style={{ alignItems: 'flex-end' }}>
                                <TextField
                                    label="有道翻译 AppID"
                                    value={settings.youdaoTranslateAppId || ""}
                                    onChange={(e, v) => {
                                        this.setState(prevState => ({ settings: { ...prevState.settings, youdaoTranslateAppId: v } }))
                                        window.settings.setIntegrationSettings({ ...settings, youdaoTranslateAppId: v })
                                    }}
                                    styles={{ root: { width: 200 } }}
                                />
                                <TextField
                                    label="有道密钥"
                                    type="password"
                                    value={settings.youdaoTranslateSecret || ""}
                                    onChange={(e, v) => {
                                        this.setState(prevState => ({ settings: { ...prevState.settings, youdaoTranslateSecret: v } }))
                                        window.settings.setIntegrationSettings({ ...settings, youdaoTranslateSecret: v })
                                    }}
                                    styles={{ root: { width: 250 } }}
                                />
                                <DefaultButton
                                    text="测试"
                                    onClick={() => this.handleTestTranslation("youdao")}
                                    disabled={this.state.isTranslationTesting || !settings.youdaoTranslateAppId || !settings.youdaoTranslateSecret}
                                />
                            </Stack>
                            <Link href="https://ai.youdao.com/" target="_blank">申请有道翻译 API</Link>

                            {/* Ollama */}
                            <Stack horizontal tokens={{ childrenGap: 8 }} style={{ alignItems: 'flex-end' }}>
                                <TextField
                                    label="Ollama API 地址"
                                    value={settings.ollamaApiUrl || ""}
                                    onChange={(e, v) => {
                                        this.setState(prevState => ({ settings: { ...prevState.settings, ollamaApiUrl: v } }))
                                        window.settings.setIntegrationSettings({ ...settings, ollamaApiUrl: v })
                                    }}
                                    placeholder="http://localhost:11434"
                                    styles={{ root: { width: 250 } }}
                                />
                                <TextField
                                    label="Ollama 模型"
                                    value={settings.ollamaModel || ""}
                                    onChange={(e, v) => {
                                        this.setState(prevState => ({ settings: { ...prevState.settings, ollamaModel: v } }))
                                        window.settings.setIntegrationSettings({ ...settings, ollamaModel: v })
                                    }}
                                    placeholder="llama2"
                                    styles={{ root: { width: 150 } }}
                                />
                                <DefaultButton
                                    text="测试"
                                    onClick={() => this.handleTestTranslation("ollama")}
                                    disabled={this.state.isTranslationTesting || !settings.ollamaApiUrl || !settings.ollamaModel}
                                />
                            </Stack>

                            {this.state.translationTestResult && (
                                <MessageBar
                                    messageBarType={this.state.translationTestResult.includes("成功") ? MessageBarType.success : MessageBarType.warning}
                                >
                                    {this.state.translationTestResult}
                                </MessageBar>
                            )}

                            <Stack horizontal tokens={{ childrenGap: 8 }}>
                                <DefaultButton
                                    text="关闭"
                                    onClick={() => this.setState({ isTranslationModalOpen: false })}
                                />
                            </Stack>
                        </Stack>
                    </div>
                )}

                <div style={{ height: 8 }}></div>

                <Label
                    style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                    {intl.get("settings.integrations.obsidianIntegration")}
                </Label>
                <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 16 }} style={{ marginBottom: 16 }}>
                    <Stack.Item grow>
                        {settings.obsidianVaultPath ? (
                            <Label style={{ fontSize: 12, color: "var(--green)", margin: 0 }}>
                                <span style={{ marginRight: 8 }}>✓</span>
                                {settings.obsidianVaultPath}
                            </Label>
                        ) : (
                            <Label style={{ fontSize: 12, color: "var(--neutralTertiary)", margin: 0 }}>
                                {intl.get("settings.integrations.notConfigured")}
                            </Label>
                        )}
                    </Stack.Item>
                    <Stack.Item>
                        <PrimaryButton
                            text={intl.get("settings.integrations.configure")}
                            onClick={this.openObsidianModal}
                            allowDisabledFocus
                            iconProps={{ iconName: "FolderOpen" }}
                        />
                    </Stack.Item>
                    {settings.obsidianVaultPath && (
                        <Stack.Item>
                            <DefaultButton
                                text={intl.get("settings.integrations.testConnection")}
                                onClick={this.handleTestObsidianConnection}
                                allowDisabledFocus
                                iconProps={{ iconName: "StatusCheck" }}
                            />
                        </Stack.Item>
                    )}
                </Stack>

                <div style={{ height: 8 }}></div>

                <Label
                    style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                    {intl.get("settings.integrations.notionIntegration")}
                </Label>
                <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 16 }} style={{ marginBottom: 16 }}>
                    <Stack.Item grow>
                        {settings.notionDatabaseId ? (
                            <Label style={{ fontSize: 12, color: "var(--green)", margin: 0 }}>
                                <span style={{ marginRight: 8 }}>✓</span>
                                {settings.notionDatabaseId}
                            </Label>
                        ) : (
                            <Label style={{ fontSize: 12, color: "var(--neutralTertiary)", margin: 0 }}>
                                {intl.get("settings.integrations.notConfigured")}
                            </Label>
                        )}
                    </Stack.Item>
                    <Stack.Item>
                        <PrimaryButton
                            text={intl.get("settings.integrations.configure")}
                            onClick={this.openNotionModal}
                            allowDisabledFocus
                            iconProps={{ iconName: "Database" }}
                        />
                    </Stack.Item>
                    {settings.notionSecret && settings.notionDatabaseId && (
                        <Stack.Item>
                            <DefaultButton
                                text={intl.get("settings.integrations.testConnection")}
                                onClick={this.handleTestNotionConnection}
                                allowDisabledFocus
                                iconProps={{ iconName: "StatusCheck" }}
                            />
                        </Stack.Item>
                    )}
                </Stack>

                <div style={{ height: 24 }}></div>

                <Label
                    style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                    {intl.get("settings.integrations.aiPushServices")}
                </Label>
                <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 16 }} style={{ marginBottom: 16 }}>
                    <Stack.Item grow>
                        <Stack horizontal tokens={{ childrenGap: 8 }} wrap>
                            {this.getAIServicesSummary().split('\n').map((text, index) => (
                                <Label key={index} style={{ fontSize: 12, color: text.includes("Not configured") ? "var(--neutralTertiary)" : "var(--green)", margin: 0, paddingRight: 8 }}>
                                    {text.includes("•••") ? text.split(":")[0] + ": ✓" : text}
                                </Label>
                            ))}
                        </Stack>
                    </Stack.Item>
                    <Stack.Item>
                        <PrimaryButton
                            text={intl.get("settings.integrations.configure")}
                            onClick={this.openAIServicesModal}
                            allowDisabledFocus
                            iconProps={{ iconName: "Settings" }}
                        />
                    </Stack.Item>
                </Stack>

                <div style={{ height: 8 }}></div>

                <Label
                    style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                    {intl.get("settings.cloudNoteServices.name")}
                </Label>
                <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 16 }} style={{ marginBottom: 16 }}>
                    <Stack.Item grow>
                        <Stack horizontal tokens={{ childrenGap: 8 }} wrap>
                            {this.getCloudNoteServicesSummary().split('\n').map((text, index) => (
                                <Label key={index} style={{ fontSize: 12, color: text.includes("Not configured") ? "var(--neutralTertiary)" : "var(--neutralPrimary)", margin: 0, paddingRight: 8 }}>
                                    {text}
                                </Label>
                            ))}
                        </Stack>
                    </Stack.Item>
                    <Stack.Item>
                        <PrimaryButton
                            text={intl.get("settings.integrations.configure")}
                            onClick={this.openCloudNoteServicesModal}
                            allowDisabledFocus
                            iconProps={{ iconName: "Cloud" }}
                        />
                    </Stack.Item>
                </Stack>
            </div>
        )
    }

    getAIServicesSummary = () => {
        const { settings } = this.state
        const summary = []
        if (settings.openaiApiKey) summary.push(`OpenAI API Key: ••••••••`)
        if (settings.dingtalkWebhook) summary.push(`${intl.get("settings.integrations.dingtalkWebhook")}: ••••••••`)
        if (settings.wecomWebhook) summary.push(`${intl.get("settings.integrations.wecomWebhook")}: ••••••••`)
        return summary.length > 0 ? summary.join("\n") : intl.get("settings.integrations.notConfigured")
    }

    getCloudNoteServicesSummary = () => {
        const { settings } = this.state
        const summary = []
        if (settings.onenoteAccessToken) summary.push(`OneNote: ${intl.get("settings.integrations.connected")}`)
        if (settings.evernoteToken) summary.push(`Evernote: ${intl.get("settings.integrations.connected")}`)
        return summary.length > 0 ? summary.join("\n") : intl.get("settings.integrations.notConfigured")
    }

    getTranslationSummary = () => {
        const { settings } = this.state
        const summary = []
        const service = settings.translationService || "auto"
        const serviceName = service === "auto" ? "自动切换" : 
                           service === "google" ? "Google 翻译" :
                           service === "baidu" ? "百度翻译" :
                           service === "youdao" ? "有道翻译" :
                           service === "ollama" ? "Ollama" : service
        
        if (service === "google") {
            summary.push(`服务：${serviceName} ✓`)
        } else if (service === "baidu" && settings.baiduTranslateAppId) {
            summary.push(`服务：${serviceName} ✓`)
        } else if (service === "youdao" && settings.youdaoTranslateAppId && settings.youdaoTranslateSecret) {
            summary.push(`服务：${serviceName} ✓`)
        } else if (service === "ollama" && settings.ollamaApiUrl && settings.ollamaModel) {
            summary.push(`服务：${serviceName} ✓`)
        } else if (service === "auto") {
            const configured = []
            if (settings.baiduTranslateAppId) configured.push("百度")
            if (settings.youdaoTranslateAppId && settings.youdaoTranslateSecret) configured.push("有道")
            if (settings.ollamaApiUrl && settings.ollamaModel) configured.push("Ollama")
            if (configured.length > 0) {
                summary.push(`服务：自动切换 (${configured.join(", ")}) ✓`)
            } else {
                summary.push(`服务：自动切换 (Google) ✓`)
            }
        } else {
            summary.push(`服务：${serviceName} (未配置)`)
        }
        
        if (settings.translationMode === "bilingual") {
            summary.push(`模式：双语对照`)
        }
        
        return summary.length > 0 ? summary.join("\n") : intl.get("settings.integrations.notConfigured")
    }
}

export default IntegrationTab
