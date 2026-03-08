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

type DailyBriefingModalProps = {
    isOpen: boolean
    settings: IntegrationSettings
    onDismiss: () => void
    onSave: (settings: IntegrationSettings) => void
}

type DailyBriefingModalState = {
    tempSettings: IntegrationSettings
}

export default class DailyBriefingModal extends React.Component<
    DailyBriefingModalProps,
    DailyBriefingModalState
> {
    constructor(props) {
        super(props)
        this.state = {
            tempSettings: { ...props.settings },
        }
    }

    componentDidUpdate(prevProps: DailyBriefingModalProps) {
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
        const hasAutoPush = tempSettings.autoPushEnabled || false
        const hasDalle = tempSettings.dalleEnabled || false
        const hasTopics = !!tempSettings.digestTopics
        const hasTime = !!tempSettings.digestTime

        return (
            <Modal
                isOpen={this.props.isOpen}
                onDismiss={this.props.onDismiss}
                isBlocking={false}
                containerClassName="modal-container"
            >
                <div style={{ padding: 20, maxWidth: 600 }}>
                    <Stack horizontal horizontalAlign="space-between">
                        <Label
                            style={{
                                fontSize: 20,
                                fontWeight: 600,
                                marginBottom: 0,
                            }}>
                            {intl.get(
                                "settings.integrations.dailyBriefingAutomation"
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
                        tokens={{ childrenGap: 16 }}
                        style={{ marginTop: 20 }}>
                        <Stack horizontal tokens={{ childrenGap: 24 }}>
                            <TextField
                                label={intl.get(
                                    "settings.integrations.scheduledTime"
                                )}
                                name="digestTime"
                                placeholder="09:00"
                                value={tempSettings.digestTime || ""}
                                onChange={this.handleInputChange}
                                style={{ width: 120 }}
                            />
                            <Toggle
                                label={intl.get(
                                    "settings.integrations.autoPushEnabled"
                                )}
                                checked={
                                    tempSettings.autoPushEnabled || false
                                }
                                onChange={(e, checked) =>
                                    this.handleToggleChange(
                                        e,
                                        checked,
                                        "autoPushEnabled"
                                    )
                                }
                            />
                            <Toggle
                                label={intl.get(
                                    "settings.integrations.useDalle"
                                )}
                                checked={tempSettings.dalleEnabled || false}
                                onChange={(e, checked) =>
                                    this.handleToggleChange(
                                        e,
                                        checked,
                                        "dalleEnabled"
                                    )
                                }
                            />
                        </Stack>

                        <TextField
                            label={intl.get(
                                "settings.integrations.interestTopics"
                            )}
                            name="digestTopics"
                            placeholder="AI, Tech Trends, Rust, Space"
                            value={tempSettings.digestTopics || ""}
                            onChange={this.handleInputChange}
                            description={intl.get(
                                "settings.integrations.interestTopicsDescription"
                            )}
                        />

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

                        {(hasAutoPush || hasDalle || hasTopics || hasTime) && (
                            <Stack
                                horizontal
                                tokens={{ childrenGap: 16 }}
                                style={{ marginTop: 8 }}>
                                {hasTime && (
                                    <Label
                                        style={{
                                            color: "var(--green)",
                                            fontSize: 12,
                                        }}>
                                        ✓ {intl.get(
                                            "settings.integrations.scheduledTime"
                                        )}: {tempSettings.digestTime}
                                    </Label>
                                )}
                                {hasAutoPush && (
                                    <Label
                                        style={{
                                            color: "var(--green)",
                                            fontSize: 12,
                                        }}>
                                        ✓ {intl.get(
                                            "settings.integrations.autoPushEnabled"
                                        )}
                                    </Label>
                                )}
                                {hasDalle && (
                                    <Label
                                        style={{
                                            color: "var(--green)",
                                            fontSize: 12,
                                        }}>
                                        ✓ {intl.get(
                                            "settings.integrations.useDalle"
                                        )}
                                    </Label>
                                )}
                                {hasTopics && (
                                    <Label
                                        style={{
                                            color: "var(--green)",
                                            fontSize: 12,
                                        }}>
                                        ✓ {intl.get(
                                            "settings.integrations.interestTopics"
                                        )}
                                    </Label>
                                )}
                            </Stack>
                        )}
                    </Stack>
                </div>
            </Modal>
        )
    }
}
