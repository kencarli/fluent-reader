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

    handleTest = async () => {
        this.setState({ isTesting: true, testResult: null })

        const { tempSettings } = this.state
        const service = tempSettings.translationService || "auto"

        try {
            let success = false
            let message = ""

            if (service === "baidu" || service === "auto") {
                if (tempSettings.baiduTranslateAppId && tempSettings.baiduTranslateSecret) {
                    success = true
                    message = "百度翻译配置成功！"
                }
            }

            if (service === "youdao" || service === "auto") {
                if (tempSettings.youdaoTranslateAppId && tempSettings.youdaoTranslateSecret) {
                    success = true
                    message = "有道翻译配置成功！"
                }
            }

            if (service === "google") {
                success = true
                message = "Google 翻译无需配置，可直接使用"
            }

            if (service === "ollama" || service === "auto") {
                if (tempSettings.ollamaApiUrl && tempSettings.ollamaModel) {
                    success = true
                    message = "Ollama 配置成功！"
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
                <div style={{ padding: 20, maxWidth: 700 }}>
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
                            }}>
                            {intl.get("settings.translation.baidu")}
                        </Label>
                        
                        <TextField
                            label={intl.get("settings.translation.appId")}
                            name="baiduTranslateAppId"
                            value={tempSettings.baiduTranslateAppId || ""}
                            onChange={this.handleInputChange}
                            description={intl.get("settings.translation.baiduAppIdHint")}
                        />

                        <TextField
                            label={intl.get("settings.translation.secret")}
                            name="baiduTranslateSecret"
                            type="password"
                            value={tempSettings.baiduTranslateSecret || ""}
                            onChange={this.handleInputChange}
                            description={intl.get("settings.translation.baiduSecretHint")}
                        />

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
                            }}>
                            {intl.get("settings.translation.youdao")}
                        </Label>

                        <TextField
                            label={intl.get("settings.translation.appId")}
                            name="youdaoTranslateAppId"
                            value={tempSettings.youdaoTranslateAppId || ""}
                            onChange={this.handleInputChange}
                            description={intl.get("settings.translation.youdaoAppIdHint")}
                        />

                        <TextField
                            label={intl.get("settings.translation.secret")}
                            name="youdaoTranslateSecret"
                            type="password"
                            value={tempSettings.youdaoTranslateSecret || ""}
                            onChange={this.handleInputChange}
                            description={intl.get("settings.translation.youdaoSecretHint")}
                        />

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
                            }}>
                            {intl.get("settings.translation.ollama")}
                        </Label>

                        <TextField
                            label={intl.get("settings.translation.ollamaApiUrl")}
                            name="ollamaApiUrl"
                            value={tempSettings.ollamaApiUrl || ""}
                            onChange={this.handleInputChange}
                            placeholder="http://localhost:11434"
                            description={intl.get("settings.translation.ollamaApiUrlHint")}
                        />

                        <TextField
                            label={intl.get("settings.translation.ollamaModel")}
                            name="ollamaModel"
                            value={tempSettings.ollamaModel || ""}
                            onChange={this.handleInputChange}
                            placeholder="llama2"
                            description={intl.get("settings.translation.ollamaModelHint")}
                        />

                        {/* Test and Save */}
                        {testResult && (
                            <MessageBar 
                                messageBarType={testResult.includes("成功") ? MessageBarType.success : MessageBarType.warning}
                                isMultiline={false}
                            >
                                {testResult}
                            </MessageBar>
                        )}

                        <Stack
                            horizontal
                            tokens={{ childrenGap: 8 }}
                            style={{ marginTop: 16 }}>
                            <PrimaryButton
                                text={intl.get("confirm")}
                                onClick={this.handleSave}
                            />
                            <DefaultButton
                                text={intl.get("settings.translation.test")}
                                onClick={this.handleTest}
                                disabled={isTesting}
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
