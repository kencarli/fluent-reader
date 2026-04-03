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
                    message = "LibreTranslate 翻译已就绪"
                }
            }

            if (service === "baidu" || service === "auto") {
                if (localSettings.baiduTranslateAppId && localSettings.baiduTranslateSecret) {
                    success = true
                    message = "百度翻译 API 已配置"
                }
            }

            if (service === "deepl" || service === "auto") {
                if (localSettings.deeplTranslateApiKey) {
                    success = true
                    message = "DeepL 翻译已就绪"
                }
            }

            if (service === "mymemory" || service === "auto") {
                // MyMemory doesn't need configuration, always available
                success = true
                message = "MyMemory 翻译已就绪"
            }

            if (service === "ollama" || service === "auto") {
                if (localSettings.ollamaApiUrl && localSettings.ollamaModel) {
                    success = true
                    message = "Ollama 翻译已就绪"
                }
            }

            if (!success) {
                message = "未配置翻译服务"
            }

            this.setState({ testResult: message, isTesting: false })
        } catch (error) {
            this.setState({
                testResult: `测试失败: ${error instanceof Error ? error.message : '未知错误'}`,
                isTesting: false
            })
        }
    }

    render() {
        const { localSettings, testResult, isTesting } = this.state
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
                        ✓ 已配置
                    </Label>
                )}
                <Label style={{ color: "var(--neutralSecondary)", fontSize: 12, margin: 0 }}>
                    {selectedService === "auto" ? "自动（推荐）" :
                     selectedService === "libretranslate" ? "LibreTranslate（开源）" :
                     selectedService === "baidu" ? "百度翻译" :
                     selectedService === "deepl" ? "DeepL（高质量）" :
                     selectedService === "mymemory" ? "MyMemory（免费）" :
                     selectedService === "ollama" ? "Ollama（本地）" : "未知"}
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
                                    { key: "auto", text: "自动模式（推荐）" },
                                    { key: "baidu", text: "百度翻译（需配置 API Key）" },
                                    { key: "deepl", text: "DeepL 翻译（高质量，国内可用）" },
                                    { key: "ollama", text: "Ollama（本地运行）" },
                                    { key: "libretranslate", text: "LibreTranslate（开源，可自托管）" },
                                    { key: "mymemory", text: "MyMemory 翻译（免费，无需配置）" },
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
                            ? "✓ 自动模式：优先使用已配置的服务，失败时自动切换。"
                            : selectedService === "baidu"
                            ? "✓ 百度翻译在中国大陆稳定。需配置 API Key（免费额度 200万字符/月）。"
                            : selectedService === "deepl"
                            ? "✓ DeepL 翻译质量最高，国内可用。免费版 50 万字符/月。"
                            : selectedService === "mymemory"
                            ? "✓ MyMemory 翻译无需配置，开箱即用。支持多种语言互译。"
                            : selectedService === "ollama"
                            ? "✓ Ollama 本地运行，隐私安全。需安装 Ollama 并下载模型。"
                            : selectedService === "libretranslate"
                            ? "✓ LibreTranslate 开源免费，可自托管或使用公共实例。"
                            : "请选择翻译服务"}
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
                                LibreTranslate（开源翻译）
                            </Label>

                            <MessageBar messageBarType={MessageBarType.info} isMultiline={false}>
                                开源翻译服务，可自托管或使用公共实例。完全免费，无限制。
                            </MessageBar>

                            <Stack horizontal tokens={{ childrenGap: 16 }} wrap>
                                <div style={{ flex: 1, minWidth: 250 }}>
                                    <TextField
                                        label="API 地址"
                                        name="libretranslateApiUrl"
                                        value={localSettings.libretranslateApiUrl || ""}
                                        onChange={this.handleInputChange}
                                        placeholder="https://libretranslate.example.com"
                                        description="LibreTranslate 服务器地址（公共实例或自托管）"
                                    />
                                </div>
                                <div style={{ flex: 1, minWidth: 200 }}>
                                    <TextField
                                        label="API Key（可选）"
                                        name="libretranslateApiKey"
                                        value={localSettings.libretranslateApiKey || ""}
                                        onChange={this.handleInputChange}
                                        type="password"
                                        description="部分公共实例需要 API Key"
                                    />
                                </div>
                            </Stack>

                            <Link
                                href="https://github.com/LibreTranslate/LibreTranslate"
                                target="_blank"
                                underline>
                                自托管 LibreTranslate
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
                                DeepL 翻译
                            </Label>

                            <div style={{ flex: 1, minWidth: 300 }}>
                                <TextField
                                    label="API Key"
                                    name="deeplTranslateApiKey"
                                    value={localSettings.deeplTranslateApiKey || ""}
                                    onChange={this.handleInputChange}
                                    type="password"
                                    description="从 https://www.deepl.com/pro-api 获取（免费版即可）"
                                />
                            </div>

                            <Link
                                href="https://www.deepl.com/pro-api"
                                target="_blank"
                                underline>
                                获取 DeepL API Key
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
                                百度翻译（需配置 API Key）
                            </Label>

                            <MessageBar messageBarType={MessageBarType.info} isMultiline={false}>
                                百度翻译 API 在中国大陆稳定。免费额度 200万字符/月。
                            </MessageBar>

                            <Stack horizontal tokens={{ childrenGap: 16 }} wrap>
                                <div style={{ flex: 1, minWidth: 200 }}>
                                    <TextField
                                        label="AppId"
                                        name="baiduTranslateAppId"
                                        value={localSettings.baiduTranslateAppId || ""}
                                        onChange={this.handleInputChange}
                                        description="从 https://fanyi-api.baidu.com/ 获取"
                                    />
                                </div>
                                <div style={{ flex: 1, minWidth: 200 }}>
                                    <TextField
                                        label="Secret Key"
                                        name="baiduTranslateSecret"
                                        type="password"
                                        value={localSettings.baiduTranslateSecret || ""}
                                        onChange={this.handleInputChange}
                                        description="从 https://fanyi-api.baidu.com/ 获取"
                                    />
                                </div>
                            </Stack>

                            <Link
                                href="https://fanyi-api.baidu.com/"
                                target="_blank"
                                underline>
                                申请百度翻译 API
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
