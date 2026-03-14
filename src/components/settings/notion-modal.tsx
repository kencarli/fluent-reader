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

type NotionSettingsModalProps = {
    isOpen: boolean
    settings: IntegrationSettings
    notionDatabases: { key: string, text: string }[]
    notionProperties: any
    isLoadingDatabases: boolean
    onDismiss: () => void
    onSave: (settings: IntegrationSettings) => void
    onLoadDatabases: () => void
    onDatabaseChange: (databaseId: string) => void
}

type NotionSettingsModalState = {
    tempSettings: IntegrationSettings
}

export default class NotionSettingsModal extends React.Component<
    NotionSettingsModalProps,
    NotionSettingsModalState
> {
    constructor(props) {
        super(props)
        this.state = {
            tempSettings: { ...props.settings },
        }
    }

    componentDidUpdate(prevProps: NotionSettingsModalProps) {
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

    handleDatabaseChange = (_, option) => {
        this.setState(prevState => ({
            tempSettings: {
                ...prevState.tempSettings,
                notionDatabaseId: option.key,
            },
        }))
        this.props.onDatabaseChange(option.key)
    }

    render() {
        const {
            notionDatabases,
            notionProperties,
            isLoadingDatabases,
            onLoadDatabases,
        } = this.props
        const { tempSettings } = this.state

        return (
            <Modal
                isOpen={this.props.isOpen}
                onDismiss={this.props.onDismiss}
                isBlocking={false}
                containerClassName="modal-container"
            >
                <div style={{ padding: 20, maxWidth: 800 }}>
                    <Stack horizontal horizontalAlign="space-between">
                        <Label
                            style={{
                                fontSize: 20,
                                fontWeight: 600,
                                marginBottom: 0,
                            }}>
                            {intl.get(
                                "settings.integrations.notionIntegration"
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
                        <TextField
                            label={intl.get(
                                "settings.integrations.integrationToken"
                            )}
                            name="notionSecret"
                            type="password"
                            value={tempSettings.notionSecret || ""}
                            onChange={this.handleInputChange}
                            description={intl.get(
                                "settings.integrations.notionTokenDescription"
                            )}
                        />

                        <PrimaryButton
                            text={
                                isLoadingDatabases
                                    ? intl.get(
                                          "settings.integrations.loading"
                                      )
                                    : intl.get(
                                          "settings.integrations.loadDatabases"
                                      )
                            }
                            onClick={onLoadDatabases}
                            disabled={
                                !tempSettings.notionSecret || isLoadingDatabases
                            }
                        />

                        <Dropdown
                            label={intl.get(
                                "settings.integrations.databaseId"
                            )}
                            selectedKey={
                                tempSettings.notionDatabaseId || ""
                            }
                            options={notionDatabases}
                            onChange={this.handleDatabaseChange}
                            placeholder={intl.get(
                                "settings.integrations.selectDatabaseAfterLoading"
                            )}
                            disabled={notionDatabases.length === 0}
                        />

                        <Stack horizontal tokens={{ childrenGap: 16 }}>
                            <Stack.Item grow>
                                <Dropdown
                                    label={intl.get(
                                        "settings.integrations.notionTitlePropertyName"
                                    )}
                                    selectedKey={
                                        tempSettings.notionTitlePropertyName ||
                                        ""
                                    }
                                    options={Object.keys(notionProperties)
                                        .filter(
                                            (p) =>
                                                notionProperties[p].type ===
                                                "title"
                                        )
                                        .map((p) => ({ key: p, text: p }))}
                                    onChange={(e, option) =>
                                        this.handleToggleChange(
                                            e,
                                            option.key,
                                            "notionTitlePropertyName"
                                        )
                                    }
                                    placeholder="Select a title property"
                                    disabled={
                                        Object.keys(notionProperties).length ===
                                        0
                                    }
                                />
                            </Stack.Item>
                            <Stack.Item grow>
                                <Dropdown
                                    label={intl.get(
                                        "settings.integrations.notionUrlPropertyName"
                                    )}
                                    selectedKey={
                                        tempSettings.notionUrlPropertyName || ""
                                    }
                                    options={Object.keys(notionProperties)
                                        .filter(
                                            (p) =>
                                                notionProperties[p].type ===
                                                "url"
                                        )
                                        .map((p) => ({ key: p, text: p }))}
                                    onChange={(e, option) =>
                                        this.handleToggleChange(
                                            e,
                                            option.key,
                                            "notionUrlPropertyName"
                                        )
                                    }
                                    placeholder="Select a URL property"
                                    disabled={
                                        Object.keys(notionProperties).length ===
                                        0
                                    }
                                />
                            </Stack.Item>
                        </Stack>

                        <Stack horizontal tokens={{ childrenGap: 16 }}>
                            <Stack.Item grow>
                                <Dropdown
                                    label={intl.get(
                                        "settings.integrations.notionTagsPropertyName"
                                    )}
                                    selectedKey={
                                        tempSettings.notionTagsPropertyName ||
                                        ""
                                    }
                                    options={Object.keys(notionProperties)
                                        .filter(
                                            (p) =>
                                                notionProperties[p].type ===
                                                "multi_select"
                                        )
                                        .map((p) => ({ key: p, text: p }))}
                                    onChange={(e, option) =>
                                        this.handleToggleChange(
                                            e,
                                            option.key,
                                            "notionTagsPropertyName"
                                        )
                                    }
                                    placeholder={intl.get(
                                        "settings.integrations.selectTagsProperty"
                                    )}
                                    disabled={
                                        Object.keys(notionProperties).length ===
                                        0
                                    }
                                />
                            </Stack.Item>
                            <Stack.Item grow>
                                <Dropdown
                                    label={intl.get(
                                        "settings.integrations.notionAuthorPropertyName"
                                    )}
                                    selectedKey={
                                        tempSettings.notionAuthorPropertyName ||
                                        ""
                                    }
                                    options={Object.keys(notionProperties)
                                        .filter(
                                            (p) =>
                                                notionProperties[p].type ===
                                                "rich_text"
                                        )
                                        .map((p) => ({ key: p, text: p }))}
                                    onChange={(e, option) =>
                                        this.handleToggleChange(
                                            e,
                                            option.key,
                                            "notionAuthorPropertyName"
                                        )
                                    }
                                    placeholder={intl.get(
                                        "settings.integrations.selectAuthorProperty"
                                    )}
                                    disabled={
                                        Object.keys(notionProperties).length ===
                                        0
                                    }
                                />
                            </Stack.Item>
                        </Stack>

                        <Stack horizontal tokens={{ childrenGap: 16 }}>
                            <Stack.Item grow>
                                <Dropdown
                                    label={intl.get(
                                        "settings.integrations.notionDatePropertyName"
                                    )}
                                    selectedKey={
                                        tempSettings.notionDatePropertyName ||
                                        ""
                                    }
                                    options={Object.keys(notionProperties)
                                        .filter(
                                            (p) =>
                                                notionProperties[p].type ===
                                                "date"
                                        )
                                        .map((p) => ({ key: p, text: p }))}
                                    onChange={(e, option) =>
                                        this.handleToggleChange(
                                            e,
                                            option.key,
                                            "notionDatePropertyName"
                                        )
                                    }
                                    placeholder={intl.get(
                                        "settings.integrations.selectDateProperty"
                                    )}
                                    disabled={
                                        Object.keys(notionProperties).length ===
                                        0
                                    }
                                />
                            </Stack.Item>
                            <Stack.Item grow>
                                <Dropdown
                                    label={intl.get(
                                        "settings.integrations.notionSourcePropertyName"
                                    )}
                                    selectedKey={
                                        tempSettings.notionSourcePropertyName ||
                                        ""
                                    }
                                    options={Object.keys(notionProperties)
                                        .filter(
                                            (p) =>
                                                notionProperties[p].type ===
                                                "select"
                                        )
                                        .map((p) => ({ key: p, text: p }))}
                                    onChange={(e, option) =>
                                        this.handleToggleChange(
                                            e,
                                            option.key,
                                            "notionSourcePropertyName"
                                        )
                                    }
                                    placeholder={intl.get(
                                        "settings.integrations.selectSourceProperty"
                                    )}
                                    disabled={
                                        Object.keys(notionProperties).length ===
                                        0
                                    }
                                />
                            </Stack.Item>
                        </Stack>

                        <Stack
                            horizontal
                            tokens={{ childrenGap: 8 }}
                            style={{ marginTop: 16 }}>
                            <PrimaryButton
                                text={intl.get("confirm")}
                                onClick={this.handleSave}
                                disabled={
                                    !tempSettings.notionSecret ||
                                    !tempSettings.notionDatabaseId
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
