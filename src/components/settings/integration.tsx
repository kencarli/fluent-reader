import * as React from "react"
import intl from "react-intl-universal"
import { Label, Stack, TextField, PrimaryButton, Toggle } from "@fluentui/react"
import { IntegrationSettings } from "../../schema-types"
import { testObsidianConnection, testNotionConnection } from "../../scripts/integrations"

type IntegrationTabState = {
    settings: IntegrationSettings
}

class IntegrationTab extends React.Component<{}, IntegrationTabState> {
    constructor(props) {
        super(props)
        this.state = {
            settings: window.settings.getIntegrationSettings() || {},
        }
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
        checked?: boolean,
        name?: string
    ) => {
        if (!name) name = (event.currentTarget as HTMLInputElement).name
        this.setState(prevState => {
            const newSettings = { ...prevState.settings, [name]: checked }
            window.settings.setIntegrationSettings(newSettings)
            return { settings: newSettings }
        })
    }


    handleTestObsidianConnection = async () => {
        const { obsidianVaultName } = this.state.settings
        if (!obsidianVaultName) {
            window.utils.showMessageBox(
                intl.get("settings.integrations.testConnection"),
                "Obsidian Vault Name is not configured.",
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
                    "Obsidian vault name is not set.",
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
        return (
            <div className="tab-body">
                <Label
                    style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
                    {intl.get("settings.integrations.obsidianIntegration")}
                </Label>
                <Stack tokens={{ childrenGap: 16 }}>
                    <TextField
                        label={intl.get("settings.integrations.vaultName")}
                        name="obsidianVaultName"
                        value={this.state.settings.obsidianVaultName || ""}
                        onChange={this.handleInputChange}
                        description={intl.get("settings.integrations.obsidianDescription")}
                    />
                    <Toggle
                        label={intl.get("settings.integrations.autoSyncAfterRead")}
                        checked={this.state.settings.obsidianAutoSync || false}
                        onChange={(e, checked) => this.handleToggleChange(e, checked, "obsidianAutoSync")}
                    />
                    <PrimaryButton
                        text={intl.get("settings.integrations.testConnection")}
                        onClick={this.handleTestObsidianConnection}
                        allowDisabledFocus
                        disabled={!this.state.settings.obsidianVaultName}
                    />
                </Stack>

                <div style={{ height: 24 }}></div>

                <Label
                    style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
                    {intl.get("settings.integrations.notionIntegration")}
                </Label>
                <Stack tokens={{ childrenGap: 16 }}>
                    <TextField
                        label={intl.get("settings.integrations.integrationToken")}
                        name="notionSecret"
                        type="password"
                        value={this.state.settings.notionSecret || ""}
                        onChange={this.handleInputChange}
                        description={intl.get("settings.integrations.notionTokenDescription")}
                    />
                    <TextField
                        label={intl.get("settings.integrations.databaseId")}
                        name="notionDatabaseId"
                        value={this.state.settings.notionDatabaseId || ""}
                        onChange={this.handleInputChange}
                        description={intl.get("settings.integrations.notionDatabaseDescription")}
                    />
                    <TextField
                        label={intl.get("settings.integrations.notionTitlePropertyName")}
                        name="notionTitlePropertyName"
                        value={this.state.settings.notionTitlePropertyName || ""}
                        onChange={this.handleInputChange}
                        placeholder="Name"
                        description={intl.get("settings.integrations.notionTitlePropertyNameDescription")}
                    />
                    <TextField
                        label={intl.get("settings.integrations.notionUrlPropertyName")}
                        name="notionUrlPropertyName"
                        value={this.state.settings.notionUrlPropertyName || ""}
                        onChange={this.handleInputChange}
                        placeholder="URL"
                        description={intl.get("settings.integrations.notionUrlPropertyNameDescription")}
                    />

                    <Toggle
                        label={intl.get("settings.integrations.autoSyncAfterRead")}
                        checked={this.state.settings.notionAutoSync || false}
                        onChange={(e, checked) => this.handleToggleChange(e, checked, "notionAutoSync")}
                    />
                    <PrimaryButton
                        text={intl.get("settings.integrations.testConnection")}
                        onClick={this.handleTestNotionConnection}
                        allowDisabledFocus
                        disabled={!this.state.settings.notionSecret || !this.state.settings.notionDatabaseId}
                    />
                </Stack>

                <div style={{ height: 24 }}></div>

                <Label
                    style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
                    {intl.get("settings.integrations.aiPushServices")}
                </Label>
                <Stack tokens={{ childrenGap: 16 }}>
                    <TextField
                        label={intl.get("settings.integrations.openaiApiKey")}
                        name="openaiApiKey"
                        type="password"
                        value={this.state.settings.openaiApiKey || ""}
                        onChange={this.handleInputChange}
                        description={intl.get("settings.integrations.openaiDescription")}
                    />
                    <TextField
                        label={intl.get("settings.integrations.dingtalkWebhook")}
                        name="dingtalkWebhook"
                        type="password"
                        value={this.state.settings.dingtalkWebhook || ""}
                        onChange={this.handleInputChange}
                        description={intl.get("settings.integrations.dingtalkDescription")}
                    />
                    <TextField
                        label={intl.get("settings.integrations.wecomWebhook")}
                        name="wecomWebhook"
                        type="password"
                        value={this.state.settings.wecomWebhook || ""}
                        onChange={this.handleInputChange}
                        description={intl.get("settings.integrations.wecomDescription")}
                    />
                </Stack>

                <div style={{ height: 24 }}></div>

                <Label
                    style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
                    {intl.get("settings.integrations.dailyBriefingAutomation")}
                </Label>
                <Stack tokens={{ childrenGap: 16 }}>
                    <Stack horizontal tokens={{ childrenGap: 24 }}>
                        <TextField
                            label={intl.get("settings.integrations.scheduledTime")}
                            name="digestTime"
                            placeholder="09:00"
                            value={this.state.settings.digestTime || ""}
                            onChange={this.handleInputChange}
                            style={{ width: 120 }}
                        />
                        <Toggle
                            label={intl.get("settings.integrations.autoPushEnabled")}
                            checked={
                                this.state.settings.autoPushEnabled || false
                            }
                            onChange={(e, checked) =>
                                this.handleToggleChange(
                                    e,
                                    checked,
                                    "autoPushEnabled"
                                )
                            }
                        />
                        <Toggle
                            label={intl.get("settings.integrations.useDalle")}
                            checked={this.state.settings.dalleEnabled || false}
                            onChange={(e, checked) =>
                                this.handleToggleChange(
                                    e,
                                    checked,
                                    "dalleEnabled"
                                )
                            }
                        />
                    </Stack>
                    <TextField
                        label={intl.get("settings.integrations.interestTopics")}
                        name="digestTopics"
                        placeholder="AI, Tech Trends, Rust, Space"
                        value={this.state.settings.digestTopics || ""}
                        onChange={this.handleInputChange}
                        description={intl.get("settings.integrations.interestTopicsDescription")}
                    />
                </Stack>
            </div>
        )
    }
}

export default IntegrationTab
