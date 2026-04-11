import * as React from "react"
import intl from "react-intl-universal"
import { connect } from "react-redux"
import {
    Modal,
    Stack,
    PrimaryButton,
    DefaultButton,
    IconButton,
    Spinner,
    SpinnerSize,
    Label,
    MessageBar,
    MessageBarType,
    TextField,
    Separator,
    Image,
    ImageFit
} from "@fluentui/react"
import { RootState } from "../../scripts/reducer"
import { AppDispatch } from "../../scripts/utils"
import { toggleDigest } from "../../scripts/models/app"
import { getRecentItems, generateEnhancedDigest, BriefingResult } from "../../scripts/digest-service"
import { pushToDingTalk, pushToWeCom } from "../../scripts/push-service"
import { RSSSource } from "../../scripts/models/source"
import { ALL } from "../../scripts/models/feed"

type DigestViewProps = {
    display: boolean
    locale: string
    sources: { [key: number]: RSSSource }
    dispatch: AppDispatch
}

type DigestViewState = {
    generating: boolean
    pushing: boolean
    briefing: BriefingResult | null
    error: string | null
    pushSuccess: string | null
}

class DigestView extends React.Component<DigestViewProps, DigestViewState> {
    constructor(props) {
        super(props)
        this.state = {
            generating: false,
            pushing: false,
            briefing: null,
            error: null,
            pushSuccess: null
        }
    }

    componentDidMount() {
        // Check if there's a pre-generated result in sessionStorage
        if (this.props.display) {
            this.checkStoredResult()
        }
    }

    componentDidUpdate(prevProps: DigestViewProps) {
        // When modal opens, check for stored result or start generation
        if (!prevProps.display && this.props.display) {
            this.checkStoredResult()
        }
    }

    checkStoredResult = () => {
        const stored = sessionStorage.getItem('digestResult')
        if (stored) {
            try {
                const result = JSON.parse(stored)
                this.setState({
                    briefing: result
                })
                // Clear stored result after loading
                sessionStorage.removeItem('digestResult')
            } catch (e) {
                console.error('Failed to parse stored digest result:', e)
                sessionStorage.removeItem('digestResult')
            }
        } else if (!this.state.briefing) {
            // No stored result, auto-start generation
            this.generate()
        }
    }

    generate = async () => {
        if (this.state.generating) return

        const settings = window.settings.getIntegrationSettings()

        // Check if any LLM provider is configured (including Ollama)
        const hasOpenAI = !!settings.openaiApiKey
        const hasNvidia = !!settings.nvidiaApiKey
        const hasDeepSeek = !!settings.deepseekApiKey
        const hasOllama = !!(settings.ollamaApiUrl && settings.ollamaModel)
        const hasProvider = hasOpenAI || hasNvidia || hasDeepSeek || hasOllama

        if (!hasProvider) {
            // Build detailed error message
            const missingServices = []
            if (!settings.openaiApiKey && !settings.nvidiaApiKey && !settings.deepseekApiKey && !settings.ollamaApiUrl) {
                missingServices.push(intl.get("digest.missingApiConfig"))
            }
            if (settings.ollamaApiUrl && !settings.ollamaModel) {
                missingServices.push(intl.get("digest.missingOllamaModel"))
            }

            this.setState({
                error: intl.get("digest.noAIServiceConfigured", { services: missingServices.join('、') })
            })
            return
        }

        this.setState({
            generating: true,
            error: null,
            briefing: null,
            pushSuccess: null
        })
        try {
            const topics = settings.digestTopics ? settings.digestTopics.split(',').map(t => t.trim()) : []

            // Get current state for groups
            const state = (window as any).__STORE__.getState() as RootState

            const result = await generateEnhancedDigest({
                settings: settings,
                language: this.props.locale,
                topics: topics,
                dalleEnabled: settings.dalleEnabled,
                sourceIds: settings.digestSourceIds,
                groupIds: settings.digestGroupIds,
                groups: state.groups
            })
            this.setState({ briefing: result })
        } catch (e) {
            this.setState({ error: e.message })
        } finally {
            this.setState({ generating: false })
        }
    }

    push = async (service: 'dingtalk' | 'wecom') => {
        if (!this.state.briefing) return
        const settings = window.settings.getIntegrationSettings()
        const webhook = service === 'dingtalk' ? settings.dingtalkWebhook : settings.wecomWebhook

        if (!webhook) {
            this.setState({ error: `${service} webhook URL not configured.` })
            return
        }

        this.setState({ pushing: true, error: null, pushSuccess: null })
        try {
            let result
            if (service === 'dingtalk') {
                result = await pushToDingTalk(webhook, "Daily News Digest", this.state.briefing.content)
            } else {
                result = await pushToWeCom(webhook, this.state.briefing.content)
            }

            if (result.success) {
                this.setState({ pushSuccess: `Successfully pushed to ${service}!` })
            } else {
                this.setState({ error: result.message })
            }
        } catch (e) {
            this.setState({ error: e.message })
        } finally {
            this.setState({ pushing: false })
        }
    }

