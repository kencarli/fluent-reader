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
    isTestSuccess: boolean
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
            isTestSuccess: false,
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
                    translationService: option.key as "baidu" | "mymemory" | "deepl" | "libretranslate" | "ollama" | "auto"
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

            if (service === "libretranslate" || service === "auto") {
                if (localSettings.libretranslateApiUrl) {
                    success = true
                    message = intl.get("settings.translation.libretranslateReady")
                }
            }

            if (service === "baidu" || service === "auto") {
                if (localSettings.baiduTranslateAppId && localSettings.baiduTranslateSecret) {
                    success = true
                    message = intl.get("settings.translation.baiduConfigured")
                }
            }

            if (service === "deepl" || service === "auto") {
                if (localSettings.deeplTranslateApiKey) {
                    success = true
                    message = intl.get("settings.translation.deeplReady")
                }
            }

            if (service === "mymemory" || service === "auto") {
                // MyMemory doesn't need configuration, always available
                success = true
                message = intl.get("settings.translation.mymemoryReady")
            }

            if (service === "ollama" || service === "auto") {
                if (localSettings.ollamaApiUrl && localSettings.ollamaModel) {
                    success = true
                    message = intl.get("settings.translation.ollamaReady")
                }
            }

            if (!success) {
                message = intl.get("settings.translation.noServiceConfigured")
            }

            this.setState({ testResult: message, isTesting: false, isTestSuccess: success })
        } catch (error) {
            this.setState({
                testResult: intl.get("settings.translation.testFailed", { error: error instanceof Error ? error.message : intl.get("settings.translation.unknownError") }),
                isTesting: false,
                isTestSuccess: false
            })
        }
    }

    render() {
        const { localSettings, testResult, isTesting, isTestSuccess } = this.state
        const selectedService = localSettings.translationService || "auto"
        const selectedMode = localSettings.translationMode || "full"

        const hasConfig = localSettings.baiduTranslateAppId ||
                          localSettings.ollamaApiUrl ||
                          localSettings.deeplTranslateApiKey ||
                          localSettings.libretranslateApiUrl

        const statusIndicators = (
            <Stack horizontal tokens={{ childrenGap: 8 }}>
                {hasConfig && (
                    <Label style={{ color: "var(--green)", fontSize: 12, margin: 0 }}>
                        {intl.get("settings.translation.configured")}
                    </Label>
                )}
                <Label style={{ color: "var(--neutralSecondary)", fontSize: 12, margin: 0 }}>
                    {selectedService === "auto" ? intl.get("settings.translation.serviceName.auto") :
                     selectedService === "libretranslate" ? intl.get("settings.translation.serviceName.libretranslate") :
                     selectedService === "baidu" ? intl.get("settings.translation.serviceName.baidu") :
                     selectedService === "deepl" ? intl.get("settings.translation.serviceName.deepl") :
                     selectedService === "mymemory" ? intl.get("settings.translation.serviceName.mymemory") :
                     selectedService === "ollama" ? intl.get("settings.translation.serviceName.ollama") : intl.get("settings.translation.serviceName.unknown")}
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
                                    { key: "auto", text: intl.get("settings.translation.serviceOption.auto") },
                                    { key: "baidu", text: intl.get("settings.translation.serviceOption.baidu") },
                                    { key: "deepl", text: intl.get("settings.translation.serviceOption.deepl") },
                                    { key: "ollama", text: intl.get("settings.translation.serviceOption.ollama") },
                                    { key: "libretranslate", text: intl.get("settings.translation.serviceOption.libretranslate") },
                                    { key: "mymemory", text: intl.get("settings.translation.serviceOption.mymemory") },
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
                        {selectedService === "auto"
                            ? intl.get("settings.translation.serviceHint.auto")
                            : selectedService === "baidu"
                            ? intl.get("settings.translation.serviceHint.baidu")
                            : selectedService === "deepl"
                            ? intl.get("settings.translation.serviceHint.deepl")
                            : selectedService === "mymemory"
                            ? intl.get("settings.translation.serviceHint.mymemory")
                            : selectedService === "ollama"
                            ? intl.get("settings.translation.serviceHint.ollama")
                            : selectedService === "libretranslate"
                            ? intl.get("settings.translation.serviceHint.libretranslate")
                            : intl.get("settings.translation.serviceHint.default")}
                    </MessageBar>

                    {/* LibreTranslate - Only show if selected or Auto */}
                    {(selectedService === "libretranslate" || selectedService === "auto") && (
                        <>
                            <Label
                                style={{
                                    fontSize: 13,
                                    fontWeight: 600,
                                    marginTop: 16,
                                    marginBottom: 8,
                                }}>
                                {intl.get("settings.translation.libretranslateTitle")}
                            </Label>

                            <MessageBar messageBarType={MessageBarType.info} isMultiline={false}>
                                {intl.get("settings.translation.libretranslateDescription")}
                            </MessageBar>

                            <Stack horizontal tokens={{ childrenGap: 16 }} wrap>
                                <div style={{ flex: 1, minWidth: 250 }}>
                                    <TextField
                                        label={intl.get("settings.translation.apiUrl")}
                                        name="libretranslateApiUrl"
                                        value={localSettings.libretranslateApiUrl || ""}
                                        onChange={this.handleInputChange}
                                        placeholder="https://libretranslate.example.com"
                                        description={intl.get("settings.translation.libretranslateUrlHint")}
                                    />
                                </div>
                                <div style={{ flex: 1, minWidth: 200 }}>
                                    <TextField
                                        label={intl.get("settings.translation.apiKeyOptional")}
                                        name="libretranslateApiKey"
                                        value={localSettings.libretranslateApiKey || ""}
                                        onChange={this.handleInputChange}
                                        type="password"
                                        description={intl.get("settings.translation.libretranslateApiKeyHint")}
                                    />
                                </div>
                            </Stack>

                            <Link
                                href="https://github.com/LibreTranslate/LibreTranslate"
                                target="_blank"
                                underline>
                                {intl.get("settings.translation.selfHostLibretranslate")}
                            </Link>
                        </>
                    )}

                    {/* DeepL Translate - Only show if DeepL is selected or Auto */}
                    {(selectedService === "deepl" || selectedService === "auto") && (
                        <>
                            <Label
                                style={{
                                    fontSize: 13,
                                    fontWeight: 600,
                                    marginTop: 16,
                                    marginBottom: 8,
                                }}>
                                {intl.get("settings.translation.deeplTitle")}
                            </Label>

                            <div style={{ flex: 1, minWidth: 300 }}>
                                <TextField
                                    label={intl.get("settings.translation.apiKey")}
                                    name="deeplTranslateApiKey"
                                    value={localSettings.deeplTranslateApiKey || ""}
                                    onChange={this.handleInputChange}
                                    type="password"
                                    description={intl.get("settings.translation.deeplApiKeyHint")}
                                />
                            </div>

                            <Link
                                href="https://www.deepl.com/pro-api"
                                target="_blank"
                                underline>
                                {intl.get("settings.translation.getDeeplApiKey")}
                            </Link>
                        </>
                    )}

                    {/* Baidu Translate - Only show if Baidu is selected or Auto */}
                    {(selectedService === "baidu" || selectedService === "auto") && (
                        <>
                            <Label
                                style={{
                                    fontSize: 13,
                                    fontWeight: 600,
                                    marginTop: 8,
                                    marginBottom: 8,
                                }}>
                                {intl.get("settings.translation.baiduTitle")}
                            </Label>

                            <MessageBar messageBarType={MessageBarType.info} isMultiline={false}>
                                {intl.get("settings.translation.baiduDescription")}
                            </MessageBar>

                            <Stack horizontal tokens={{ childrenGap: 16 }} wrap>
                                <div style={{ flex: 1, minWidth: 200 }}>
                                    <TextField
                                        label="AppId"
                                        name="baiduTranslateAppId"
                                        value={localSettings.baiduTranslateAppId || ""}
                                        onChange={this.handleInputChange}
                                        description={intl.get("settings.translation.baiduAppIdHint")}
                                    />
                                </div>
                                <div style={{ flex: 1, minWidth: 200 }}>
                                    <TextField
                                        label="Secret Key"
                                        name="baiduTranslateSecret"
                                        type="password"
                                        value={localSettings.baiduTranslateSecret || ""}
                                        onChange={this.handleInputChange}
                                        description={intl.get("settings.translation.baiduSecretKeyHint")}
                                    />
                                </div>
                            </Stack>

                            <Link
                                href="https://fanyi-api.baidu.com/"
                                target="_blank"
                                underline>
                                {intl.get("settings.translation.applyBaiduApi")}
                            </Link>
                        </>
                    )}

                    {/* Ollama Translate - Only show if Ollama is selected or Auto */}
                    {(selectedService === "ollama" || selectedService === "auto") && (
                        <>
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
                        </>
                    )}

                    {/* Test Result */}
                    {testResult && (
                        <MessageBar
                            messageBarType={isTestSuccess ? MessageBarType.success : MessageBarType.warning}
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
