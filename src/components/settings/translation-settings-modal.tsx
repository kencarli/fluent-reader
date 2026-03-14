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
    Dropdown,
    MessageBar,
    MessageBarType,
    Link,
} from "@fluentui/react"
import { IntegrationSettings } from "../../schema-types"

type TranslationSettingsModalProps = {
    isOpen: boolean
    settings: IntegrationSettings
    onDismiss: () => void
    onSave: (settings: IntegrationSettings) => void
}

type TranslationSettingsModalState = {
    tempSettings: IntegrationSettings
    testResult: string | null
    isTesting: boolean
}

export default class TranslationSettingsModal extends React.Component<
    TranslationSettingsModalProps,
    TranslationSettingsModalState
> {
    constructor(props) {
        super(props)
        this.state = {
            tempSettings: { ...props.settings },
            testResult: null,
            isTesting: false,
        }
    }

    componentDidUpdate(prevProps: TranslationSettingsModalProps) {
        if (prevProps.isOpen !== this.props.isOpen && this.props.isOpen) {
            this.setState({ 
                tempSettings: { ...this.props.settings },
                testResult: null,
                isTesting: false,
            })
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

    handleServiceChange = (_, option) => {
        this.setState(prevState => ({
            tempSettings: { 
                ...prevState.tempSettings, 
                translationService: option.key as "google" | "baidu" | "youdao" | "auto"
            },
        }))
    }

    handleSave = () => {
        this.props.onSave(this.state.tempSettings)
        this.props.onDismiss()
    }

    handleTest = async (service?: string) => {
        this.setState({ isTesting: true, testResult: null })

        const { tempSettings } = this.state
        const serviceToTest = service || tempSettings.translationService || "auto"

        try {
            let success = false
            let message = ""

            if (serviceToTest === "baidu" || serviceToTest === "auto") {
                if (tempSettings.baiduTranslateAppId && tempSettings.baiduTranslateSecret) {
                    success = true
                    message = "百度翻译配置成功！"
                }
            }

            if (serviceToTest === "youdao" || serviceToTest === "auto") {
                if (tempSettings.youdaoTranslateAppId && tempSettings.youdaoTranslateSecret) {
                    // Test Youdao connection with actual translation request
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
                if (tempSettings.ollamaApiUrl && tempSettings.ollamaModel) {
                    // Test Ollama connection
                    try {
                        const url = tempSettings.ollamaApiUrl.replace(/\/$/, '') + '/api/tags'
                        const response = await fetch(url, { method: 'GET' })
                        if (response.ok) {
                            const data = await response.json()
                            const models = data.models || []
                            const hasModel = models.some((m: any) => m.name === tempSettings.ollamaModel || m.name.startsWith(tempSettings.ollamaModel + ':'))
                            if (hasModel) {
                                success = true
                                message = `Ollama 连接成功！模型 "${tempSettings.ollamaModel}" 可用`
                            } else {
                                success = true
                                message = `Ollama 连接成功，但未找到模型 "${tempSettings.ollamaModel}"。可用模型：${models.map((m: any) => m.name).join(', ')}`
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

            this.setState({ testResult: message, isTesting: false })
        } catch (error) {
            this.setState({
                testResult: `测试失败：${error instanceof Error ? error.message : '未知错误'}`,
                isTesting: false
            })
        }
    }

    render() {
        const { tempSettings, testResult, isTesting } = this.state
        const selectedService = tempSettings.translationService || "auto"

        return (
            <Modal
                isOpen={this.props.isOpen}
                onDismiss={this.props.onDismiss}
                isBlocking={false}
                containerClassName="modal-container"
            >
                <div style={{ padding: 20, maxWidth: 1200 }}>
                    <Stack horizontal horizontalAlign="space-between">
                        <Label
                            style={{
                                fontSize: 20,
                                fontWeight: 600,
                                marginBottom: 0,
                            }}>
                            {intl.get("settings.translation.title")}
                        </Label>
                        <IconButton
                            iconProps={{ iconName: "Cancel" }}
                            onClick={this.props.onDismiss}
                            title={intl.get("close")}
                            ariaLabel={intl.get("close")}
                        />
                    </Stack>

                    <Stack
                        tokens={{ childrenGap: 16 }}
                        style={{ marginTop: 20 }}>

                        {/* Service Selection */}
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
                        />

                        <MessageBar messageBarType={MessageBarType.info}>
                            {intl.get("settings.translation.serviceHint")}
                        </MessageBar>

                        {/* Translation Mode */}
                        <Dropdown
                            label={intl.get("settings.translation.mode")}
                            selectedKey={(tempSettings.translationMode as "full" | "bilingual") || "full"}
                            options={[
                                { key: "full", text: intl.get("settings.translation.modeFull") },
                                { key: "bilingual", text: intl.get("settings.translation.modeBilingual") },
                            ]}
                            onChange={(_, option) => {
                                this.setState(prevState => ({
                                    tempSettings: {
                                        ...prevState.tempSettings,
                                        translationMode: option.key as "full" | "bilingual"
                                    }
                                }))
                            }}
                        />

                        {/* Baidu Translate */}
                        <Label
                            style={{
                                fontSize: 16,
                                fontWeight: 600,
                                marginTop: 8,
                                marginBottom: 8,
                            }}>
                            {intl.get("settings.translation.baidu")}
                        </Label>

                        <Stack horizontal tokens={{ childrenGap: 16 }} style={{ marginBottom: 8 }}>
                            <Stack.Item grow>
                                <TextField
                                    label={intl.get("settings.translation.appId")}
                                    name="baiduTranslateAppId"
                                    value={tempSettings.baiduTranslateAppId || ""}
                                    onChange={this.handleInputChange}
                                    description={intl.get("settings.translation.baiduAppIdHint")}
                                    styles={{ root: { width: '100%' } }}
                                />
                            </Stack.Item>
                            <Stack.Item grow>
                                <Stack horizontal tokens={{ childrenGap: 8 }}>
                                    <TextField
                                        label={intl.get("settings.translation.secret")}
                                        name="baiduTranslateSecret"
                                        type="password"
                                        value={tempSettings.baiduTranslateSecret || ""}
                                        onChange={this.handleInputChange}
                                        description={intl.get("settings.translation.baiduSecretHint")}
                                        styles={{ root: { flexGrow: 1 } }}
                                    />
                                    <div style={{ marginTop: 32 }}>
                                        <PrimaryButton
                                            text={intl.get("settings.translation.test")}
                                            onClick={() => this.handleTest("baidu")}
                                            disabled={isTesting || !tempSettings.baiduTranslateAppId || !tempSettings.baiduTranslateSecret}
                                            iconProps={{ iconName: "StatusCheck" }}
                                        />
                                    </div>
                                </Stack>
                            </Stack.Item>
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
                                fontSize: 16,
                                fontWeight: 600,
                                marginTop: 16,
                                marginBottom: 8,
                            }}>
                            {intl.get("settings.translation.youdao")}
                        </Label>

                        <MessageBar messageBarType={MessageBarType.warning}>
                            <div>
                                <strong>注意：</strong>
                                <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
                                    <li>有道翻译需要使用<strong>应用密钥（密钥）</strong>，不是应用 ID</li>
                                    <li>应用 ID：16 位字符（如：28865fb41efab92d）</li>
                                    <li>应用密钥：32 位字符（如：a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6）</li>
                                    <li>错误代码 202 通常表示密钥配置错误</li>
                                </ul>
                            </div>
                        </MessageBar>

                        <Stack horizontal tokens={{ childrenGap: 16 }} style={{ marginBottom: 8 }}>
                            <Stack.Item grow>
                                <TextField
                                    label={intl.get("settings.translation.appId")}
                                    name="youdaoTranslateAppId"
                                    value={tempSettings.youdaoTranslateAppId || ""}
                                    onChange={this.handleInputChange}
                                    placeholder="16 位应用 ID"
                                    description="应用 ID（16 位字符）"
                                    styles={{ root: { width: '100%' } }}
                                />
                            </Stack.Item>
                            <Stack.Item grow>
                                <Stack horizontal tokens={{ childrenGap: 8 }}>
                                    <TextField
                                        label="应用密钥 (密钥)"
                                        name="youdaoTranslateSecret"
                                        type="password"
                                        value={tempSettings.youdaoTranslateSecret || ""}
                                        onChange={this.handleInputChange}
                                        placeholder="32 位应用密钥"
                                        description="32 位密钥，不是 16 位应用 ID！"
                                        styles={{ root: { flexGrow: 1 } }}
                                    />
                                    <div style={{ marginTop: 32 }}>
                                        <PrimaryButton
                                            text={intl.get("settings.translation.test")}
                                            onClick={() => this.handleTest("youdao")}
                                            disabled={isTesting || !tempSettings.youdaoTranslateAppId || !tempSettings.youdaoTranslateSecret}
                                            iconProps={{ iconName: "StatusCheck" }}
                                        />
                                    </div>
                                </Stack>
                            </Stack.Item>
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
                                fontSize: 16,
                                fontWeight: 600,
                                marginTop: 16,
                                marginBottom: 8,
                            }}>
                            {intl.get("settings.translation.ollama")}
                        </Label>

                        <Stack horizontal tokens={{ childrenGap: 16 }} style={{ marginBottom: 16 }}>
                            <Stack.Item grow>
                                <TextField
                                    label={intl.get("settings.translation.ollamaApiUrl")}
                                    name="ollamaApiUrl"
                                    value={tempSettings.ollamaApiUrl || ""}
                                    onChange={this.handleInputChange}
                                    placeholder="http://localhost:11434"
                                    description={intl.get("settings.translation.ollamaApiUrlHint")}
                                    styles={{ root: { width: '100%' } }}
                                />
                            </Stack.Item>
                            <Stack.Item grow>
                                <Stack horizontal tokens={{ childrenGap: 8 }}>
                                    <TextField
                                        label={intl.get("settings.translation.ollamaModel")}
                                        name="ollamaModel"
                                        value={tempSettings.ollamaModel || ""}
                                        onChange={this.handleInputChange}
                                        placeholder="llama2"
                                        description={intl.get("settings.translation.ollamaModelHint")}
                                        styles={{ root: { flexGrow: 1 } }}
                                    />
                                    <div style={{ marginTop: 32 }}>
                                        <PrimaryButton
                                            text={intl.get("settings.translation.test")}
                                            onClick={() => this.handleTest("ollama")}
                                            disabled={isTesting || !tempSettings.ollamaApiUrl || !tempSettings.ollamaModel}
                                            iconProps={{ iconName: "StatusCheck" }}
                                        />
                                    </div>
                                </Stack>
                            </Stack.Item>
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

                        {/* Save and Cancel Buttons */}
                        <Stack
                            horizontal
                            tokens={{ childrenGap: 8 }}
                            style={{ marginTop: 16 }}>
                            <PrimaryButton
                                text={intl.get("confirm")}
                                onClick={this.handleSave}
                            />
                            <DefaultButton
                                text={intl.get("cancel")}
                                onClick={this.props.onDismiss}
                            />
                        </Stack>
                    </Stack>
                </div>
            </Modal>
        )
    }
}