    onDismiss = () => {
        this.props.dispatch(toggleDigest())
    }

    render() {
        return (
            <Modal
                isOpen={this.props.display}
                onDismiss={this.onDismiss}
                containerClassName="digest-modal-container"
                styles={{
                    main: {
                        maxWidth: '900px',
                        minWidth: '600px',
                        minHeight: 400,
                        maxHeight: '80vh',
                        padding: 24,
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden'
                    }
                }}
            >
                <Stack tokens={{ childrenGap: 20 }} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <Stack horizontal horizontalAlign="space-between" verticalAlign="center" style={{ flexShrink: 0 }}>
                        <Label style={{ fontSize: 20, fontWeight: 600 }}>{intl.get("digest.title")}</Label>
                        <IconButton iconProps={{ iconName: "Cancel" }} onClick={this.onDismiss} />
                    </Stack>

                    {!this.state.briefing && !this.state.generating && (
                        <Stack horizontalAlign="center" tokens={{ childrenGap: 12 }} style={{ padding: "40px 0", flex: 1, justifyContent: 'center' }}>
                            <Label>{intl.get("digest.description")}</Label>
                            <PrimaryButton
                                text={intl.get("digest.generate")}
                                iconProps={{ iconName: "LightningBolt" }}
                                onClick={this.generate}
                            />
                        </Stack>
                    )}

                    {this.state.generating && (
                        <Stack horizontalAlign="center" tokens={{ childrenGap: 12 }} style={{ padding: "40px 0", flex: 1, justifyContent: 'center' }}>
                            <Spinner size={SpinnerSize.large} label={intl.get("digest.generating")} />
                        </Stack>
                    )}

                    {this.state.error && (
                        <MessageBar messageBarType={MessageBarType.error} onDismiss={() => this.setState({ error: null })}>
                            {this.state.error}
                        </MessageBar>
                    )}

                    {this.state.pushSuccess && (
                        <MessageBar messageBarType={MessageBarType.success} onDismiss={() => this.setState({ pushSuccess: null })}>
                            {this.state.pushSuccess}
                        </MessageBar>
                    )}

                    {this.state.briefing && (
                        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                            {this.state.briefing.coverUrl && (
                                <Image
                                    src={this.state.briefing.coverUrl}
                                    alt="AI generated cover"
                                    height={200}
                                    imageFit={ImageFit.cover}
                                    styles={{ root: { flexShrink: 0, marginBottom: 16 } }}
                                />
                            )}
                            <div style={{ 
                                flex: 1, 
                                overflow: 'auto',
                                paddingRight: '8px',
                                marginBottom: '16px'
                            }}>
                                <TextField
                                    label={intl.get("digest.result", { count: this.state.briefing.articleCount })}
                                    multiline
                                    value={this.state.briefing.content}
                                    readOnly
                                    styles={{
                                        root: { height: '100%' },
                                        field: { 
                                            height: '100%',
                                            minHeight: '300px',
                                            resize: 'none'
                                        }
                                    }}
                                />
                            </div>

                            <Separator style={{ flexShrink: 0 }}>{intl.get("digest.pushTo")}</Separator>

                            <Stack horizontal tokens={{ childrenGap: 12 }} horizontalAlign="center" style={{ flexShrink: 0, marginTop: 16 }}>
                                <DefaultButton
                                    text={intl.get("digest.dingtalk")}
                                    iconProps={{ iconName: "Send" }}
                                    onClick={() => this.push('dingtalk')}
                                    disabled={this.state.pushing}
                                />
                                <DefaultButton
                                    text={intl.get("digest.wecom")}
                                    iconProps={{ iconName: "Chat" }}
                                    onClick={() => this.push('wecom')}
                                    disabled={this.state.pushing}
                                />
                                <PrimaryButton
                                    text={intl.get("digest.regenerate")}
                                    iconProps={{ iconName: "Refresh" }}
                                    onClick={this.generate}
                                    disabled={this.state.pushing}
                                />
                            </Stack>
                        </div>
                    )}
                </Stack>
            </Modal>
        )
    }
}

const mapStateToProps = (state: RootState) => ({
    display: state.app.digestOn,
    locale: state.app.locale,
    sources: state.sources
})

export default connect(mapStateToProps)(DigestView)
