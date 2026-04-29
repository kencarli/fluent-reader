import * as React from "react"
import intl from "react-intl-universal"
import {
    Label,
    Stack,
    TextField,
    Checkbox,
    DefaultButton,
    Dropdown,
    IDropdownOption,
} from "@fluentui/react"
import Switch from "../utils/switch"
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
    expandedGroups: Set<number>
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
            expandedGroups: new Set(),
        }
    }

    componentDidUpdate(prevProps: DailyBriefingInlineProps) {
        if (prevProps.settings !== this.props.settings) {
            const hasSpecificSources = this.props.settings.digestSourceIds && this.props.settings.digestSourceIds.length > 0
            const hasSpecificGroups = this.props.settings.digestGroupIds && this.props.settings.digestGroupIds.length > 0
            this.setState({
                localSettings: { ...this.props.settings },
                selectedSourceType: (hasSpecificSources || hasSpecificGroups) ? 'specific' : 'all',
                expandedGroups: new Set(),
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
        this.setState(prevState => {
            const newExpanded = new Set(prevState.expandedGroups)
            if (newExpanded.has(groupIndex)) {
                newExpanded.delete(groupIndex)
            } else {
                newExpanded.add(groupIndex)
            }
            return { expandedGroups: newExpanded }
        })
    }

    render() {
        const { localSettings, selectedSourceType, expandedGroups } = this.state
        const { sources, groups } = this.props

        // 构建树形结构: 组 + 不在任何组的单独源
        const groupSids = new Set<number>()
        groups.forEach(g => g.sids?.forEach(sid => groupSids.add(sid)))

        const standaloneSourceIds = Object.keys(sources)
            .map(Number)
            .filter(sid => !groupSids.has(sid))

        // 渲染树节点
        const renderTree = () => {
            const nodes: JSX.Element[] = []

            // 渲染组
            groups.forEach((group, groupIndex) => {
                const isGroupSelected = localSettings.digestGroupIds?.includes(groupIndex) || false
                const isExpanded = expandedGroups.has(groupIndex)
                const groupSources = group.sids || []

                nodes.push(
                    <div key={`group-${groupIndex}`} style={{ marginBottom: 4 }}>
                        <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }}>
                            <Checkbox
                                checked={isGroupSelected}
                                label={group.name || `Group ${groupIndex + 1}`}
                                onChange={() => this.handleGroupToggle(groupIndex)}
                                styles={{ root: { fontWeight: 600 } }}
                            />
                            {groupSources.length > 0 && (
                                <DefaultButton
                                    text={isExpanded ? '▾' : `▸ (${groupSources.length})`}
                                    onClick={() => this.toggleGroupExpand(groupIndex)}
                                    styles={{ root: { minWidth: 32, height: 24, fontSize: 12, padding: '0 6px' } }}
                                />
                            )}
                        </Stack>
                        {isExpanded && !isGroupSelected && (
                            <div style={{ marginLeft: 24, marginTop: 4 }}>
                                {groupSources.map(sourceId => {
                                    const source = sources[sourceId]
                                    if (!source) return null
                                    const isSourceSelected = localSettings.digestSourceIds?.includes(sourceId) || false
                                    return (
                                        <div key={sourceId} style={{ marginBottom: 2 }}>
                                            <Checkbox
                                                checked={isSourceSelected}
                                                label={source.name}
                                                onChange={() => this.handleSourceToggle(sourceId)}
                                                styles={{ root: { fontSize: 13 } }}
                                            />
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )
            })

            // 渲染不在组中的单独源
            if (standaloneSourceIds.length > 0) {
                if (nodes.length > 0) {
                    nodes.push(
                        <div key="separator" style={{ borderTop: '1px solid var(--neutralLight)', margin: '8px 0' }} />
                    )
                }
                standaloneSourceIds.forEach(sourceId => {
                    const source = sources[sourceId]
                    if (!source) return null
                    const isSourceSelected = localSettings.digestSourceIds?.includes(sourceId) || false
                    nodes.push(
                        <div key={`source-${sourceId}`} style={{ marginBottom: 2 }}>
                            <Checkbox
                                checked={isSourceSelected}
                                label={source.name}
                                onChange={() => this.handleSourceToggle(sourceId)}
                                styles={{ root: { fontSize: 13 } }}
                            />
                        </div>
                    )
                })
            }

            return nodes.length > 0 ? nodes : <Label style={{ color: 'var(--neutralSecondaryAlt)', fontSize: 12 }}>暂无源</Label>
        }

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
                        ✓ {intl.get('settings.integrations.autoPushStatus')}
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
                        <Switch
                            label={intl.get("settings.integrations.autoPushEnabled")}
                            checked={localSettings.autoPushEnabled || false}
                            onChange={(checked) => {
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
                        <Switch
                            label={intl.get("settings.integrations.useDalle")}
                            checked={localSettings.dalleEnabled || false}
                            onChange={(checked) => {
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
                            {intl.get('settings.integrations.briefingSource')}
                        </Label>
                        <Stack horizontal tokens={{ childrenGap: 16 }} style={{ marginBottom: 12 }}>
                            <Checkbox
                                checked={selectedSourceType === 'all'}
                                label={intl.get('settings.integrations.allSources')}
                                onChange={() => this.handleSourceTypeChange('all')}
                            />
                            <Checkbox
                                checked={selectedSourceType === 'specific'}
                                label={intl.get('settings.integrations.specificSources')}
                                onChange={() => this.handleSourceTypeChange('specific')}
                            />
                        </Stack>

                        {selectedSourceType === 'specific' && (
                            <div>
                                <Label style={{ fontSize: 13, marginBottom: 8 }}>
                                    {intl.get('settings.integrations.selectSources')}
                                </Label>
                                <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid var(--neutralLight)', padding: 8, borderRadius: 2 }}>
                                    {renderTree()}
                                </div>
                            </div>
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
