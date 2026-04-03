import * as React from "react"
import intl from "react-intl-universal"
import {
    Label,
    Stack,
    TextField,
    Toggle,
    Checkbox,
    DefaultButton,
    Dropdown,
    IDropdownOption,
} from "@fluentui/react"
import { IntegrationSettings } from "../../schema-types"
import { SourceState } from "../../scripts/models/source"
import { SourceGroup } from "../../schema-types"
import CollapsibleSection from "./collapsible-section"

type DailyBriefingInlineProps = {
    settings: IntegrationSettings
    sources: SourceState
    groups: SourceGroup[]
    onChange: (settings: IntegrationSettings) => void
}

type DailyBriefingInlineState = {
    localSettings: IntegrationSettings
    selectedSourceType: 'all' | 'specific'
    expandedGroups: { [key: number]: boolean }
}

export default class DailyBriefingInline extends React.Component<
    DailyBriefingInlineProps,
    DailyBriefingInlineState
> {
    constructor(props) {
        super(props)
        const hasSpecificSources = props.settings.digestSourceIds && props.settings.digestSourceIds.length > 0
        const hasSpecificGroups = props.settings.digestGroupIds && props.settings.digestGroupIds.length > 0
        this.state = {
            localSettings: { ...props.settings },
            selectedSourceType: (hasSpecificSources || hasSpecificGroups) ? 'specific' : 'all',
            expandedGroups: {},
        }
    }

    componentDidUpdate(prevProps: DailyBriefingInlineProps) {
        if (prevProps.settings !== this.props.settings) {
            const hasSpecificSources = this.props.settings.digestSourceIds && this.props.settings.digestSourceIds.length > 0
            const hasSpecificGroups = this.props.settings.digestGroupIds && this.props.settings.digestGroupIds.length > 0
            this.setState({
                localSettings: { ...this.props.settings },
                selectedSourceType: (hasSpecificSources || hasSpecificGroups) ? 'specific' : 'all',
                expandedGroups: {},
            })
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

    handleToggleChange = (
        event: React.FormEvent<HTMLElement>,
        checked: any
    ) => {
        const name = (event.currentTarget as HTMLInputElement).name
        this.setState(
            prevState => {
                const newSettings = { ...prevState.localSettings, [name]: checked }
                return { localSettings: newSettings }
            },
            () => {
                this.props.onChange(this.state.localSettings)
            }
        )
    }

    handleSourceTypeChange = (type: 'all' | 'specific') => {
        this.setState({ selectedSourceType: type })
        if (type === 'all') {
            this.setState(prevState => ({
                localSettings: {
                    ...prevState.localSettings,
                    digestSourceIds: undefined,
                    digestGroupIds: undefined,
                }
            }))
        }
    }

    handleSourceToggle = (sourceId: number) => {
        this.setState(prevState => {
            const currentIds = prevState.localSettings.digestSourceIds || []
            const newIds = currentIds.includes(sourceId)
                ? currentIds.filter(id => id !== sourceId)
                : [...currentIds, sourceId]
            return {
                localSettings: {
                    ...prevState.localSettings,
                    digestSourceIds: newIds.length > 0 ? newIds : undefined,
                }
            }
        })
    }

    handleGroupToggle = (groupId: number) => {
        this.setState(prevState => {
            const currentIds = prevState.localSettings.digestGroupIds || []
            const newIds = currentIds.includes(groupId)
                ? currentIds.filter(id => id !== groupId)
                : [...currentIds, groupId]
            return {
                localSettings: {
                    ...prevState.localSettings,
                    digestGroupIds: newIds.length > 0 ? newIds : undefined,
                }
            }
        })
    }

    toggleGroupExpand = (groupIndex: number) => {
        this.setState(prevState => ({
            expandedGroups: {
                ...prevState.expandedGroups,
                [groupIndex]: !prevState.expandedGroups[groupIndex],
            }
        }))
    }

    render() {
        const { localSettings, selectedSourceType, expandedGroups } = this.state
        const { sources, groups } = this.props

        // Build source list
        const sourceList: JSX.Element[] = []
        Object.entries(sources).forEach(([idStr, source]) => {
            const sourceId = source.sid
            const isSelected = localSettings.digestSourceIds?.includes(sourceId) || false
            sourceList.push(
                <div key={sourceId} style={{ marginBottom: 4 }}>
                    <Checkbox
                        checked={isSelected}
                        label={source.name}
                        onChange={() => this.handleSourceToggle(sourceId)}
                    />
                </div>
            )
        })

        // Build group list
        const groupList: JSX.Element[] = groups.map((group, index) => {
            const isSelected = localSettings.digestGroupIds?.includes(index) || false
            const isExpanded = expandedGroups[index] || false
            const groupSources = group.sids || []

            return (
                <div key={index} style={{ marginBottom: 12 }}>
                    <Stack horizontal horizontalAlign="space-between">
                        <Checkbox
                            checked={isSelected}
                            label={group.name || `Group ${index + 1}`}
                            onChange={() => this.handleGroupToggle(index)}
                        />
                        {groupSources.length > 0 && (
                            <DefaultButton
                                text={isExpanded ? "收起" : `展开 (${groupSources.length})`}
                                onClick={() => this.toggleGroupExpand(index)}
                                styles={{ root: { fontSize: 12 } }}
                            />
                        )}
                    </Stack>
                    {isExpanded && (
                        <div style={{ marginLeft: 24, marginTop: 8 }}>
                            {groupSources.map(sourceId => {
                                const source = sources[sourceId]
                                if (!source) return null
                                const isSourceSelected = localSettings.digestSourceIds?.includes(sourceId) || false
                                return (
                                    <div key={sourceId} style={{ marginBottom: 4 }}>
                                        <Checkbox
                                            checked={isSourceSelected}
                                            label={source.name}
                                            onChange={() => this.handleSourceToggle(sourceId)}
                                            disabled={isSelected}
                                        />
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )
        })

        const hasAutoPush = localSettings.autoPushEnabled || false
        const hasDalle = localSettings.dalleEnabled || false
        const hasTopics = !!localSettings.digestTopics
        const hasTime = !!localSettings.digestTime

        const statusIndicators = (
            <Stack horizontal tokens={{ childrenGap: 8 }}>
                {hasTime && (
                    <Label style={{ color: "var(--green)", fontSize: 12, margin: 0 }}>
                        ✓ {localSettings.digestTime}
                    </Label>
                )}
                {hasAutoPush && (
                    <Label style={{ color: "var(--green)", fontSize: 12, margin: 0 }}>
                        ✓ 自动推送
                    </Label>
                )}
            </Stack>
        )

        return (
            <CollapsibleSection
                title={intl.get("settings.integrations.dailyBriefingAutomation")}
                headerContent={statusIndicators}
            >
                <Stack tokens={{ childrenGap: 16 }}>
                    {/* Basic Settings */}
                    <Stack horizontal tokens={{ childrenGap: 24 }} wrap>
                        <TextField
                            label={intl.get("settings.integrations.scheduledTime")}
                            name="digestTime"
                            placeholder="09:00"
                            value={localSettings.digestTime || ""}
                            onChange={this.handleInputChange}
                            style={{ width: 120 }}
                        />
                        <Toggle
                            label={intl.get("settings.integrations.autoPushEnabled")}
                            checked={localSettings.autoPushEnabled || false}
                            onChange={(e, checked) => {
                                this.setState(
                                    prevState => {
                                        const newSettings = { ...prevState.localSettings, autoPushEnabled: checked }
                                        return { localSettings: newSettings }
                                    },
                                    () => {
                                        this.props.onChange(this.state.localSettings)
                                    }
                                )
                            }}
                        />
                        <Toggle
                            label={intl.get("settings.integrations.useDalle")}
                            checked={localSettings.dalleEnabled || false}
                            onChange={(e, checked) => {
                                this.setState(
                                    prevState => {
                                        const newSettings = { ...prevState.localSettings, dalleEnabled: checked }
                                        return { localSettings: newSettings }
                                    },
                                    () => {
                                        this.props.onChange(this.state.localSettings)
                                    }
                                )
                            }}
                        />
                    </Stack>

                    {/* Source Selection */}
                    <div>
                        <Label style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
                            简报来源
                        </Label>
                        <Stack horizontal tokens={{ childrenGap: 16 }} style={{ marginBottom: 12 }}>
                            <Checkbox
                                checked={selectedSourceType === 'all'}
                                label="所有订阅源"
                                onChange={() => this.handleSourceTypeChange('all')}
                            />
                            <Checkbox
                                checked={selectedSourceType === 'specific'}
                                label="指定订阅源/组"
                                onChange={() => this.handleSourceTypeChange('specific')}
                            />
                        </Stack>

                        {selectedSourceType === 'specific' && (
                            <Stack horizontal tokens={{ childrenGap: 24 }} wrap>
                                <div style={{ flex: 1, minWidth: 200 }}>
                                    <Label style={{ fontSize: 13, marginBottom: 8 }}>
                                        订阅组
                                    </Label>
                                    <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--neutralLight)', padding: 8 }}>
                                        {groupList}
                                    </div>
                                </div>
                                <div style={{ flex: 1, minWidth: 200 }}>
                                    <Label style={{ fontSize: 13, marginBottom: 8 }}>
                                        订阅源
                                    </Label>
                                    <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--neutralLight)', padding: 8 }}>
                                        {sourceList}
                                    </div>
                                </div>
                            </Stack>
                        )}
                    </div>

                    {/* Interest Topics */}
                    <TextField
                        label={intl.get("settings.integrations.interestTopics")}
                        name="digestTopics"
                        placeholder="AI, Tech Trends, Rust, Space"
                        value={localSettings.digestTopics || ""}
                        onChange={this.handleInputChange}
                        description={intl.get("settings.integrations.interestTopicsDescription")}
                    />
                </Stack>
            </CollapsibleSection>
        )
    }
}
