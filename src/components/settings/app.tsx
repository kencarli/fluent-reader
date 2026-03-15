import * as React from "react"
import intl from "react-intl-universal"
import {
    urlTest,
    byteToMB,
    calculateItemSize,
    getSearchEngineName,
} from "../../scripts/utils"
import { ThemeSettings, SearchEngines } from "../../schema-types"
import {
    getThemeSettings,
    setThemeSettings,
    exportAll,
} from "../../scripts/settings"
import {
    Stack,
    Label,
    Toggle,
    TextField,
    DefaultButton,
    ChoiceGroup,
    IChoiceGroupOption,
    Dropdown,
    IDropdownOption,
    PrimaryButton,
    Checkbox,
    DropdownMenuItemType,
} from "@fluentui/react"
import DangerButton from "../utils/danger-button"

type AppTabProps = {
    setLanguage: (option: string) => void
    setFetchInterval: (interval: number) => void
    deleteArticles: (days: number) => Promise<void>
    importAll: () => Promise<void>
}

type AppTabState = {
    pacStatus: boolean
    pacUrl: string
    themeSettings: ThemeSettings
    itemSize: string
    cacheSize: string
    // 清理类型：'time' | 'duplicates' | 'all'
    cleanupType: string
    // 按时间删除
    deleteDaysIndex: string
    // 去重设置
    duplicateTimeWindow: number
    duplicateByUrl: boolean
    duplicateBySimilarTitle: boolean
    duplicateSimilarityThreshold: number
}

class AppTab extends React.Component<AppTabProps, AppTabState> {
    constructor(props) {
        super(props)
        this.state = {
            pacStatus: window.settings.getProxyStatus(),
            pacUrl: window.settings.getProxy(),
            themeSettings: getThemeSettings(),
            itemSize: null,
            cacheSize: null,
            cleanupType: 'time',
            deleteDaysIndex: '7',
            // 去重设置默认值
            duplicateTimeWindow: 0,
            duplicateByUrl: false,
            duplicateBySimilarTitle: false,
            duplicateSimilarityThreshold: 0.85,
        }
        this.getItemSize()
        this.getCacheSize()
    }

    getCacheSize = () => {
        window.utils.getCacheSize().then(size => {
            this.setState({ cacheSize: byteToMB(size) })
        })
    }
    getItemSize = () => {
        calculateItemSize().then(size => {
            this.setState({ itemSize: byteToMB(size) })
        })
    }

    clearCache = () => {
        window.utils.clearCache().then(() => {
            this.getCacheSize()
        })
    }

    deleteDuplicateArticles = async () => {
        try {
            const { deleteDuplicateItems } = await import('../../scripts/models/item')
            const deletedCount = await deleteDuplicateItems({
                timeWindow: this.state.duplicateTimeWindow,
                byUrl: this.state.duplicateByUrl,
                bySimilarTitle: this.state.duplicateBySimilarTitle,
                similarityThreshold: this.state.duplicateSimilarityThreshold,
            })

            window.utils.showMessageBox(
                intl.get("app.cleanup"),
                intl.get("app.duplicatesDeleted", { count: deletedCount }),
                intl.get("confirm"),
                "",
                false
            )

            this.getItemSize()
        } catch (error) {
            window.utils.showErrorBox(
                intl.get("app.error"),
                String(error)
            )
        }
    }

    themeChoices = (): IChoiceGroupOption[] => [
        { key: ThemeSettings.Default, text: intl.get("followSystem") },
        { key: ThemeSettings.Light, text: intl.get("app.lightTheme") },
        { key: ThemeSettings.Dark, text: intl.get("app.darkTheme") },
    ]

    fetchIntervalOptions = (): IDropdownOption[] => [
        { key: 0, text: intl.get("app.never") },
        { key: 10, text: intl.get("time.minute", { m: 10 }) },
        { key: 15, text: intl.get("time.minute", { m: 15 }) },
        { key: 20, text: intl.get("time.minute", { m: 20 }) },
        { key: 30, text: intl.get("time.minute", { m: 30 }) },
        { key: 45, text: intl.get("time.minute", { m: 45 }) },
        { key: 60, text: intl.get("time.hour", { h: 1 }) },
    ]
    onFetchIntervalChanged = (item: IDropdownOption) => {
        this.props.setFetchInterval(item.key as number)
    }

