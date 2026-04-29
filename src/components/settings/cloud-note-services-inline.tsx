import * as React from "react"
import intl from "react-intl-universal"
import {
    Label,
    Stack,
    TextField,
    PrimaryButton,
    DefaultButton,
    Dropdown,
    IDropdownOption,
    MessageBar,
    MessageBarType,
    Link,
} from "@fluentui/react"
import { IntegrationSettings } from "../../schema-types"
import CollapsibleSection from "./collapsible-section"
import { testObsidianConnection, testNotionConnection } from "../../scripts/integrations"

type CloudNoteServicesInlineProps = {
    settings: IntegrationSettings
    onChange: (settings: IntegrationSettings) => void
}

type CloudNoteServicesInlineState = {
    localSettings: IntegrationSettings
    notionDatabases: { key: string, text: string }[]
    notionProperties: any
    isLoadingDatabases: boolean
    testMessage: string | null
    testType: "obsidian" | "notion" | "onenote" | "evernote" | null
    onenoteNotebooks: { key: string, text: string }[]
    isLoadingOneNoteNotebooks: boolean
}

export default class CloudNoteServicesInline extends React.Component<
    CloudNoteServicesInlineProps,
    CloudNoteServicesInlineState
> {
    constructor(props) {
        super(props)
        this.state = {
            localSettings: { ...props.settings },
            notionDatabases: [],
            notionProperties: {},
            isLoadingDatabases: false,
            testMessage: null,
            testType: null,
            onenoteNotebooks: [],
            isLoadingOneNoteNotebooks: false,
        }
    }

    componentDidUpdate(prevProps: CloudNoteServicesInlineProps) {
        if (prevProps.settings !== this.props.settings) {
            this.setState({ localSettings: { ...this.props.settings } })
        }
    }

    handleInputChange = (
        event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>,
        newValue?: string
    ) => {
        const name = (event.target as HTMLInputElement).name
        this.setState(
            prevState => {
                const newSettings = { ...prevState.localSettings, [name]: newValue }
                return { localSettings: newSettings }
            },
            () => {
                this.props.onChange(this.state.localSettings)
            }
        )
    }

    handleLoadNotionDatabases = async () => {
        if (!this.state.localSettings.notionSecret) {
            this.setState({
                testMessage: intl.get("settings.integrations.pleaseEnterNotionToken"),
                testType: "notion"
            })
            return
        }
        this.setState({ isLoadingDatabases: true })
        try {
            const dbs = await window.utils.getNotionDatabases(this.state.localSettings.notionSecret)
            this.setState({
                notionDatabases: dbs.map(db => ({
                    key: db.id,
                    text: db.title[0]?.plain_text || "Untitled"
                })),
                isLoadingDatabases: false,
                testMessage: intl.get("settings.integrations.loadedDatabases", { count: dbs.length }),
                testType: "notion"
            })
        } catch (err: unknown) {
            let errorMessage = String(err)
            if (err instanceof Error) {
                errorMessage = err.message
            }
            this.setState({
                isLoadingDatabases: false,
                testMessage: `${intl.get("settings.integrations.errorLoadingDatabases")}: ${errorMessage}`,
                testType: "notion"
            })
        }
    }

    handleLoadNotionProperties = async (databaseId: string) => {
        if (!this.state.localSettings.notionSecret) return
        try {
            const props = await window.utils.getNotionDatabaseProperties(
                this.state.localSettings.notionSecret,
                databaseId
            )
            this.setState({ notionProperties: props })
        } catch (err: unknown) {
            let errorMessage = String(err)
            if (err instanceof Error) {
                errorMessage = err.message
            }
            this.setState({
                testMessage: `${intl.get("settings.integrations.errorLoadingProperties")}: ${errorMessage}`,
                testType: "notion"
            })
        }
    }

    handleNotionDbChange = (_, option?: IDropdownOption) => {
        if (option) {
            const databaseId = option.key as string
            this.setState(
                prevState => ({
                    localSettings: {
                        ...prevState.localSettings,
                        notionDatabaseId: databaseId,
                    }
                }),
                () => {
                    this.props.onChange(this.state.localSettings)
                    this.handleLoadNotionProperties(databaseId)
                }
            )
        }
    }

    handleTestObsidian = async () => {
        const { obsidianVaultPath } = this.state.localSettings
        if (!obsidianVaultPath) {
            this.setState({
                testMessage: "Obsidian Vault Path is not configured.",
                testType: "obsidian"
            })
            return
        }
        try {
            const success = testObsidianConnection(this.state.localSettings)
            this.setState({
                testMessage: success ? "Obsidian connection successful!" : "Obsidian vault path is not set.",
                testType: "obsidian"
            })
        } catch (error) {
            this.setState({
                testMessage: `Obsidian connection failed: ${error.message}`,
                testType: "obsidian"
            })
        }
    }

    handleTestNotion = async () => {
        const { notionSecret, notionDatabaseId } = this.state.localSettings
        if (!notionSecret || !notionDatabaseId) {
            this.setState({
                testMessage: "Notion Integration Token or Database ID is not configured.",
                testType: "notion"
            })
            return
        }
        try {
            await testNotionConnection(this.state.localSettings)
            this.setState({
                testMessage: "Notion connection successful!",
                testType: "notion"
            })
        } catch (error) {
            this.setState({
                testMessage: `Notion connection failed: ${error.message}`,
                testType: "notion"
            })
        }
    }

    handleLoadOneNoteNotebooks = async () => {
        const { onenoteAccessToken } = this.state.localSettings
        if (!onenoteAccessToken) {
            this.setState({
                testMessage: intl.get("settings.integrations.pleaseEnterOneNoteToken"),
                testType: "onenote"
            })
            return
        }
        this.setState({ isLoadingOneNoteNotebooks: true })
        try {
            const response = await fetch("https://graph.microsoft.com/v1.0/me/onenote/notebooks", {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${onenoteAccessToken}`,
                },
            })
            if (!response.ok) {
                throw new Error(`OneNote API Error: ${response.statusText}`)
            }
            const data = await response.json()
            const notebooks = data.value.map((nb: any) => ({
                key: nb.id,
                text: nb.displayName
            }))
            this.setState({
                onenoteNotebooks: notebooks,
                isLoadingOneNoteNotebooks: false,
                testMessage: intl.get("settings.integrations.loadedNotebooks", { count: notebooks.length }),
                testType: "onenote"
            })
        } catch (err: unknown) {
            let errorMessage = String(err)
            if (err instanceof Error) {
                errorMessage = err.message
            }
            this.setState({
                isLoadingOneNoteNotebooks: false,
                testMessage: `${intl.get("settings.integrations.errorLoadingNotebooks")}: ${errorMessage}`,
                testType: "onenote"
            })
        }
    }

    handleOneNoteNotebookChange = (_, option?: IDropdownOption) => {
        if (option) {
            const notebookId = option.key as string
            this.setState(
                prevState => ({
                    localSettings: {
                        ...prevState.localSettings,
                        onenoteNotebookId: notebookId,
                    }
                }),
                () => {
                    this.props.onChange(this.state.localSettings)
                }
            )
        }
    }

    handleTestOneNote = async () => {
        const { onenoteAccessToken, onenoteNotebookId } = this.state.localSettings
        if (!onenoteAccessToken) {
            this.setState({
                testMessage: intl.get("settings.integrations.pleaseEnterOneNoteToken"),
                testType: "onenote"
            })
            return
        }
        try {
            const response = await fetch("https://graph.microsoft.com/v1.0/me/onenote/notebooks", {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${onenoteAccessToken}`,
                },
            })
            if (!response.ok) {
                throw new Error(`OneNote API Error: ${response.statusText}`)
            }
            const message = onenoteNotebookId 
                ? "OneNote connection successful!" 
                : "OneNote token valid! Please select a notebook."
            this.setState({
                testMessage: message,
                testType: "onenote"
            })
        } catch (error) {
            this.setState({
                testMessage: `OneNote connection failed: ${error.message}`,
                testType: "onenote"
            })
        }
    }

    handleTestEvernote = async () => {
        const { evernoteToken } = this.state.localSettings
        if (!evernoteToken) {
            this.setState({
                testMessage: intl.get("settings.integrations.pleaseEnterEvernoteToken"),
                testType: "evernote"
            })
            return
        }
        try {
            this.setState({
                testMessage: "Evernote token configured. Note: Full Evernote integration requires additional SDK setup.",
                testType: "evernote"
            })
        } catch (error) {
            this.setState({
                testMessage: `Evernote connection failed: ${error.message}`,
                testType: "evernote"
            })
        }
    }

    render() {
        const { localSettings, notionDatabases, isLoadingDatabases, testMessage, testType, onenoteNotebooks, isLoadingOneNoteNotebooks } = this.state
        const hasObsidian = !!localSettings.obsidianVaultPath
        const hasNotion = !!localSettings.notionDatabaseId
        const hasOneNote = !!localSettings.onenoteAccessToken && !!localSettings.onenoteNotebookId
        const hasEvernote = !!localSettings.evernoteToken

        const statusIndicators = (
            <Stack horizontal tokens={{ childrenGap: 8 }}>
                {hasObsidian && (
                    <Label style={{ color: "var(--green)", fontSize: 12, margin: 0 }}>
                        ✓ Obsidian
                    </Label>
                )}
                {hasNotion && (
                    <Label style={{ color: "var(--green)", fontSize: 12, margin: 0 }}>
                        ✓ Notion
                    </Label>
                )}
                {hasOneNote && (
                    <Label style={{ color: "var(--green)", fontSize: 12, margin: 0 }}>
                        ✓ OneNote
                    </Label>
                )}
                {hasEvernote && (
                    <Label style={{ color: "var(--green)", fontSize: 12, margin: 0 }}>
                        ✓ Evernote
                    </Label>
                )}
            </Stack>
        )

        return (
            <CollapsibleSection
                title={intl.get("settings.cloudNoteServices.name")}
                headerContent={statusIndicators}
            >
                <Stack tokens={{ childrenGap: 20 }}>
                    {/* Test Result Message */}
                    {testMessage && (
                        <MessageBar
                            messageBarType={testMessage.includes("successful") || testMessage.includes("成功") 
                                ? MessageBarType.success 
                                : MessageBarType.warning}
                            isMultiline={false}
                            onDismiss={() => this.setState({ testMessage: null, testType: null })}
                        >
                            {testMessage}
                        </MessageBar>
                    )}

                    {/* Obsidian Section */}
                    <div>
                        <Label style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
                            {intl.get("settings.integrations.obsidianIntegration")}
                        </Label>
                        <Stack horizontal tokens={{ childrenGap: 16 }} wrap>
                            <Stack.Item grow>
                                <TextField
                                    label="Obsidian Vault Path"
                                    name="obsidianVaultPath"
                                    value={localSettings.obsidianVaultPath || ""}
                                    onChange={this.handleInputChange}
                                    description={intl.get("settings.integrations.obsidianPathDescription")}
                                    placeholder="/path/to/your/vault"
                                />
                            </Stack.Item>
                            <Stack.Item>
                                <div style={{ paddingTop: 32 }}>
                                    <PrimaryButton
                                        text={intl.get("settings.integrations.browse")}
                                        onClick={() => {
                                            // File picker can be implemented here
                                        }}
                                        disabled
                                    />
                                </div>
                            </Stack.Item>
                            {hasObsidian && (
                                <Stack.Item>
                                    <div style={{ paddingTop: 32 }}>
                                        <DefaultButton
                                            text={intl.get("settings.integrations.testConnection")}
                                            onClick={this.handleTestObsidian}
                                            iconProps={{ iconName: "CheckMark" }}
                                        />
                                    </div>
                                </Stack.Item>
                            )}
                        </Stack>

                        <Stack horizontal tokens={{ childrenGap: 16 }} wrap style={{ marginTop: 16 }}>
                            <Stack.Item grow>
                                <TextField
                                    label={intl.get("settings.integrations.template")}
                                    name="obsidianTemplate"
                                    value={localSettings.obsidianTemplate || ""}
                                    onChange={this.handleInputChange}
                                    description={intl.get("settings.integrations.obsidianTemplateDescription")}
                                    multiline
                                    rows={3}
                                    placeholder="{{title}}&#10;{{url}}&#10;{{content}}&#10;{{tags}}"
                                />
                            </Stack.Item>
                        </Stack>
                    </div>

                    {/* Notion Section */}
                    <div>
                        <Label style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
                            {intl.get("settings.integrations.notionIntegration")}
                        </Label>
                        
                        <Stack horizontal tokens={{ childrenGap: 16 }} wrap>
                            <Stack.Item grow>
                                <TextField
                                    label={intl.get("settings.integrations.integrationToken")}
                                    name="notionSecret"
                                    type="password"
                                    value={localSettings.notionSecret || ""}
                                    onChange={this.handleInputChange}
                                    description={intl.get("settings.integrations.notionTokenDescription")}
                                    autoComplete="off"
                                />
                            </Stack.Item>
                            <Stack.Item>
                                <div style={{ paddingTop: 32 }}>
                                    <PrimaryButton
                                        text={intl.get("settings.integrations.loadDatabases")}
                                        onClick={this.handleLoadNotionDatabases}
                                        disabled={isLoadingDatabases || !localSettings.notionSecret}
                                    />
                                </div>
                            </Stack.Item>
                        </Stack>

                        {notionDatabases.length > 0 && (
                            <Stack horizontal tokens={{ childrenGap: 16 }} wrap style={{ marginTop: 16 }}>
                                <Stack.Item grow>
                                    <Dropdown
                                        label={intl.get("settings.integrations.databaseId")}
                                        selectedKey={localSettings.notionDatabaseId || undefined}
                                        options={notionDatabases}
                                        onChange={this.handleNotionDbChange}
                                        placeholder={intl.get("settings.integrations.selectDatabaseAfterLoading")}
                                        style={{ width: 300 }}
                                    />
                                </Stack.Item>
                                {hasNotion && (
                                    <Stack.Item>
                                        <div style={{ paddingTop: 32 }}>
                                            <DefaultButton
                                                text={intl.get("settings.integrations.testConnection")}
                                                onClick={this.handleTestNotion}
                                                iconProps={{ iconName: "CheckMark" }}
                                            />
                                        </div>
                                    </Stack.Item>
                                )}
                            </Stack>
                        )}

                        {/* Notion Property Mappings */}
                        {localSettings.notionDatabaseId && Object.keys(this.state.notionProperties).length > 0 && (
                            <Stack tokens={{ childrenGap: 12 }} style={{ marginTop: 16 }}>
                                <Label style={{ fontSize: 13, fontWeight: 600 }}>
                                    {intl.get("settings.integrations.propertyMappings")}
                                </Label>
                                <Stack horizontal tokens={{ childrenGap: 16 }} wrap>
                                    <Stack.Item grow>
                                        <TextField
                                            label={intl.get("settings.integrations.notionTitlePropertyName")}
                                            name="notionTitlePropertyName"
                                            value={localSettings.notionTitlePropertyName || "Name"}
                                            onChange={this.handleInputChange}
                                            description={intl.get("settings.integrations.notionTitlePropertyNameDescription")}
                                        />
                                    </Stack.Item>
                                    <Stack.Item grow>
                                        <TextField
                                            label={intl.get("settings.integrations.notionUrlPropertyName")}
                                            name="notionUrlPropertyName"
                                            value={localSettings.notionUrlPropertyName || "URL"}
                                            onChange={this.handleInputChange}
                                            description={intl.get("settings.integrations.notionUrlPropertyNameDescription")}
                                        />
                                    </Stack.Item>
                                </Stack>
                                <Stack horizontal tokens={{ childrenGap: 16 }} wrap>
                                    <Stack.Item grow>
                                        <TextField
                                            label={intl.get("settings.integrations.notionAuthorPropertyName")}
                                            name="notionAuthorPropertyName"
                                            value={localSettings.notionAuthorPropertyName || ""}
                                            onChange={this.handleInputChange}
                                            description={intl.get("settings.integrations.selectAuthorProperty")}
                                        />
                                    </Stack.Item>
                                    <Stack.Item grow>
                                        <TextField
                                            label={intl.get("settings.integrations.notionDatePropertyName")}
                                            name="notionDatePropertyName"
                                            value={localSettings.notionDatePropertyName || ""}
                                            onChange={this.handleInputChange}
                                            description={intl.get("settings.integrations.selectDateProperty")}
                                        />
                                    </Stack.Item>
                                </Stack>
                                <Stack horizontal tokens={{ childrenGap: 16 }} wrap>
                                    <Stack.Item grow>
                                        <TextField
                                            label={intl.get("settings.integrations.notionSourcePropertyName")}
                                            name="notionSourcePropertyName"
                                            value={localSettings.notionSourcePropertyName || ""}
                                            onChange={this.handleInputChange}
                                            description={intl.get("settings.integrations.selectSourceProperty")}
                                        />
                                    </Stack.Item>
                                    <Stack.Item grow>
                                        <TextField
                                            label={intl.get("settings.integrations.notionTagsPropertyName")}
                                            name="notionTagsPropertyName"
                                            value={localSettings.notionTagsPropertyName || ""}
                                            onChange={this.handleInputChange}
                                            description={intl.get("settings.integrations.selectTagsProperty")}
                                        />
                                    </Stack.Item>
                                </Stack>
                            </Stack>
                        )}

                        {!hasNotion && !localSettings.notionSecret && (
                            <Link
                                href="https://www.notion.so/my-integrations"
                                target="_blank"
                                underline
                                style={{ marginTop: 8 }}
                            >
                                {intl.get("settings.integrations.createNotionIntegration")}
                            </Link>
                        )}
                    </div>

                    {/* OneNote Section */}
                    <div>
                        <Label style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
                            {intl.get("settings.integrations.onenoteIntegration")}
                        </Label>
                        
                        <Stack horizontal tokens={{ childrenGap: 16 }} wrap>
                            <Stack.Item grow>
                                <TextField
                                    label={intl.get("settings.integrations.onenoteAccessToken")}
                                    name="onenoteAccessToken"
                                    type="password"
                                    value={localSettings.onenoteAccessToken || ""}
                                    onChange={this.handleInputChange}
                                    description={intl.get("settings.integrations.onenoteAccessTokenDescription")}
                                    autoComplete="off"
                                />
                            </Stack.Item>
                            <Stack.Item>
                                <div style={{ paddingTop: 32 }}>
                                    <PrimaryButton
                                        text={intl.get("settings.integrations.loadNotebooks")}
                                        onClick={this.handleLoadOneNoteNotebooks}
                                        disabled={isLoadingOneNoteNotebooks || !localSettings.onenoteAccessToken}
                                    />
                                </div>
                            </Stack.Item>
                        </Stack>

                        {onenoteNotebooks.length > 0 && (
                            <Stack horizontal tokens={{ childrenGap: 16 }} wrap style={{ marginTop: 16 }}>
                                <Stack.Item grow>
                                    <Dropdown
                                        label={intl.get("settings.integrations.notebook")}
                                        selectedKey={localSettings.onenoteNotebookId || undefined}
                                        options={onenoteNotebooks}
                                        onChange={this.handleOneNoteNotebookChange}
                                        placeholder={intl.get("settings.integrations.selectNotebookAfterLoading")}
                                        style={{ width: 300 }}
                                    />
                                </Stack.Item>
                                {hasOneNote && (
                                    <Stack.Item>
                                        <div style={{ paddingTop: 32 }}>
                                            <DefaultButton
                                                text={intl.get("settings.integrations.testConnection")}
                                                onClick={this.handleTestOneNote}
                                                iconProps={{ iconName: "CheckMark" }}
                                            />
                                        </div>
                                    </Stack.Item>
                                )}
                            </Stack>
                        )}

                        {!hasOneNote && !localSettings.onenoteAccessToken && (
                            <Label style={{ fontSize: 11, color: "var(--neutralSecondary)", marginTop: 8 }}>
                                {intl.get("settings.integrations.onenoteSetupHint")}
                            </Label>
                        )}
                    </div>

                    {/* Evernote Section */}
                    <div>
                        <Label style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
                            {intl.get("settings.integrations.evernoteIntegration")}
                        </Label>
                        
                        <Stack horizontal tokens={{ childrenGap: 16 }} wrap>
                            <Stack.Item grow>
                                <TextField
                                    label={intl.get("settings.integrations.evernoteToken")}
                                    name="evernoteToken"
                                    type="password"
                                    value={localSettings.evernoteToken || ""}
                                    onChange={this.handleInputChange}
                                    description={intl.get("settings.integrations.evernoteTokenDescription")}
                                    autoComplete="off"
                                />
                            </Stack.Item>
                            {localSettings.evernoteToken && (
                                <Stack.Item>
                                    <div style={{ paddingTop: 32 }}>
                                        <DefaultButton
                                            text={intl.get("settings.integrations.testConnection")}
                                            onClick={this.handleTestEvernote}
                                            iconProps={{ iconName: "CheckMark" }}
                                        />
                                    </div>
                                </Stack.Item>
                            )}
                        </Stack>

                        <Stack horizontal tokens={{ childrenGap: 16 }} wrap style={{ marginTop: 16 }}>
                            <Stack.Item grow>
                                <TextField
                                    label={intl.get("settings.integrations.evernoteNotebookGuid")}
                                    name="evernoteNotebookGuid"
                                    value={localSettings.evernoteNotebookGuid || ""}
                                    onChange={this.handleInputChange}
                                    description={intl.get("settings.integrations.evernoteNotebookGuidDescription")}
                                    placeholder="Notebook GUID"
                                />
                            </Stack.Item>
                        </Stack>

                        {!hasEvernote && !localSettings.evernoteToken && (
                            <Label style={{ fontSize: 11, color: "var(--neutralSecondary)", marginTop: 8 }}>
                                {intl.get("settings.integrations.evernoteSetupHint")}
                            </Label>
                        )}
                    </div>
                </Stack>
            </CollapsibleSection>
        )
    }
}
