import * as React from "react"
import intl from "react-intl-universal"
import {
    Label,
    DefaultButton,
    TextField,
    Stack,
    PrimaryButton,
    DetailsList,
    IColumn,
    SelectionMode,
    Selection,
    IChoiceGroupOption,
    ChoiceGroup,
    IDropdownOption,
    Dropdown,
    MessageBar,
    MessageBarType,
    Toggle,
    IconButton,
    Spinner,
    SpinnerSize,
} from "@fluentui/react"
import {
    SourceState,
    RSSSource,
    SourceOpenTarget,
} from "../../scripts/models/source"
import { urlTest } from "../../scripts/utils"
import DangerButton from "../utils/danger-button"

type SourcesTabProps = {
    sources: SourceState
    serviceOn: boolean
    sids: number[]
    acknowledgeSIDs: () => void
    addSource: (url: string) => void
    updateSourceName: (source: RSSSource, name: string) => void
    updateSourceIcon: (source: RSSSource, iconUrl: string) => Promise<void>
    updateSourceOpenTarget: (
        source: RSSSource,
        target: SourceOpenTarget
    ) => void
    updateFetchFrequency: (source: RSSSource, frequency: number) => void
    deleteSource: (source: RSSSource) => void
    deleteSources: (sources: RSSSource[]) => void
    importOPML: () => void
    exportOPML: () => void
    toggleSourceHidden: (source: RSSSource) => void
}

type SourcesTabState = {
    newUrl: string
    newSourceName: string
    selectedSource: RSSSource
    selectedSources: RSSSource[]
    sourceStatus: Record<number, 'ok' | 'error' | 'checking'>
    sourceStatusTimestamp: Record<number, number> // Timestamp of last status check
    isCheckingAll: boolean
    sourceEditOption?: string
    newSourceIcon?: string
    checkAbortController?: AbortController // For canceling ongoing checks
}

const enum EditDropdownKeys {
    Name = "n",
    Icon = "i",
    Url = "u",
}

class SourcesTab extends React.Component<SourcesTabProps, SourcesTabState> {
    selection: Selection

    constructor(props) {
        super(props)
        this.state = {
            newUrl: "",
            newSourceName: "",
            selectedSource: null,
            selectedSources: null,
            sourceStatus: {},
            sourceStatusTimestamp: {},
            isCheckingAll: false,
        }
        this.selection = new Selection({
            getKey: s => (s as RSSSource).sid,
            onSelectionChanged: () => {
                let count = this.selection.getSelectedCount()
                let sources = count
                    ? (this.selection.getSelection() as RSSSource[])
                    : null
                this.setState({
                    selectedSource: count === 1 ? sources[0] : null,
                    selectedSources: count > 1 ? sources : null,
                    newSourceName: count === 1 ? sources[0].name : "",
                    newSourceIcon: count === 1 ? sources[0].iconurl || "" : "",
                    sourceEditOption: EditDropdownKeys.Name,
                })
            },
        })
    }

    componentDidMount = () => {
        if (this.props.sids.length > 0) {
            for (let sid of this.props.sids) {
                this.selection.setKeySelected(String(sid), true, false)
            }
            this.props.acknowledgeSIDs()
        }
    }

