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

type DigestViewProps = {
    display: boolean
    locale: string
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

    generate = async () => {
        const apiKey = window.settings.getIntegrationSettings().openaiApiKey
        if (!apiKey) {
            this.setState({ error: "OpenAI API Key not configured in Settings > Integrations." })
            return
        }

        this.setState({ generating: true, error: null, briefing: null, pushSuccess: null })
        try {
            const settings = window.settings.getIntegrationSettings()
            const topics = settings.digestTopics ? settings.digestTopics.split(',').map(t => t.trim()) : []

            const result = await generateEnhancedDigest({
                apiKey: apiKey,
                language: this.props.locale,
                topics: topics,
                dalleEnabled: settings.dalleEnabled
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
                styles={{ main: { maxWidth: 600, minHeight: 400, padding: 24 } }}
            >
                <Stack tokens={{ childrenGap: 20 }}>
                    <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
                        <Label style={{ fontSize: 20, fontWeight: 600 }}>Daily News Briefing</Label>
                        <IconButton iconProps={{ iconName: "Cancel" }} onClick={this.onDismiss} />
                    </Stack>

                    {!this.state.briefing && !this.state.generating && (
                        <Stack horizontalAlign="center" tokens={{ childrenGap: 12 }} style={{ padding: "40px 0" }}>
                            <Label>Generate an AI-powered summary of articles from the last 24 hours.</Label>
                            <PrimaryButton
                                text="Generate Digest"
                                iconProps={{ iconName: "LightningBolt" }}
                                onClick={this.generate}
                            />
                        </Stack>
                    )}

                    {this.state.generating && (
                        <Stack horizontalAlign="center" tokens={{ childrenGap: 12 }} style={{ padding: "40px 0" }}>
                            <Spinner size={SpinnerSize.large} label="Analyzing articles and generating digest..." />
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
                        <Stack tokens={{ childrenGap: 16 }}>
                            {this.state.briefing.coverUrl && (
                                <Image
                                    src={this.state.briefing.coverUrl}
                                    alt="AI generated cover"
                                    height={200}
                                    imageFit={ImageFit.cover}
                                />
                            )}
                            <TextField
                                label={`AI Digest (${this.state.briefing.articleCount} articles)`}
                                multiline
                                autoAdjustHeight
                                rows={10}
                                value={this.state.briefing.content}
                                readOnly
                            />

                            <Separator>Push to External Services</Separator>

                            <Stack horizontal tokens={{ childrenGap: 12 }} horizontalAlign="center">
                                <DefaultButton
                                    text="DingTalk"
                                    iconProps={{ iconName: "Send" }}
                                    onClick={() => this.push('dingtalk')}
                                    disabled={this.state.pushing}
                                />
                                <DefaultButton
                                    text="WeCom"
                                    iconProps={{ iconName: "Chat" }}
                                    onClick={() => this.push('wecom')}
                                    disabled={this.state.pushing}
                                />
                                <PrimaryButton
                                    text="Regenerate"
                                    iconProps={{ iconName: "Refresh" }}
                                    onClick={this.generate}
                                    disabled={this.state.pushing}
                                />
                            </Stack>
                        </Stack>
                    )}
                </Stack>
            </Modal>
        )
    }
}

const mapStateToProps = (state: RootState) => ({
    display: state.app.digestOn,
    locale: state.app.locale
})

export default connect(mapStateToProps)(DigestView)
