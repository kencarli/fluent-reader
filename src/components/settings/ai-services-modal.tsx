import * as React from "react"
import intl from "react-intl-universal"
import {
    Modal,
    Stack,
    TextField,
    PrimaryButton,
    DefaultButton,
    Label,
    IconButton,
    Toggle,
} from "@fluentui/react"
import { IntegrationSettings } from "../../schema-types"

type AIServicesModalProps = {
    isOpen: boolean
    settings: IntegrationSettings
    onDismiss: () => void
    onSave: (settings: IntegrationSettings) => void
}

type AIServicesModalState = {
    tempSettings: IntegrationSettings
}

export default class AIServicesModal extends React.Component<
    AIServicesModalProps,
    AIServicesModalState
> {
    constructor(props) {
        super(props)
        this.state = {
            tempSettings: { ...props.settings },
        }
    }

    componentDidUpdate(prevProps: AIServicesModalProps) {
        if (prevProps.isOpen !== this.props.isOpen && this.props.isOpen) {
            this.setState({ tempSettings: { ...this.props.settings } })
        }
    }

    handleInputChange = (
        event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>,
        newValue?: string
    ) => {
        const name = (event.target as HTMLInputElement).name
        this.setState(prevState => ({
            tempSettings: { ...prevState.tempSettings, [name]: newValue },
        }))
    }

    handleToggleChange = (
        event: React.FormEvent<HTMLElement>,
        checked: any,
        name?: string
    ) => {
        if (!name && event) name = (event.currentTarget as HTMLInputElement).name
        this.setState(prevState => ({
            tempSettings: { ...prevState.tempSettings, [name]: checked },
        }))
    }

    handleSave = () => {
        this.props.onSave(this.state.tempSettings)
        this.props.onDismiss()
    }

    render() {
        const { tempSettings } = this.state
        const hasOpenAi = !!tempSettings.openaiApiKey
        const hasNvidia = !!tempSettings.nvidiaApiKey
        const hasDeepseek = !!tempSettings.deepseekApiKey
        const hasOllama = !!tempSettings.ollamaApiUrl
        const hasDingtalk = !!tempSettings.dingtalkWebhook
        const hasWecom = !!tempSettings.wecomWebhook

        return (
            <Modal
                isOpen={this.props.isOpen}
                onDismiss={this.props.onDismiss}
                isBlocking={false}
                containerClassName="modal-container"
            >
                <div style={{ padding: 20, maxWidth: 1100 }}>
                    <Stack horizontal horizontalAlign="space-between">
                        <Label
                            style={{
                                fontSize: 20,
                                fontWeight: 600,
                                marginBottom: 0,
                            }}>
                            {intl.get(
                                "settings.integrations.aiPushServices"
                            )}
                        </Label>
                        <IconButton
                            iconProps={{ iconName: "Cancel" }}
                            onClick={this.props.onDismiss}
                            title={intl.get("close")}
                            ariaLabel={intl.get("close")}
                        />
                    </Stack>

                    <Stack
                        tokens={{ childrenGap: 12 }}
                        style={{ marginTop: 16 }}>
                        <Label
                            style={{
                                fontSize: 16,
                                fontWeight: 600,
                                marginBottom: 4,
                            }}>
                            {intl.get("settings.integrations.llmServices")}
                        </Label>

                        <TextField
                            label={intl.get(
                                "settings.integrations.openaiApiKey"
                            )}
                            name="openaiApiKey"
                            type="password"
                            value={tempSettings.openaiApiKey || ""}
                            onChange={this.handleInputChange}
                            description={intl.get(
                                "settings.integrations.openaiDescription"
                            )}
                        />

                        <TextField
                            label={intl.get(
                                "settings.integrations.nvidiaApiKey"
                            )}
                            name="nvidiaApiKey"
                            type="password"
                            value={tempSettings.nvidiaApiKey || ""}
                            onChange={this.handleInputChange}
                            description={intl.get(
                                "settings.integrations.nvidiaDescription"
                            )}
                        />

                        <TextField
                            label={intl.get(
                                "settings.integrations.deepseekApiKey"
                            )}
                            name="deepseekApiKey"
                            type="password"
                            value={tempSettings.deepseekApiKey || ""}
                            onChange={this.handleInputChange}
                            description={intl.get(
                                "settings.integrations.deepseekDescription"
                            )}
                        />

                        <Label
                            style={{
                                fontSize: 16,
                                fontWeight: 600,
                                marginTop: 8,
                                marginBottom: 4,
                            }}>
                            {intl.get("settings.integrations.ollamaServices")}
                        </Label>

                        <Stack horizontal tokens={{ childrenGap: 16 }}>
                            <TextField
                                label={intl.get(
                                    "settings.integrations.ollamaApiUrl"
                                )}
                                name="ollamaApiUrl"
                                value={tempSettings.ollamaApiUrl || ""}
                                onChange={this.handleInputChange}
                                placeholder="http://localhost:11434"
                                description={intl.get(
                                    "settings.integrations.ollamaUrlDescription"
                                )}
                                style={{ flexGrow: 1 }}
                            />

                            <TextField
                                label={intl.get(
                                    "settings.integrations.ollamaModel"
                                )}
                                name="ollamaModel"
                                value={tempSettings.ollamaModel || ""}
                                onChange={this.handleInputChange}
                                placeholder="llama3.1:8b"
                                description={intl.get(
                                    "settings.integrations.ollamaModelDescription"
                                )}
                                style={{ flexGrow: 1 }}
                            />
                        </Stack>

                        <Label
                            style={{
                                fontSize: 16,
                                fontWeight: 600,
                                marginTop: 8,
                                marginBottom: 4,
                            }}>
                            {intl.get("settings.integrations.pushServices")}
                        </Label>

                        <Stack horizontal tokens={{ childrenGap: 16 }}>
                            <TextField
                                label={intl.get(
                                    "settings.integrations.dingtalkWebhook"
                                )}
                                name="dingtalkWebhook"
                                type="password"
                                value={tempSettings.dingtalkWebhook || ""}
                                onChange={this.handleInputChange}
                                description={intl.get(
                                    "settings.integrations.dingtalkDescription"
                                )}
                                style={{ flexGrow: 1 }}
                            />

                            <TextField
                                label={intl.get(
                                    "settings.integrations.wecomWebhook"
                                )}
                                name="wecomWebhook"
                                type="password"
                                value={tempSettings.wecomWebhook || ""}
                                onChange={this.handleInputChange}
                                description={intl.get(
                                    "settings.integrations.wecomDescription"
                                )}
                                style={{ flexGrow: 1 }}
                            />
                        </Stack>

                        <Stack
                            horizontal
                            tokens={{ childrenGap: 8 }}
                            style={{ marginTop: 8 }}>
                            <PrimaryButton
                                text={intl.get("confirm")}
                                onClick={this.handleSave}
                            />
                            <DefaultButton
                                text={intl.get("cancel")}
                                onClick={this.props.onDismiss}
                            />
                        </Stack>

                        {hasOpenAi || hasNvidia || hasDeepseek || hasOllama || hasDingtalk || hasWecom ? (
                            <Stack
                                horizontal
                                tokens={{ childrenGap: 16 }}
                                style={{ marginTop: 8 }}>
                                {hasOpenAi && (
                                    <Label
                                        style={{
                                            color: "var(--green)",
                                            fontSize: 12,
                                        }}>
                                        ✓ OpenAI
                                    </Label>
                                )}
                                {hasNvidia && (
                                    <Label
                                        style={{
                                            color: "var(--green)",
                                            fontSize: 12,
                                        }}>
                                        ✓ NVIDIA
                                    </Label>
                                )}
                                {hasDeepseek && (
                                    <Label
                                        style={{
                                            color: "var(--green)",
                                            fontSize: 12,
                                        }}>
                                        ✓ DeepSeek
                                    </Label>
                                )}
                                {hasOllama && (
                                    <Label
                                        style={{
                                            color: "var(--green)",
                                            fontSize: 12,
                                        }}>
                                        ✓ Ollama
                                    </Label>
                                )}
                                {hasDingtalk && (
                                    <Label
                                        style={{
                                            color: "var(--green)",
                                            fontSize: 12,
                                        }}>
                                        ✓ {intl.get(
                                            "settings.integrations.dingtalkWebhook"
                                        )}
                                    </Label>
                                )}
                                {hasWecom && (
                                    <Label
                                        style={{
                                            color: "var(--green)",
                                            fontSize: 12,
                                        }}>
                                        ✓ {intl.get(
                                            "settings.integrations.wecomWebhook"
                                        )}
                                    </Label>
                                )}
                            </Stack>
                        ) : null}
                    </Stack>
                </div>
            </Modal>
        )
    }
}
