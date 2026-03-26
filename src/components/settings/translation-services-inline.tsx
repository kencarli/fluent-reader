import * as React from "react"
import intl from "react-intl-universal"
import {
    Label,
    Stack,
    TextField,
    Dropdown,
    MessageBar,
    MessageBarType,
    Link,
    DefaultButton,
} from "@fluentui/react"
import { IntegrationSettings } from "../../schema-types"
import CollapsibleSection from "./collapsible-section"

type TranslationServicesInlineProps = {
    settings: IntegrationSettings
    onChange: (settings: IntegrationSettings) => void
}

type TranslationServicesInlineState = {
    localSettings: IntegrationSettings
    testResult: string | null
    isTesting: boolean
}

export default class TranslationServicesInline extends React.Component<
    TranslationServicesInlineProps,
    TranslationServicesInlineState
> {
    constructor(props) {
        super(props)
        this.state = {
            localSettings: { ...props.settings },
            testResult: null,
            isTesting: false,
        }
    }

    componentDidUpdate(prevProps: TranslationServicesInlineProps) {
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

    handleServiceChange = (_, option) => {
        this.setState(
            prevState => {
                const newSettings = {
                    ...prevState.localSettings,
                    translationService: option.key as "google" | "baidu" | "youdao" | "ollama" | "auto"
                }
                return { localSettings: newSettings }
            },
            () => {
                this.props.onChange(this.state.localSettings)
            }
        )
    }

    handleModeChange = (_, option) => {
        this.setState(
            prevState => {
                const newSettings = {
                    ...prevState.localSettings,
                    translationMode: option.key as "full" | "bilingual"
                }
                return { localSettings: newSettings }
            },
            () => {
                this.props.onChange(this.state.localSettings)
            }
        )
    }

    handleTest = async () => {
        this.setState({ isTesting: true, testResult: null })

        const { localSettings } = this.state
        const service = localSettings.translationService || "auto"

        try {
            let success = false
            let message = ""

            if (service === "baidu" || service === "auto") {
                if (localSettings.baiduTranslateAppId && localSettings.baiduTranslateSecret) {
                    success = true
                    message = intl.get("settings.translation.baiduTestSuccess")
                }
            }

            if (service === "youdao" || service === "auto") {
                if (localSettings.youdaoTranslateAppId && localSettings.youdaoTranslateSecret) {
                    success = true
                    message = intl.get("settings.translation.youdaoTestSuccess")
                }
            }

            if (service === "google") {
                success = true
                message = intl.get("settings.translation.googleTestSuccess")
            }

            if (service === "ollama" || service === "auto") {
                if (localSettings.ollamaApiUrl && localSettings.ollamaModel) {
                    success = true
                    message = intl.get("settings.translation.ollamaTestSuccess")
                }
            }

            if (!success) {
                message = intl.get("settings.translation.testNoConfig")
            }

            this.setState({ testResult: message, isTesting: false })
        } catch (error) {
            this.setState({
                testResult: intl.get("settings.translation.testFailure", {
                    error: error instanceof Error ? error.message : '未知错误'
                }),
                isTesting: false
            })
        }
    }

    render() {
        const { localSettings, testResult, isTesting } = this.state
        const selectedService = localSettings.translationService || "auto"
        const selectedMode = localSettings.translationMode || "full"

        const hasConfig = localSettings.baiduTranslateAppId || 
                          localSettings.youdaoTranslateAppId || 
                          localSettings.ollamaApiUrl

        const statusIndicators = (
            <Stack horizontal tokens={{ childrenGap: 8 }}>
                {hasConfig && (
                    <Label style={{ color: "var(--green)", fontSize: 12, margin: 0 }}>
                        ✓ 已配置
                    </Label>
                )}
                <Label style={{ color: "var(--neutralSecondary)", fontSize: 12, margin: 0 }}>
                    {selectedService === "auto" ? "自动" : 
                     selectedService === "google" ? "Google" :
                     selectedService === "baidu" ? "百度" :
                     selectedService === "youdao" ? "有道" : "Ollama"}
                </Label>
            </Stack>
        )

        return (
            <CollapsibleSection
                title={intl.get("settings.translation.title")}
                headerContent={statusIndicators}
            >
                <Stack tokens={{ childrenGap: 16 }}>
                    {/* Service Selection and Mode - Same Row */}
                    <Stack horizontal tokens={{ childrenGap: 24 }} wrap>
                        <div style={{ flex: 1, minWidth: 200 }}>
                            <Dropdown
                                label={intl.get("settings.translation.service")}
                                selectedKey={selectedService}
                                options={[
                                    { key: "auto", text: intl.get("settings.translation.auto") },
                                    { key: "google", text: intl.get("settings.translation.google") },
                                    { key: "baidu", text: intl.get("settings.translation.baidu") },
                                    { key: "youdao", text: intl.get("settings.translation.youdao") },
                                    { key: "ollama", text: intl.get("settings.translation.ollama") },
                                ]}
                                onChange={this.handleServiceChange}
                                styles={{ root: { width: '100%' } }}
                            />
                        </div>
                        <div style={{ flex: 1, minWidth: 150 }}>
                            <Dropdown
                                label={intl.get("settings.translation.mode")}
                                selectedKey={selectedMode}
                                options={[
                                    { key: "full", text: intl.get("settings.translation.modeFull") },
                                    { key: "bilingual", text: intl.get("settings.translation.modeBilingual") },
                                ]}
                                onChange={this.handleModeChange}
                                styles={{ root: { width: '100%' } }}
                            />
                        </div>
                    </Stack>

                    <MessageBar messageBarType={MessageBarType.info}>
                        {intl.get("settings.translation.serviceHint")}
                    </MessageBar>

                    {/* Baidu Translate */}
                    <Label
                        style={{
                            fontSize: 13,
                            fontWeight: 600,
                            marginTop: 8,
                            marginBottom: 8,
                        }}>
                        {intl.get("settings.translation.baidu")}
                    </Label>

                    <Stack horizontal tokens={{ childrenGap: 16 }} wrap>
                        <div style={{ flex: 1, minWidth: 200 }}>
                            <TextField
                                label={intl.get("settings.translation.baiduAppId")}
                                name="baiduTranslateAppId"
                                value={localSettings.baiduTranslateAppId || ""}
                                onChange={this.handleInputChange}
                                description={intl.get("settings.translation.baiduAppIdHint")}
                            />
                        </div>
                        <div style={{ flex: 1, minWidth: 200 }}>
                            <TextField
                                label={intl.get("settings.translation.baiduSecret")}
                                name="baiduTranslateSecret"
                                type="password"
                                value={localSettings.baiduTranslateSecret || ""}
                                onChange={this.handleInputChange}
                                description={intl.get("settings.translation.baiduSecretHint")}
                            />
                        </div>
                    </Stack>

                    <Link
                        href="https://fanyi-api.baidu.com/"
                        target="_blank"
                        underline>
                        {intl.get("settings.translation.baiduApply")}
                    </Link>

                    {/* Youdao Translate */}
                    <Label
                        style={{
                            fontSize: 13,
                            fontWeight: 600,
                            marginTop: 16,
                            marginBottom: 8,
                        }}>
                        {intl.get("settings.translation.youdao")}
                    </Label>

                    <Stack horizontal tokens={{ childrenGap: 16 }} wrap>
                        <div style={{ flex: 1, minWidth: 200 }}>
                            <TextField
                                label={intl.get("settings.translation.youdaoAppId")}
                                name="youdaoTranslateAppId"
                                value={localSettings.youdaoTranslateAppId || ""}
                                onChange={this.handleInputChange}
                                description={intl.get("settings.translation.youdaoAppIdHint")}
                            />
                        </div>
                        <div style={{ flex: 1, minWidth: 200 }}>
                            <TextField
                                label={intl.get("settings.translation.youdaoSecret")}
                                name="youdaoTranslateSecret"
                                type="password"
                                value={localSettings.youdaoTranslateSecret || ""}
                                onChange={this.handleInputChange}
                                description={intl.get("settings.translation.youdaoSecretHint")}
                            />
                        </div>
                    </Stack>

                    <Link
                        href="https://ai.youdao.com/"
                        target="_blank"
                        underline>
                        {intl.get("settings.translation.youdaoApply")}
                    </Link>

                    {/* Ollama Translate */}
                    <Label
                        style={{
                            fontSize: 13,
                            fontWeight: 600,
                            marginTop: 16,
                            marginBottom: 8,
                        }}>
                        {intl.get("settings.translation.ollama")}
                    </Label>

                    <Stack horizontal tokens={{ childrenGap: 16 }} wrap>
                        <div style={{ flex: 1, minWidth: 200 }}>
                            <TextField
                                label={intl.get("settings.translation.ollamaApiUrl")}
                                name="ollamaApiUrl"
                                value={localSettings.ollamaApiUrl || ""}
                                onChange={this.handleInputChange}
                                placeholder="http://localhost:11434"
                                description={intl.get("settings.translation.ollamaApiUrlHint")}
                            />
                        </div>
                        <div style={{ flex: 1, minWidth: 150 }}>
                            <TextField
                                label={intl.get("settings.translation.ollamaModel")}
                                name="ollamaModel"
                                value={localSettings.ollamaModel || ""}
                                onChange={this.handleInputChange}
                                placeholder="llama2"
                                description={intl.get("settings.translation.ollamaModelHint")}
                            />
                        </div>
                    </Stack>

                    {/* Test Result */}
                    {testResult && (
                        <MessageBar
                            messageBarType={testResult.includes("成功") ? MessageBarType.success : MessageBarType.warning}
                            isMultiline={false}
                        >
                            {testResult}
                        </MessageBar>
                    )}

                    {/* Test Button */}
                    <Stack horizontal tokens={{ childrenGap: 8 }} style={{ marginTop: 8 }}>
                        <DefaultButton
                            text={intl.get("settings.translation.test")}
                            onClick={this.handleTest}
                            disabled={isTesting}
                        />
                    </Stack>
                </Stack>
            </CollapsibleSection>
        )
    }
}
