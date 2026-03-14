import * as React from "react"
import intl from "react-intl-universal"
import {
    Modal,
    Stack,
    TextField,
    PrimaryButton,
    DefaultButton,
    Dropdown,
    Label,
    IconButton,
} from "@fluentui/react"
import { IntegrationSettings } from "../../schema-types"

type ObsidianSettingsModalProps = {
    isOpen: boolean
    settings: IntegrationSettings
    onDismiss: () => void
    onSave: (settings: IntegrationSettings) => void
}

type ObsidianSettingsModalState = {
    tempSettings: IntegrationSettings
}

export default class ObsidianSettingsModal extends React.Component<
    ObsidianSettingsModalProps,
    ObsidianSettingsModalState
> {
    constructor(props) {
        super(props)
        this.state = {
            tempSettings: { ...props.settings },
        }
    }

    componentDidUpdate(prevProps: ObsidianSettingsModalProps) {
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

    handleBrowse = async () => {
        const path = await window.utils.showFolderDialog()
        if (path) {
            this.setState(prevState => ({
                tempSettings: {
                    ...prevState.tempSettings,
                    obsidianVaultPath: path,
                },
            }))
        }
    }

    render() {
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
                            {intl.get(
                                "settings.integrations.obsidianIntegration"
                            )}
                        </Label>
                        <IconButton
                            iconProps={{ iconName: "Cancel" }}
                            onClick={this.props.onDismiss}
                            title={intl.get("close")}
                            ariaLabel={intl.get("close")}
                        />
                    </Stack>

                    <Stack tokens={{ childrenGap: 16 }} style={{ marginTop: 20 }}>
                        <Stack horizontal tokens={{ childrenGap: 8 }}>
                            <TextField
                                label={intl.get(
                                    "settings.integrations.vaultPath"
                                )}
                                name="obsidianVaultPath"
                                value={
                                    this.state.tempSettings.obsidianVaultPath ||
                                    ""
                                }
                                onChange={this.handleInputChange}
                                description={intl.get(
                                    "settings.integrations.obsidianPathDescription"
                                )}
                                styles={{ root: { flexGrow: 1 } }}
                            />
                            <PrimaryButton
                                text={intl.get(
                                    "settings.integrations.browse"
                                )}
                                onClick={this.handleBrowse}
                                allowDisabledFocus
                                style={{
                                    alignSelf: "flex-end",
                                    marginBottom: 3,
                                }}
                            />
                        </Stack>

                        <TextField
                            label={intl.get("settings.integrations.template")}
                            name="obsidianTemplate"
                            multiline
                            rows={10}
                            value={
                                this.state.tempSettings.obsidianTemplate || ""
                            }
                            onChange={this.handleInputChange}
                            description={intl.get(
                                "settings.integrations.obsidianTemplateDescription"
                            )}
                            placeholder={`---
title: "{{title}}"
url: "{{url}}"
tags: [{{tags}}]
---

# {{title}}

{{content}}

## Highlights
{{#highlights}}
> {{text}}
{{#note}}
- Note: {{note}}
{{/note}}
---
{{/highlights}}`}
                        />

                        <Dropdown
                            label={intl.get(
                                "settings.integrations.imageStrategy"
                            )}
                            selectedKey={
                                this.state.tempSettings
                                    .obsidianImageStrategy || "hotlink"
                            }
                            options={[
                                {
                                    key: "hotlink",
                                    text: intl.get(
                                        "settings.integrations.imageStrategyHotlink"
                                    ),
                                },
                                {
                                    key: "download",
                                    text: intl.get(
                                        "settings.integrations.imageStrategyDownload"
                                    ),
                                },
                            ]}
                            onChange={(e, option) =>
                                this.handleToggleChange(
                                    e,
                                    option.key,
                                    "obsidianImageStrategy"
                                )
                            }
                        />

                        <Stack
                            horizontal
                            tokens={{ childrenGap: 8 }}
                            style={{ marginTop: 16 }}>
                            <PrimaryButton
                                text={intl.get("confirm")}
                                onClick={this.handleSave}
                                disabled={
                                    !this.state.tempSettings.obsidianVaultPath
                                }
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