    searchEngineOptions = (): IDropdownOption[] =>
        [
            SearchEngines.Google,
            SearchEngines.Bing,
            SearchEngines.Baidu,
            SearchEngines.DuckDuckGo,
        ].map(engine => ({
            key: engine,
            text: getSearchEngineName(engine),
        }))
    onSearchEngineChanged = (item: IDropdownOption) => {
        window.settings.setSearchEngine(item.key as number)
    }

    // 清理类型选项
    cleanupOptions = (): IDropdownOption[] => [
        { key: "time", text: intl.get("app.cleanupByTime"), itemType: DropdownMenuItemType.Header },
        { key: "7", text: intl.get("app.daysAgo", { days: 7 }) },
        { key: "14", text: intl.get("app.daysAgo", { days: 14 }) },
        { key: "21", text: intl.get("app.daysAgo", { days: 21 }) },
        { key: "28", text: intl.get("app.daysAgo", { days: 28 }) },
        { key: "0", text: intl.get("app.deleteAll") },
        { key: "duplicates", text: intl.get("app.deleteDuplicates") },
    ]

    cleanupChange = (_, item: IDropdownOption) => {
        const key = item ? String(item.key) : null
        if (key === "time" || key === "duplicates" || key === "all") {
            this.setState({ cleanupType: key })
        } else {
            this.setState({ deleteDaysIndex: key, cleanupType: key === "0" ? "all" : "time" })
        }
    }

    confirmCleanup = () => {
        this.setState({ itemSize: null })
        
        if (this.state.cleanupType === "duplicates") {
            this.deleteDuplicateArticles().then(() => this.getItemSize())
        } else {
            this.props
                .deleteArticles(parseInt(this.state.deleteDaysIndex))
                .then(() => this.getItemSize())
        }
    }

    languageOptions = (): IDropdownOption[] => [
        { key: "default", text: intl.get("followSystem") },
        { key: "de", text: "Deutsch" },
        { key: "en-US", text: "English" },
        { key: "es", text: "Español" },
        { key: "cs", text: "Čeština" },
        { key: "fr-FR", text: "Français" },
        { key: "it", text: "Italiano" },
        { key: "nl", text: "Nederlands" },
        { key: "pt-BR", text: "Português do Brasil" },
        { key: "pt-PT", text: "Português de Portugal" },
        { key: "fi-FI", text: "Suomi" },
        { key: "sv", text: "Svenska" },
        { key: "tr", text: "Türkçe" },
        { key: "uk", text: "Українська" },
        { key: "ru", text: "Русский" },
        { key: "ko", text: "한글" },
        { key: "ja", text: "日本語" },
        { key: "zh-CN", text: "中文（简体）" },
        { key: "zh-TW", text: "中文（繁體）" },
    ]

    toggleStatus = () => {
        window.settings.toggleProxyStatus()
        this.setState({
            pacStatus: window.settings.getProxyStatus(),
            pacUrl: window.settings.getProxy(),
        })
    }

    handleInputChange = event => {
        const name: string = event.target.name
        // @ts-ignore
        this.setState({ [name]: event.target.value.trim() })
    }

    setUrl = (event: React.FormEvent) => {
        event.preventDefault()
        if (urlTest(this.state.pacUrl))
            window.settings.setProxy(this.state.pacUrl)
    }

    onThemeChange = (_, option: IChoiceGroupOption) => {
        setThemeSettings(option.key as ThemeSettings)
        this.setState({ themeSettings: option.key as ThemeSettings })
    }

