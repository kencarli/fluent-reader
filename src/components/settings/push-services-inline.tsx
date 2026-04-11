import * as React from "react"
import intl from "react-intl-universal"
import {
    Label,
    Stack,
    TextField,
    MessageBar,
    MessageBarType,
} from "@fluentui/react"
import { IntegrationSettings } from "../../schema-types"
import CollapsibleSection from "./collapsible-section"

type PushServicesInlineProps = {
    settings: IntegrationSettings
    onChange: (settings: IntegrationSettings) => void
}

type PushServicesInlineState = {
    localSettings: IntegrationSettings
}

export default class PushServicesInline extends React.Component<
    PushServicesInlineProps,
    PushServicesInlineState
> {
    constructor(props) {
        super(props)
        this.state = {
            localSettings: { ...props.settings },
        }
    }

    componentDidUpdate(prevProps: PushServicesInlineProps) {
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

    render() {
        const { localSettings } = this.state
        const hasDingtalk = !!localSettings.dingtalkWebhook
        const hasWecom = !!localSettings.wecomWebhook

        const statusIndicators = (
            <Stack horizontal tokens={{ childrenGap: 8 }}>
                {hasDingtalk && (
                    <Label style={{ color: "var(--green)", fontSize: 12, margin: 0 }}>
                        {intl.get("settings.integrations.dingtalkStatus")}
                    </Label>
                )}
                {hasWecom && (
                    <Label style={{ color: "var(--green)", fontSize: 12, margin: 0 }}>
                        {intl.get("settings.integrations.wecomStatus")}
                    </Label>
                )}
            </Stack>
        )

        return (
            <CollapsibleSection
                title={intl.get("settings.integrations.pushServices")}
                headerContent={statusIndicators}
            >
                <Stack tokens={{ childrenGap: 16 }}>
                    <TextField
                        label={intl.get("settings.integrations.dingtalkWebhook")}
                        name="dingtalkWebhook"
                        type="url"
                        value={localSettings.dingtalkWebhook || ""}
                        onChange={this.handleInputChange}
                        description={intl.get("settings.integrations.dingtalkDescription")}
                        autoComplete="off"
                        placeholder="https://oapi.dingtalk.com/robot/send?access_token=..."
                    />

                    <TextField
                        label={intl.get("settings.integrations.wecomWebhook")}
                        name="wecomWebhook"
                        type="url"
                        value={localSettings.wecomWebhook || ""}
                        onChange={this.handleInputChange}
                        description={intl.get("settings.integrations.wecomDescription")}
                        autoComplete="off"
                        placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..."
                    />

                    <MessageBar messageBarType={MessageBarType.info}>
                        {intl.get("settings.integrations.webhookHint")}
                    </MessageBar>
                </Stack>
            </CollapsibleSection>
        )
    }
}
