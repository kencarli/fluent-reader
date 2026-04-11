import * as React from "react"
import intl from "react-intl-universal"
import {
    Label,
    Stack,
    TextField,
    PrimaryButton,
    MessageBar,
    MessageBarType,
} from "@fluentui/react"
import { IntegrationSettings } from "../../schema-types"
import CollapsibleSection from "./collapsible-section"

type AIServicesInlineProps = {
    settings: IntegrationSettings
    onChange: (settings: IntegrationSettings) => void
}

type AIServicesInlineState = {
    localSettings: IntegrationSettings
    testMessage: string | null
    isTesting: boolean
}

export default class AIServicesInline extends React.Component<
    AIServicesInlineProps,
    AIServicesInlineState
> {
    constructor(props) {
        super(props)
        this.state = {
            localSettings: { ...props.settings },
            testMessage: null,
            isTesting: false,
        }
    }

    componentDidUpdate(prevProps: AIServicesInlineProps) {
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

    handleTestOpenAI = async () => {
        if (!this.state.localSettings.openaiApiKey) {
            this.setState({ testMessage: intl.get('settings.integrations.pleaseEnterOpenAIKey'), isTesting: false })
            return
        }

        this.setState({ isTesting: true, testMessage: null })
        try {
            const key = this.state.localSettings.openaiApiKey
            if (key.startsWith('sk-') && key.length > 20) {
                this.setState({ testMessage: intl.get('settings.integrations.openAIKeyValid'), isTesting: false })
            } else {
                this.setState({ testMessage: intl.get('settings.integrations.apiKeyFormatWarning'), isTesting: false })
            }
        } catch (error) {
            this.setState({ testMessage: intl.get('settings.integrations.testFailed', { error: error.message }), isTesting: false })
        }
    }

    handleTestNvidia = async () => {
        if (!this.state.localSettings.nvidiaApiKey) {
            this.setState({ testMessage: intl.get('settings.integrations.pleaseEnterNVIDIAKey'), isTesting: false })
            return
        }

        this.setState({ isTesting: true, testMessage: null })
        try {
            const key = this.state.localSettings.nvidiaApiKey
            if (key.length > 20) {
                this.setState({ testMessage: intl.get('settings.integrations.nvidiaKeyValid'), isTesting: false })
            } else {
                this.setState({ testMessage: intl.get('settings.integrations.apiKeyFormatWarning'), isTesting: false })
            }
        } catch (error) {
            this.setState({ testMessage: intl.get('settings.integrations.testFailed', { error: error.message }), isTesting: false })
        }
    }

    handleTestDeepSeek = async () => {
        if (!this.state.localSettings.deepseekApiKey) {
            this.setState({ testMessage: intl.get('settings.integrations.pleaseEnterDeepSeekKey'), isTesting: false })
            return
        }

        this.setState({ isTesting: true, testMessage: null })
        try {
            const key = this.state.localSettings.deepseekApiKey
            if (key.length > 10) {
                this.setState({ testMessage: intl.get('settings.integrations.deepseekKeyValid'), isTesting: false })
            } else {
                this.setState({ testMessage: intl.get('settings.integrations.apiKeyFormatWarning'), isTesting: false })
            }
        } catch (error) {
            this.setState({ testMessage: intl.get('settings.integrations.testFailed', { error: error.message }), isTesting: false })
        }
    }

    handleTestOllama = async () => {
        if (!this.state.localSettings.ollamaApiUrl) {
            this.setState({ testMessage: intl.get('settings.integrations.pleaseEnterOllamaUrl'), isTesting: false })
            return
        }

        this.setState({ isTesting: true, testMessage: null })
        try {
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 5000)

            const url = this.state.localSettings.ollamaApiUrl.replace(/\/$/, '')
            const response = await fetch(`${url}/api/tags`, {
                method: 'GET',
                signal: controller.signal,
            })
            clearTimeout(timeoutId)

            if (response.ok) {
                const data = await response.json()
                const modelCount = data.models?.length || 0
                this.setState({
                    testMessage: intl.get('settings.integrations.ollamaConnected', { count: modelCount }),
                    isTesting: false
                })
            } else {
                this.setState({ testMessage: intl.get('settings.integrations.ollamaResponseAbnormal', { status: response.status }), isTesting: false })
            }
        } catch (error) {
            this.setState({
                testMessage: intl.get('settings.integrations.ollamaConnectionFailed', { error: error.message }),
                isTesting: false
            })
        }
    }

    render() {
        const { localSettings, testMessage, isTesting } = this.state
        const hasOpenAi = !!localSettings.openaiApiKey
        const hasNvidia = !!localSettings.nvidiaApiKey
        const hasDeepseek = !!localSettings.deepseekApiKey
        const hasOllama = !!localSettings.ollamaApiUrl

        const statusIndicators = (
            <Stack horizontal tokens={{ childrenGap: 8 }}>
                {hasOpenAi && (
                    <Label style={{ color: "var(--green)", fontSize: 12, margin: 0 }}>
                        {intl.get('settings.integrations.openAIStatus')}
                    </Label>
                )}
                {hasNvidia && (
                    <Label style={{ color: "var(--green)", fontSize: 12, margin: 0 }}>
                        {intl.get('settings.integrations.nvidiaStatus')}
                    </Label>
                )}
                {hasDeepseek && (
                    <Label style={{ color: "var(--green)", fontSize: 12, margin: 0 }}>
                        {intl.get('settings.integrations.deepseekStatus')}
                    </Label>
                )}
                {hasOllama && (
                    <Label style={{ color: "var(--green)", fontSize: 12, margin: 0 }}>
                        {intl.get('settings.integrations.ollamaStatus')}
                    </Label>
                )}
            </Stack>
        )

        return (
            <CollapsibleSection
                title={intl.get("settings.integrations.aiServices")}
                headerContent={statusIndicators}
            >
                <Stack tokens={{ childrenGap: 16 }}>
                    {/* OpenAI */}
                    <div>
                        <Stack horizontal tokens={{ childrenGap: 16 }} verticalAlign="end">
                            <div style={{ flex: 1 }}>
                                <TextField
                                    label={intl.get("settings.integrations.openaiApiKey")}
                                    name="openaiApiKey"
                                    type="password"
                                    value={localSettings.openaiApiKey || ""}
                                    onChange={this.handleInputChange}
                                    placeholder="sk-..."
                                    autoComplete="off"
                                    styles={{
                                        field: { fontSize: 12 },
                                    }}
                                />
                            </div>
                            <PrimaryButton
                                text={isTesting ? intl.get('settings.integrations.testing') : intl.get('settings.integrations.test')}
                                onClick={this.handleTestOpenAI}
                                disabled={isTesting || !localSettings.openaiApiKey}
                            />
                        </Stack>
                        <Label style={{ fontSize: 11, color: "var(--neutralSecondary)", margin: '4px 0 0 0' }}>
                            {intl.get("settings.integrations.openaiDescription")}
                        </Label>
                    </div>

                    {/* NVIDIA */}
                    <div>
                        <Stack horizontal tokens={{ childrenGap: 16 }} verticalAlign="end">
                            <div style={{ flex: 1 }}>
                                <TextField
                                    label={intl.get("settings.integrations.nvidiaApiKey")}
                                    name="nvidiaApiKey"
                                    type="password"
                                    value={localSettings.nvidiaApiKey || ""}
                                    onChange={this.handleInputChange}
                                    placeholder="nvapi-..."
                                    autoComplete="off"
                                    styles={{
                                        field: { fontSize: 12 },
                                    }}
                                />
                            </div>
                            <PrimaryButton
                                text={isTesting ? intl.get('settings.integrations.testing') : intl.get('settings.integrations.test')}
                                onClick={this.handleTestNvidia}
                                disabled={isTesting || !localSettings.nvidiaApiKey}
                            />
                        </Stack>
                        <Label style={{ fontSize: 11, color: "var(--neutralSecondary)", margin: '4px 0 0 0' }}>
                            {intl.get("settings.integrations.nvidiaDescription")}
                        </Label>
                    </div>

                    {/* DeepSeek */}
                    <div>
                        <Stack horizontal tokens={{ childrenGap: 16 }} verticalAlign="end">
                            <div style={{ flex: 1 }}>
                                <TextField
                                    label={intl.get("settings.integrations.deepseekApiKey")}
                                    name="deepseekApiKey"
                                    type="password"
                                    value={localSettings.deepseekApiKey || ""}
                                    onChange={this.handleInputChange}
                                    placeholder="sk-..."
                                    autoComplete="off"
                                    styles={{
                                        field: { fontSize: 12 },
                                    }}
                                />
                            </div>
                            <PrimaryButton
                                text={isTesting ? intl.get('settings.integrations.testing') : intl.get('settings.integrations.test')}
                                onClick={this.handleTestDeepSeek}
                                disabled={isTesting || !localSettings.deepseekApiKey}
                            />
                        </Stack>
                        <Label style={{ fontSize: 11, color: "var(--neutralSecondary)", margin: '4px 0 0 0' }}>
                            {intl.get("settings.integrations.deepseekDescription")}
                        </Label>
                    </div>

                    {/* Ollama */}
                    <div>
                        <Label style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
                            {intl.get("settings.integrations.ollamaServices")}
                        </Label>
                        <Stack horizontal tokens={{ childrenGap: 16 }} verticalAlign="end">
                            <div style={{ flex: 1 }}>
                                <TextField
                                    label={intl.get('settings.integrations.apiUrl')}
                                    name="ollamaApiUrl"
                                    value={localSettings.ollamaApiUrl || ""}
                                    onChange={this.handleInputChange}
                                    placeholder="http://localhost:11434"
                                    styles={{
                                        field: { fontSize: 12 },
                                    }}
                                />
                            </div>
                            <PrimaryButton
                                text={isTesting ? intl.get('settings.integrations.testing') : intl.get('settings.integrations.test')}
                                onClick={this.handleTestOllama}
                                disabled={isTesting || !localSettings.ollamaApiUrl}
                            />
                            <div style={{ minWidth: 150 }}>
                                <TextField
                                    label={intl.get('settings.integrations.modelName')}
                                    name="ollamaModel"
                                    value={localSettings.ollamaModel || ""}
                                    onChange={this.handleInputChange}
                                    placeholder="llama2"
                                    styles={{
                                        field: { fontSize: 12 },
                                    }}
                                />
                            </div>
                        </Stack>
                        <Label style={{ fontSize: 11, color: "var(--neutralSecondary)", margin: '4px 0 0 0' }}>
                            {intl.get("settings.integrations.ollamaUrlDescription")}
                        </Label>
                    </div>

                    {/* Test Result */}
                    {testMessage && (
                        <MessageBar
                            messageBarType={testMessage.includes('✓') ? MessageBarType.success : MessageBarType.warning}
                            isMultiline={false}
                            onDismiss={() => this.setState({ testMessage: null })}
                        >
                            {testMessage}
                        </MessageBar>
                    )}
                </Stack>
            </CollapsibleSection>
        )
    }
}