    render = () => (
        <div className="tab-body">
            <Label>{intl.get("app.language")}</Label>
            <Stack horizontal>
                <Stack.Item>
                    <Dropdown
                        defaultSelectedKey={window.settings.getLocaleSettings()}
                        options={this.languageOptions()}
                        onChanged={option =>
                            this.props.setLanguage(String(option.key))
                        }
                        style={{ width: 200 }}
                    />
                </Stack.Item>
            </Stack>

            <ChoiceGroup
                label={intl.get("app.theme")}
                options={this.themeChoices()}
                onChange={this.onThemeChange}
                selectedKey={this.state.themeSettings}
            />

            <Label>{intl.get("app.fetchInterval")}</Label>
            <Stack horizontal>
                <Stack.Item>
                    <Dropdown
                        defaultSelectedKey={window.settings.getFetchInterval()}
                        options={this.fetchIntervalOptions()}
                        onChanged={this.onFetchIntervalChanged}
                        style={{ width: 200 }}
                    />
                </Stack.Item>
            </Stack>

            <Label>{intl.get("searchEngine.name")}</Label>
            <Stack horizontal>
                <Stack.Item>
                    <Dropdown
                        defaultSelectedKey={window.settings.getSearchEngine()}
                        options={this.searchEngineOptions()}
                        onChanged={this.onSearchEngineChanged}
                        style={{ width: 200 }}
                    />
                </Stack.Item>
            </Stack>

            <Stack horizontal verticalAlign="baseline">
                <Stack.Item grow>
                    <Label>{intl.get("app.enableProxy")}</Label>
                </Stack.Item>
                <Stack.Item>
                    <Toggle
                        checked={this.state.pacStatus}
                        onChange={this.toggleStatus}
                    />
                </Stack.Item>
            </Stack>
            {this.state.pacStatus && (
                <form onSubmit={this.setUrl}>
                    <Stack horizontal>
                        <Stack.Item grow>
                            <TextField
                                required
                                onGetErrorMessage={v =>
                                    urlTest(v.trim())
                                        ? ""
                                        : intl.get("app.badUrl")
                                }
                                placeholder={intl.get("app.pac")}
                                name="pacUrl"
                                onChange={this.handleInputChange}
                                value={this.state.pacUrl}
                            />
                        </Stack.Item>
                        <Stack.Item>
                            <DefaultButton
                                disabled={!urlTest(this.state.pacUrl)}
                                type="sumbit"
                                text={intl.get("app.setPac")}
                            />
                        </Stack.Item>
                    </Stack>
                    <span className="settings-hint up">
                        {intl.get("app.pacHint")}
                    </span>
                </form>
            )}

            <Label>{intl.get("app.cleanup")}</Label>
            <span className="settings-hint" style={{ marginBottom: 12, display: 'block' }}>
                {intl.get("app.cleanupHint")}
            </span>

            {/* 清理类型选择 */}
            <Stack horizontal style={{ marginBottom: 12 }}>
                <Stack.Item grow>
                    <Dropdown
                        placeholder={intl.get("app.cleanupPlaceholder")}
                        options={this.cleanupOptions()}
                        selectedKey={
                            this.state.cleanupType === "time" 
                                ? this.state.deleteDaysIndex 
                                : this.state.cleanupType === "all"
                                    ? "0"
                                    : this.state.cleanupType
                        }
                        onChange={this.cleanupChange}
                    />
                </Stack.Item>
            </Stack>

            {/* 按时间删除设置 */}
            {this.state.cleanupType === "time" && (
                <Stack horizontal style={{ marginBottom: 12 }}>
                    <Stack.Item grow>
                        <Label style={{ margin: 0, fontSize: 13 }}>
                            {intl.get("app.cleanupByTime")}
                        </Label>
                        <span className="settings-hint" style={{ display: 'block', marginTop: 4 }}>
                            {intl.get("app.cleanupByTimeHint")}
                        </span>
                    </Stack.Item>
                    <Stack.Item>
                        <DangerButton
                            disabled={this.state.itemSize === null}
                            text={intl.get("app.confirmDelete")}
                            onClick={this.confirmCleanup}
                        />
                    </Stack.Item>
                </Stack>
            )}

            {/* 删除重复文章设置 */}
            {this.state.cleanupType === "duplicates" && (
                <div>
                    <Stack horizontal tokens={{ childrenGap: 20 }} style={{ marginBottom: 12 }}>
                        <Stack.Item>
                            <Dropdown
                                label={intl.get("app.timeWindow")}
                                selectedKey={this.state.duplicateTimeWindow}
                                options={[
                                    { key: 0, text: intl.get("app.timeWindowAll") },
                                    { key: 6, text: intl.get("app.timeWindow6h") },
                                    { key: 12, text: intl.get("app.timeWindow12h") },
                                    { key: 24, text: intl.get("app.timeWindow24h") },
                                    { key: 72, text: intl.get("app.timeWindow3d") },
                                    { key: 168, text: intl.get("app.timeWindow7d") },
                                    { key: 720, text: intl.get("app.timeWindow30d") },
                                ]}
                                onChange={(_, item) => this.setState({ duplicateTimeWindow: item.key as number })}
                                style={{ width: 150 }}
                            />
                        </Stack.Item>
                        <Stack.Item>
                            <Dropdown
                                label={intl.get("app.similarityThreshold")}
                                selectedKey={this.state.duplicateSimilarityThreshold}
                                options={[
                                    { key: 0.9, text: intl.get("app.similarityThresholdHigh") },
                                    { key: 0.85, text: intl.get("app.similarityThresholdMedium") },
                                    { key: 0.8, text: intl.get("app.similarityThresholdLow") },
                                ]}
                                onChange={(_, item) => this.setState({ duplicateSimilarityThreshold: item.key as number })}
                                style={{ width: 150 }}
                            />
                        </Stack.Item>
                    </Stack>

                    <Stack horizontal tokens={{ childrenGap: 20 }} style={{ marginBottom: 12 }}>
                        <Stack.Item>
                            <Checkbox
                                label={intl.get("app.ByUrl")}
                                checked={this.state.duplicateByUrl}
                                onChange={(_, checked) => this.setState({ duplicateByUrl: !!checked })}
                            />
                            <span className="settings-hint" style={{ display: 'block', marginTop: 4 }}>
                                {intl.get("app.ByUrlHint")}
                            </span>
                        </Stack.Item>
                        <Stack.Item>
                            <Checkbox
                                label={intl.get("app.bySimilarTitle")}
                                checked={this.state.duplicateBySimilarTitle}
                                onChange={(_, checked) => this.setState({ duplicateBySimilarTitle: !!checked })}
                            />
                            <span className="settings-hint" style={{ display: 'block', marginTop: 4 }}>
                                {intl.get("app.bySimilarTitleHint")}
                            </span>
                        </Stack.Item>
                    </Stack>

                    <Stack horizontal style={{ marginBottom: 12 }}>
                        <Stack.Item grow>
                            <Label style={{ margin: 0, fontSize: 13 }}>
                                {intl.get("app.deleteDuplicates")}
                            </Label>
                        </Stack.Item>
                        <Stack.Item>
                            <DangerButton
                                text={intl.get("app.deleteDuplicates")}
                                onClick={this.deleteDuplicateArticles}
                                styles={{ root: { padding: '4px 12px' } }}
                            />
                        </Stack.Item>
                    </Stack>
                </div>
            )}

            {/* 按全部删除设置 */}
            {this.state.cleanupType === "all" && (
                <Stack horizontal style={{ marginBottom: 12 }}>
                    <Stack.Item grow>
                        <Label style={{ margin: 0, fontSize: 13 }}>
                            {intl.get("app.deleteAll")}
                        </Label>
                        <span className="settings-hint" style={{ display: 'block', marginTop: 4 }}>
                            {intl.get("app.deleteAllHint")}
                        </span>
                    </Stack.Item>
                    <Stack.Item>
                        <DangerButton
                            disabled={this.state.itemSize === null}
                            text={intl.get("app.confirmDelete")}
                            onClick={this.confirmCleanup}
                        />
                    </Stack.Item>
                </Stack>
            )}
            <span className="settings-hint up">
                {this.state.itemSize
                    ? intl.get("app.itemSize", { size: this.state.itemSize })
                    : intl.get("app.calculatingSize")}
            </span>
            <Stack horizontal>
                <Stack.Item>
                    <DefaultButton
                        text={intl.get("app.cache")}
                        disabled={
                            this.state.cacheSize === null ||
                            this.state.cacheSize === "0MB"
                        }
                        onClick={this.clearCache}
                    />
                </Stack.Item>
            </Stack>
            <span className="settings-hint up">
                {this.state.cacheSize
                    ? intl.get("app.cacheSize", { size: this.state.cacheSize })
                    : intl.get("app.calculatingSize")}
            </span>

            <Label>{intl.get("app.data")}</Label>
            <Stack horizontal>
                <Stack.Item>
                    <PrimaryButton
                        onClick={exportAll}
                        text={intl.get("app.backup")}
                    />
                </Stack.Item>
                <Stack.Item>
                    <DefaultButton
                        onClick={this.props.importAll}
                        text={intl.get("app.restore")}
                    />
                </Stack.Item>
            </Stack>
        </div>
    )
}

export default AppTab