    columns = (): IColumn[] => [
        {
            key: "favicon",
            name: intl.get("icon"),
            fieldName: "name",
            isIconOnly: true,
            iconName: "ImagePixel",
            minWidth: 16,
            maxWidth: 16,
            onRender: (s: RSSSource) =>
                s.iconurl && <img src={s.iconurl} className="favicon" />,
        },
        {
            key: "name",
            name: intl.get("name"),
            fieldName: "name",
            minWidth: 180,
            data: "string",
            isRowHeader: true,
        },
        {
            key: "url",
            name: "URL",
            fieldName: "url",
            minWidth: 220,
            data: "string",
        },
        {
            key: "status",
            name: intl.get("sources.checkStatus"),
            minWidth: 100,
            maxWidth: 100,
            onRender: (s: RSSSource) => {
                const status = this.state.sourceStatus[s.sid]
                if (status === 'checking') {
                    return <Spinner size={SpinnerSize.small} />
                } else if (status === 'ok') {
                    return <span style={{ color: 'green' }}>✓ {intl.get("sources.statusOk")}</span>
                } else if (status === 'error') {
                    return <span style={{ color: 'red' }}>✗ {intl.get("sources.statusError")}</span>
                }
                return <span style={{ color: '#666' }}>{intl.get("sources.statusUnknown")}</span>
            }
        },
        {
            key: "check",
            name: "",
            minWidth: 50,
            onRender: (s: RSSSource) => {
                const isChecking = this.state.sourceStatus[s.sid] === 'checking'
                const timestamp = this.state.sourceStatusTimestamp[s.sid]
                const timeAgo = timestamp ? this.formatTimeAgo(timestamp) : ''
                
                return (
                    <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 4 }}>
                        <IconButton
                            iconProps={{ 
                                iconName: isChecking ? 'Refresh' : 'StatusCheck',
                                style: { color: isChecking ? 'var(--neutralSecondary)' : undefined }
                            }}
                            title={intl.get("sources.checkStatus")}
                            onClick={() => this.checkSourceStatus(s)}
                            disabled={isChecking}
                            styles={{ root: { padding: 4 } }}
                        />
                        {timeAgo && (
                            <span style={{ fontSize: 11, color: 'var(--neutralTertiary)', marginLeft: 4 }}>{timeAgo}</span>
                        )}
                    </Stack>
                )
            }
        },
    ]

    sourceEditOptions = (): IDropdownOption[] => [
        { key: EditDropdownKeys.Name, text: intl.get("name") },
        { key: EditDropdownKeys.Icon, text: intl.get("icon") },
        { key: EditDropdownKeys.Url, text: "URL" },
    ]

    onSourceEditOptionChange = (_, option: IDropdownOption) => {
        this.setState({ sourceEditOption: option.key as string })
    }

    fetchFrequencyOptions = (): IDropdownOption[] => [
        { key: "0", text: intl.get("sources.unlimited") },
        { key: "15", text: intl.get("time.minute", { m: 15 }) },
        { key: "30", text: intl.get("time.minute", { m: 30 }) },
        { key: "60", text: intl.get("time.hour", { h: 1 }) },
        { key: "120", text: intl.get("time.hour", { h: 2 }) },
        { key: "180", text: intl.get("time.hour", { h: 3 }) },
        { key: "360", text: intl.get("time.hour", { h: 6 }) },
        { key: "720", text: intl.get("time.hour", { h: 12 }) },
        { key: "1440", text: intl.get("time.day", { d: 1 }) },
    ]

    onFetchFrequencyChange = (_, option: IDropdownOption) => {
        let frequency = parseInt(option.key as string)
        this.props.updateFetchFrequency(this.state.selectedSource, frequency)
        this.setState({
            selectedSource: {
                ...this.state.selectedSource,
                fetchFrequency: frequency,
            } as RSSSource,
        })
    }

    sourceOpenTargetChoices = (): IChoiceGroupOption[] => [
        {
            key: String(SourceOpenTarget.Local),
            text: intl.get("sources.rssText"),
        },
        {
            key: String(SourceOpenTarget.FullContent),
            text: intl.get("article.loadFull"),
        },
        {
            key: String(SourceOpenTarget.Webpage),
            text: intl.get("sources.loadWebpage"),
        },
        {
            key: String(SourceOpenTarget.External),
            text: intl.get("openExternal"),
        },
    ]

    updateSourceName = () => {
        let newName = this.state.newSourceName.trim()
        this.props.updateSourceName(this.state.selectedSource, newName)
        this.setState({
            selectedSource: {
                ...this.state.selectedSource,
                name: newName,
            } as RSSSource,
        })
    }

    updateSourceIcon = () => {
        let newIcon = this.state.newSourceIcon.trim()
        this.props.updateSourceIcon(this.state.selectedSource, newIcon)
        this.setState({
            selectedSource: { ...this.state.selectedSource, iconurl: newIcon },
        })
    }

    handleInputChange = event => {
        const name: string = event.target.name
        this.setState({ [name]: event.target.value } as any)
    }

    addSource = (event: React.FormEvent) => {
        event.preventDefault()
        let trimmed = this.state.newUrl.trim()
        if (urlTest(trimmed)) this.props.addSource(trimmed)
    }

    onOpenTargetChange = (_, option: IChoiceGroupOption) => {
        let newTarget = parseInt(option.key) as SourceOpenTarget
        this.props.updateSourceOpenTarget(this.state.selectedSource, newTarget)
        this.setState({
            selectedSource: {
                ...this.state.selectedSource,
                openTarget: newTarget,
            } as RSSSource,
        })
    }

    onToggleHidden = () => {
        this.props.toggleSourceHidden(this.state.selectedSource)
        this.setState({
            selectedSource: {
                ...this.state.selectedSource,
                hidden: !this.state.selectedSource.hidden,
            } as RSSSource,
        })
    }

    checkSourceStatus = async (source: RSSSource, useNewController = false) => {
        // If component is unmounted, don't update state
        if (!this) return
        
        this.setState(prevState => ({
            sourceStatus: { ...prevState.sourceStatus, [source.sid]: 'checking' },
            sourceStatusTimestamp: { ...prevState.sourceStatusTimestamp, [source.sid]: Date.now() }
        }))

        // Create new abort controller if needed
        const controller = useNewController ? new AbortController() : 
                          (this.state.checkAbortController || new AbortController())
        
        if (useNewController) {
            this.setState({ checkAbortController: controller })
        }

        try {
            const timeoutId = setTimeout(() => controller.abort(), 10000)

            const response = await fetch(source.url, {
                signal: controller.signal,
                method: 'HEAD',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            })
            clearTimeout(timeoutId)

            // Only update state if component is still mounted
            if (this) {
                this.setState(prevState => ({
                    sourceStatus: { ...prevState.sourceStatus, [source.sid]: response.ok ? 'ok' : 'error' },
                    sourceStatusTimestamp: { ...prevState.sourceStatusTimestamp, [source.sid]: Date.now() }
                }))
            }
        } catch (error) {
            // Don't update state if request was aborted
            if (error instanceof Error && error.name === 'AbortError') {
                console.log(`Check aborted for source: ${source.name}`)
                return
            }
            
            if (this) {
                this.setState(prevState => ({
                    sourceStatus: { ...prevState.sourceStatus, [source.sid]: 'error' },
                    sourceStatusTimestamp: { ...prevState.sourceStatusTimestamp, [source.sid]: Date.now() }
                }))
            }
        }
    }

    checkAllSources = async () => {
        // Cancel any ongoing checks
        if (this.state.checkAbortController) {
            this.state.checkAbortController.abort()
        }
        
        const controller = new AbortController()
        this.setState({ isCheckingAll: true, checkAbortController: controller })
        
        const sources = Object.values(this.props.sources)

        for (const source of sources) {
            // Check if aborted
            if (controller.signal.aborted) {
                break
            }
            
            await this.checkSourceStatus(source, true)
            await new Promise(resolve => setTimeout(resolve, 500))
        }

        if (!controller.signal.aborted) {
            this.setState({ isCheckingAll: false, checkAbortController: undefined })
        }
    }

    cancelCheckAll = () => {
        if (this.state.checkAbortController) {
            this.state.checkAbortController.abort()
            this.setState({ isCheckingAll: false, checkAbortController: undefined })
        }
    }

    selectAllInvalidSources = () => {
        const sources = Object.values(this.props.sources)
        const invalidSids = sources
            .filter(s => this.state.sourceStatus[s.sid] === 'error')
            .map(s => s.sid)

        this.selection.setAllSelected(false)
        invalidSids.forEach(sid => {
            this.selection.setKeySelected(String(sid), true, false)
        })
    }

    formatTimeAgo = (timestamp: number): string => {
        const seconds = Math.floor((Date.now() - timestamp) / 1000)
        if (seconds < 60) return `${seconds}s`
        const minutes = Math.floor(seconds / 60)
        if (minutes < 60) return `${minutes}m`
        const hours = Math.floor(minutes / 60)
        if (hours < 24) return `${hours}h`
        const days = Math.floor(hours / 24)
        return `${days}d`
    }

    deleteInvalidSources = () => {
        const sources = Object.values(this.props.sources)
        const invalidSources = sources.filter(
            s => this.state.sourceStatus[s.sid] === 'error'
        )
        
        if (invalidSources.length === 0) {
            window.utils.showMessageBox(
                intl.get("sources.checkStatus"),
                intl.get("sources.noInvalidSources"),
                intl.get("confirm"),
                "",
                false
            )
            return
        }
        
        window.utils.showMessageBox(
            intl.get("sources.deleteInvalid"),
            `Are you sure you want to delete ${invalidSources.length} invalid source(s)?`,
            intl.get("delete"),
            intl.get("cancel"),
            false,
            "warning"
        ).then(confirmed => {
            if (confirmed) {
                this.props.deleteSources(invalidSources)
                this.setState(prevState => {
                    const newStatus = { ...prevState.sourceStatus }
                    invalidSources.forEach(s => delete newStatus[s.sid])
                    return { sourceStatus: newStatus }
                })
            }
        })
    }

    render = () => (
        <div className="tab-body">
            {this.props.serviceOn && (
                <MessageBar messageBarType={MessageBarType.info}>
                    {intl.get("sources.serviceWarning")}
                </MessageBar>
            )}
            <Label>{intl.get("sources.opmlFile")}</Label>
            <Stack horizontal>
                <Stack.Item>
                    <PrimaryButton
                        onClick={this.props.importOPML}
                        text={intl.get("sources.import")}
                    />
                </Stack.Item>
                <Stack.Item>
                    <DefaultButton
                        onClick={this.props.exportOPML}
                        text={intl.get("sources.export")}
                    />
                </Stack.Item>
                <Stack.Item>
                    <DefaultButton
                        onClick={this.checkAllSources}
                        text={intl.get("sources.checkStatus")}
                        disabled={this.state.isCheckingAll}
                        iconProps={{ iconName: this.state.isCheckingAll ? 'Refresh' : 'StatusCheck' }}
                    />
                </Stack.Item>
                <Stack.Item>
                    <DefaultButton
                        onClick={this.selectAllInvalidSources}
                        text={intl.get("sources.selectAllInvalid")}
                    />
                </Stack.Item>
                <Stack.Item>
                    <DangerButton
                        onClick={this.deleteInvalidSources}
                        text={intl.get("sources.deleteInvalid")}
                    />
                </Stack.Item>
            </Stack>

            <form onSubmit={this.addSource}>
                <Stack horizontal verticalAlign="baseline">
                    <Stack.Item>
                        <Label htmlFor="newUrl" style={{ marginBottom: 0, marginRight: 8 }}>
                            {intl.get("sources.add")}
                        </Label>
                    </Stack.Item>
                    <Stack.Item grow>
                        <TextField
                            onGetErrorMessage={v =>
                                urlTest(v.trim())
                                    ? ""
                                    : intl.get("sources.badUrl")
                            }
                            validateOnLoad={false}
                            placeholder={intl.get("sources.inputUrl")}
                            value={this.state.newUrl}
                            id="newUrl"
                            name="newUrl"
                            onChange={this.handleInputChange}
                        />
                    </Stack.Item>
                    <Stack.Item>
                        <PrimaryButton
                            disabled={!urlTest(this.state.newUrl.trim())}
                            type="submit"
                            text={intl.get("add")}
                        />
                    </Stack.Item>
                </Stack>
            </form>

            <DetailsList
                compact={Object.keys(this.props.sources).length >= 10}
                items={Object.values(this.props.sources)}
                columns={this.columns()}
                getKey={s => s.sid}
                setKey="selected"
                selection={this.selection}
                selectionMode={SelectionMode.multiple}
            />

            {this.state.selectedSource && (
                <>
                    {this.state.selectedSource.serviceRef && (
                        <MessageBar messageBarType={MessageBarType.info}>
                            {intl.get("sources.serviceManaged")}
                        </MessageBar>
                    )}
                    <Stack horizontal verticalAlign="baseline">
                        <Stack.Item>
                            <Label style={{ marginBottom: 0, marginRight: 8 }}>
                                {intl.get("sources.selected")}
                            </Label>
                        </Stack.Item>
                        <Stack.Item>
                            <Dropdown
                                options={this.sourceEditOptions()}
                                selectedKey={this.state.sourceEditOption}
                                onChange={this.onSourceEditOptionChange}
                                style={{ width: 120 }}
                            />
                        </Stack.Item>
                        {this.state.sourceEditOption ===
                            EditDropdownKeys.Name && (
                            <>
                                <Stack.Item grow>
                                    <TextField
                                        onGetErrorMessage={v =>
                                            v.trim().length == 0
                                                ? intl.get("emptyName")
                                                : ""
                                        }
                                        validateOnLoad={false}
                                        placeholder={intl.get("sources.name")}
                                        value={this.state.newSourceName}
                                        name="newSourceName"
                                        onChange={this.handleInputChange}
                                    />
                                </Stack.Item>
                                <Stack.Item>
                                    <DefaultButton
                                        disabled={
                                            this.state.newSourceName.trim()
                                                .length == 0
                                        }
                                        onClick={this.updateSourceName}
                                        text={intl.get("sources.editName")}
                                    />
                                </Stack.Item>
                            </>
                        )}
                        {this.state.sourceEditOption ===
                            EditDropdownKeys.Icon && (
                            <>
                                <Stack.Item grow>
                                    <TextField
                                        onGetErrorMessage={v =>
                                            urlTest(v.trim())
                                                ? ""
                                                : intl.get("sources.badUrl")
                                        }
                                        validateOnLoad={false}
                                        placeholder={intl.get(
                                            "sources.inputUrl"
                                        )}
                                        value={this.state.newSourceIcon}
                                        name="newSourceIcon"
                                        onChange={this.handleInputChange}
                                    />
                                </Stack.Item>
                                <Stack.Item>
                                    <DefaultButton
                                        disabled={
                                            !urlTest(
                                                this.state.newSourceIcon.trim()
                                            )
                                        }
                                        onClick={this.updateSourceIcon}
                                        text={intl.get("edit")}
                                    />
                                </Stack.Item>
                            </>
                        )}
                        {this.state.sourceEditOption ===
                            EditDropdownKeys.Url && (
                            <>
                                <Stack.Item grow>
                                    <TextField
                                        disabled
                                        value={this.state.selectedSource.url}
                                    />
                                </Stack.Item>
                                <Stack.Item>
                                    <DefaultButton
                                        onClick={() =>
                                            window.utils.writeClipboard(
                                                this.state.selectedSource.url
                                            )
                                        }
                                        text={intl.get("context.copy")}
                                    />
                                </Stack.Item>
                            </>
                        )}
                    </Stack>
                    {!this.state.selectedSource.serviceRef && (
                        <>
                            <Stack horizontal verticalAlign="baseline">
                                <Stack.Item>
                                    <Label style={{ marginBottom: 0, marginRight: 8 }}>
                                        {intl.get("sources.fetchFrequency")}
                                    </Label>
                                </Stack.Item>
                                <Stack.Item>
                                    <Dropdown
                                        options={this.fetchFrequencyOptions()}
                                        selectedKey={
                                            this.state.selectedSource
                                                .fetchFrequency
                                                ? String(
                                                      this.state.selectedSource
                                                          .fetchFrequency
                                                  )
                                                : "0"
                                        }
                                        onChange={this.onFetchFrequencyChange}
                                        style={{ width: 200 }}
                                    />
                                </Stack.Item>
                            </Stack>
                        </>
                    )}
                    <ChoiceGroup
                        label={intl.get("sources.openTarget")}
                        options={this.sourceOpenTargetChoices()}
                        selectedKey={String(
                            this.state.selectedSource.openTarget
                        )}
                        onChange={this.onOpenTargetChange}
                    />
                    <Stack horizontal verticalAlign="baseline">
                        <Stack.Item grow>
                            <Label>{intl.get("sources.hidden")}</Label>
                        </Stack.Item>
                        <Stack.Item>
                            <Toggle
                                checked={this.state.selectedSource.hidden}
                                onChange={this.onToggleHidden}
                            />
                        </Stack.Item>
                    </Stack>
                    {!this.state.selectedSource.serviceRef && (
                        <Stack horizontal>
                            <Stack.Item>
                                <DangerButton
                                    onClick={() =>
                                        this.props.deleteSource(
                                            this.state.selectedSource
                                        )
                                    }
                                    key={this.state.selectedSource.sid}
                                    text={intl.get("sources.delete")}
                                />
                            </Stack.Item>
                            <Stack.Item>
                                <span className="settings-hint">
                                    {intl.get("sources.deleteWarning")}
                                </span>
                            </Stack.Item>
                        </Stack>
                    )}
                </>
            )}
            {this.state.selectedSources &&
                (this.state.selectedSources.filter(s => s.serviceRef).length ===
                0 ? (
                    <>
                        <Label>{intl.get("sources.selectedMulti")}</Label>
                        <Stack horizontal>
                            <Stack.Item>
                                <DangerButton
                                    onClick={() =>
                                        this.props.deleteSources(
                                            this.state.selectedSources
                                        )
                                    }
                                    text={intl.get("sources.delete")}
                                />
                            </Stack.Item>
                            <Stack.Item>
                                <span className="settings-hint">
                                    {intl.get("sources.deleteWarning")}
                                </span>
                            </Stack.Item>
                        </Stack>
                    </>
                ) : (
                    <MessageBar messageBarType={MessageBarType.info}>
                        {intl.get("sources.serviceManaged")}
                    </MessageBar>
                ))}
        </div>
    )
}

export default SourcesTab
