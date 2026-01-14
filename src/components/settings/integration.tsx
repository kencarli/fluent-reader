import * as React from "react"
import intl from "react-intl-universal"
import { Label, Stack, TextField, PrimaryButton, Toggle, Dropdown } from "@fluentui/react"
import { IntegrationSettings } from "../../schema-types"
import { testObsidianConnection, testNotionConnection } from "../../scripts/integrations"

type IntegrationTabState = {
    settings: IntegrationSettings,
    notionDatabases: { key: string, text: string }[],
    notionProperties: any,
    isLoadingDatabases: boolean,
}

class IntegrationTab extends React.Component<{}, IntegrationTabState> {
    constructor(props) {
        super(props)
        this.state = {
            settings: window.settings.getIntegrationSettings() || {},
            notionDatabases: [],
            notionProperties: {},
            isLoadingDatabases: false,
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
        checked: any,
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

    loadNotionDatabases = async () => {
        if (!this.state.settings.notionSecret) {
            window.utils.showMessageBox("Error", "Please enter your Notion Integration Token first.", "OK", "", false, "error");
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
            window.utils.showMessageBox("Error loading databases", errorMessage, "OK", "", false, "error");
            this.setState({ isLoadingDatabases: false });
        }
    }

    loadNotionProperties = async (databaseId: string) => {
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
            window.utils.showMessageBox("Error loading properties", errorMessage, "OK", "", false, "error");
        }
    }

    handleNotionDbChange = (_, option) => {
        this.handleToggleChange(_, option.key, "notionDatabaseId");
        this.loadNotionProperties(option.key);
    }

    render() {
        return (
            <div className="tab-body">
                <Label
                    style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
                    {intl.get("settings.integrations.obsidianIntegration")}
                </Label>
                <Stack tokens={{ childrenGap: 16 }}>
                    <Stack horizontal tokens={{ childrenGap: 8 }}>
                        <TextField
                            label={intl.get("settings.integrations.vaultPath")}
                            name="obsidianVaultPath"
                            value={this.state.settings.obsidianVaultPath || ""}
                            onChange={this.handleInputChange}
                            description={intl.get("settings.integrations.obsidianPathDescription")}
                            styles={{ root: { flexGrow: 1 } }}
                        />
                        <PrimaryButton
                            text={intl.get("settings.integrations.browse")}
                            onClick={async () => {
                                const path = await window.utils.showFolderDialog()
                                if (path) {
                                    this.setState(prevState => {
                                        const newSettings = { ...prevState.settings, obsidianVaultPath: path }
                                        window.settings.setIntegrationSettings(newSettings)
                                        return { settings: newSettings }
                                    })
                                }
                            }}
                            allowDisabledFocus
                            style={{ alignSelf: 'flex-end', marginBottom: 3 }}
                        />
                    </Stack>
                    <TextField
                        label={intl.get("settings.integrations.template")}
                        name="obsidianTemplate"
                        multiline
                        rows={10}
                        value={this.state.settings.obsidianTemplate || ""}
                        onChange={this.handleInputChange}
                        description={intl.get("settings.integrations.obsidianTemplateDescription")}
                        placeholder={`---
title: "{{title}}"
url: "{{url}}"
tags: [{{tags}}]
---

# {{title}}

{{content}}

## Highlights
{{#highlights}}
> {{text}}
{{#note}}
- Note: {{note}}
{{/note}}
---
{{/highlights}}`}
                    />
                    <Dropdown
                        label={intl.get("settings.integrations.imageStrategy")}
                        selectedKey={this.state.settings.obsidianImageStrategy || "hotlink"}
                        options={[
                            { key: "hotlink", text: intl.get("settings.integrations.imageStrategyHotlink") },
                            { key: "download", text: intl.get("settings.integrations.imageStrategyDownload") },
                        ]}
                        onChange={(e, option) => this.handleToggleChange(e, option.key, "obsidianImageStrategy")}
                    />
                    <PrimaryButton
                        text={intl.get("settings.integrations.testConnection")}
                        onClick={this.handleTestObsidianConnection}
                        allowDisabledFocus
                        disabled={!this.state.settings.obsidianVaultPath}
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
                    <PrimaryButton
                        text={this.state.isLoadingDatabases ? "Loading..." : "Load Databases"}
                        onClick={this.loadNotionDatabases}
                        disabled={!this.state.settings.notionSecret || this.state.isLoadingDatabases}
                    />
                    <Dropdown
                        label={intl.get("settings.integrations.databaseId")}
                        selectedKey={this.state.settings.notionDatabaseId || ""}
                        options={this.state.notionDatabases}
                        onChange={this.handleNotionDbChange}
                        placeholder="Select a database after loading"
                        disabled={this.state.notionDatabases.length === 0}
                    />
                    <Dropdown
                        label={intl.get("settings.integrations.notionTitlePropertyName")}
                        selectedKey={this.state.settings.notionTitlePropertyName || ""}
                        options={Object.keys(this.state.notionProperties)
                            .filter(p => this.state.notionProperties[p].type === 'title')
                            .map(p => ({ key: p, text: p }))
                        }
                        onChange={(e, option) => this.handleToggleChange(e, option.key, "notionTitlePropertyName")}
                        placeholder="Select a title property"
                        disabled={Object.keys(this.state.notionProperties).length === 0}
                    />
                    <Dropdown
                        label={intl.get("settings.integrations.notionUrlPropertyName")}
                        selectedKey={this.state.settings.notionUrlPropertyName || ""}
                        options={Object.keys(this.state.notionProperties)
                            .filter(p => this.state.notionProperties[p].type === 'url')
                            .map(p => ({ key: p, text: p }))
                        }
                        onChange={(e, option) => this.handleToggleChange(e, option.key, "notionUrlPropertyName")}
                        placeholder="Select a URL property"
                        disabled={Object.keys(this.state.notionProperties).length === 0}
                    />
                    <Dropdown
                        label="Tags Property"
                        selectedKey={this.state.settings.notionTagsPropertyName || ""}
                        options={Object.keys(this.state.notionProperties)
                            .filter(p => this.state.notionProperties[p].type === 'multi_select')
                            .map(p => ({ key: p, text: p }))
                        }
                        onChange={(e, option) => this.handleToggleChange(e, option.key, "notionTagsPropertyName")}
                        placeholder="Select a tags property (multi-select)"
                        disabled={Object.keys(this.state.notionProperties).length === 0}
                    />
                    <Dropdown
                        label="Author Property"
                        selectedKey={this.state.settings.notionAuthorPropertyName || ""}
                        options={Object.keys(this.state.notionProperties)
                            .filter(p => this.state.notionProperties[p].type === 'rich_text')
                            .map(p => ({ key: p, text: p }))
                        }
                        onChange={(e, option) => this.handleToggleChange(e, option.key, "notionAuthorPropertyName")}
                        placeholder="Select an author property (text)"
                        disabled={Object.keys(this.state.notionProperties).length === 0}
                    />
                    <Dropdown
                        label="Date Property"
                        selectedKey={this.state.settings.notionDatePropertyName || ""}
                        options={Object.keys(this.state.notionProperties)
                            .filter(p => this.state.notionProperties[p].type === 'date')
                            .map(p => ({ key: p, text: p }))
                        }
                        onChange={(e, option) => this.handleToggleChange(e, option.key, "notionDatePropertyName")}
                        placeholder="Select a date property (date)"
                        disabled={Object.keys(this.state.notionProperties).length === 0}
                    />
                    <Dropdown
                        label="Source Property"
                        selectedKey={this.state.settings.notionSourcePropertyName || ""}
                        options={Object.keys(this.state.notionProperties)
                            .filter(p => this.state.notionProperties[p].type === 'select')
                            .map(p => ({ key: p, text: p }))
                        }
                        onChange={(e, option) => this.handleToggleChange(e, option.key, "notionSourcePropertyName")}
                        placeholder="Select a source property (select)"
                        disabled={Object.keys(this.state.notionProperties).length === 0}
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
