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
}

export default IntegrationTab
