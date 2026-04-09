import * as React from "react"
import intl from "react-intl-universal"
import { Icon } from "@fluentui/react/lib/Icon"
import { AppState } from "../scripts/models/app"
import { ProgressIndicator, IObjectWithKey } from "@fluentui/react"
import { getWindowBreakpoint } from "../scripts/utils"
import { WindowStateListenerType } from "../schema-types"

type NavProps = {
    state: AppState
    itemShown: boolean
    menu: () => void
    search: () => void
    markAllRead: () => void
    fetch: () => void
    logs: () => void
    views: () => void
    settings: () => void
    digest: () => void
    translate: () => void
    rating: () => void
    clearTranslateNotification: () => void
}

type NavState = {
    maximized: boolean
}

class Nav extends React.Component<NavProps, NavState> {
    private translateNotificationTimer: number | null = null

    constructor(props) {
        super(props)
        this.setBodyFocusState(window.utils.isFocused())
        this.setBodyFullscreenState(window.utils.isFullscreen())
        window.utils.addWindowStateListener(this.windowStateListener)
        this.state = {
            maximized: window.utils.isMaximized(),
        }
    }

    setBodyFocusState = (focused: boolean) => {
        if (focused) document.body.classList.remove("blur")
        else document.body.classList.add("blur")
    }

    setBodyFullscreenState = (fullscreen: boolean) => {
        if (fullscreen) document.body.classList.remove("not-fullscreen")
        else document.body.classList.add("not-fullscreen")
    }

    windowStateListener = (type: WindowStateListenerType, state: boolean) => {
        switch (type) {
            case WindowStateListenerType.Maximized:
                this.setState({ maximized: state })
                break
            case WindowStateListenerType.Fullscreen:
                this.setBodyFullscreenState(state)
                break
            case WindowStateListenerType.Focused:
                this.setBodyFocusState(state)
                break
        }
    }

    navShortcutsHandler = (e: KeyboardEvent | IObjectWithKey) => {
        if (!this.props.state.settings.display) {
            switch (e.key) {
                case "F1":
                    this.props.menu()
                    break
                case "F2":
                    this.props.search()
                    break
                case "F5":
                    this.fetch()
                    break
                case "F6":
                    this.props.markAllRead()
                    break
                case "F7":
                    if (!this.props.itemShown) this.props.logs()
                    break
                case "F8":
                    if (!this.props.itemShown) this.props.views()
                    break
                case "F9":
                    if (!this.props.itemShown) this.props.settings()
                    break
            }
        }
    }

    componentDidMount() {
        document.addEventListener("keydown", this.navShortcutsHandler)
        if (window.utils.platform === "darwin")
            window.utils.addTouchBarEventsListener(this.navShortcutsHandler)
    }

    componentDidUpdate(prevProps: NavProps) {
        const prevMessage = prevProps.state.translateCompleteMessage
        const currentMessage = this.props.state.translateCompleteMessage

        if (prevMessage !== currentMessage) {
            if (this.translateNotificationTimer) {
                window.clearTimeout(this.translateNotificationTimer)
                this.translateNotificationTimer = null
            }

            if (currentMessage) {
                this.translateNotificationTimer = window.setTimeout(() => {
                    this.props.clearTranslateNotification()
                    this.translateNotificationTimer = null
                }, 5000)
            }
        }
    }

    componentWillUnmount() {
        document.removeEventListener("keydown", this.navShortcutsHandler)
        if (this.translateNotificationTimer) {
            window.clearTimeout(this.translateNotificationTimer)
            this.translateNotificationTimer = null
        }
    }

    minimize = () => {
        window.utils.minimizeWindow()
    }
    maximize = () => {
        window.utils.maximizeWindow()
        this.setState({ maximized: !this.state.maximized })
    }
    close = () => {
        window.utils.closeWindow()
    }

    canFetch = () =>
        this.props.state.sourceInit &&
        this.props.state.feedInit &&
        !this.props.state.syncing &&
        !this.props.state.fetchingItems
    fetching = () => (!this.canFetch() ? " fetching" : "")
    getClassNames = () => {
        const classNames = new Array<string>()
        if (this.props.state.settings.display) classNames.push("hide-btns")
        if (this.props.state.menu) classNames.push("menu-on")
        if (this.props.itemShown) classNames.push("item-on")
        return classNames.join(" ")
    }

    fetch = () => {
        if (this.canFetch()) this.props.fetch()
    }

    views = () => {
        if (this.props.state.contextMenu.event !== "#view-toggle") {
            this.props.views()
        }
    }

    getProgress = () => {
        return this.props.state.fetchingTotal > 0
            ? this.props.state.fetchingProgress / this.props.state.fetchingTotal
            : null
    }
    
    getTranslateProgress = () => {
        const { translateProgress } = this.props.state
        return translateProgress.total > 0
            ? translateProgress.completed / translateProgress.total
            : null
    }

    render() {
        return (
            <nav className={this.getClassNames()}>
                <div className="btn-group">
                    <a
                        className="btn hide-wide"
                        title={intl.get("nav.menu")}
                        onClick={this.props.menu}>
                        <Icon
                            iconName={
                                window.utils.platform === "darwin"
                                    ? "SidePanel"
                                    : "GlobalNavButton"
                            }
                        />
                    </a>
                </div>
                <span
                    className="title"
                    onDoubleClick={() => {
                        // 双击标题栏最大化/还原窗口
                        const utils = window.utils as any
                        if (utils.isTauri && utils.maximizeWindow) {
                            utils.maximizeWindow()
                        }
                    }}
                    onMouseDown={(e) => {
                        // 拖拽窗口（仅在 Tauri 环境下）
                        const utils = window.utils as any
                        if (utils.isTauri && utils.startDraggingWindow && e.buttons === 1) {
                            // 延迟执行，避免与点击冲突
                            const timer = setTimeout(() => {
                                utils.startDraggingWindow()
                            }, 100)
                            const clearTimer = () => {
                                clearTimeout(timer)
                                document.removeEventListener('mouseup', clearTimer)
                            }
                            document.addEventListener('mouseup', clearTimer)
                        }
                    }}
                >{this.props.state.title}</span>
                <div className="btn-group" style={{ float: "right" }}>
                    <a
                        className={"btn" + this.fetching()}
                        onClick={this.fetch}
                        title={intl.get("nav.refresh")}>
                        <Icon iconName="Refresh" />
                    </a>
                    <a
                        className="btn"
                        id="mark-all-toggle"
                        onClick={this.props.markAllRead}
                        title={intl.get("nav.markAllRead")}
                        onMouseDown={e => {
                            if (
                                this.props.state.contextMenu.event ===
                                "#mark-all-toggle"
                            )
                                e.stopPropagation()
                        }}>
                        <Icon iconName="InboxCheck" />
                    </a>
                    <a
                        className="btn"
                        id="log-toggle"
                        title={intl.get("nav.notifications")}
                        onClick={this.props.logs}>
                        {this.props.state.logMenu.notify ? (
                            <Icon iconName="RingerSolid" />
                        ) : (
                            <Icon iconName="Ringer" />
                        )}
                    </a>
                    <a
                        className="btn"
                        id="view-toggle"
                        title={intl.get("nav.view")}
                        onClick={this.props.views}
                        onMouseDown={e => {
                            if (
                                this.props.state.contextMenu.event ===
                                "#view-toggle"
                            )
                                e.stopPropagation()
                        }}>
                        <Icon iconName="View" />
                    </a>
                    <a
                        className="btn"
                        id="digest-toggle"
                        title={intl.get("nav.digest")}
                        onClick={this.props.digest}
                        onMouseDown={e => {
                            if (
                                this.props.state.contextMenu.event ===
                                "#digest-toggle"
                            )
                                e.stopPropagation()
                        }}>
                        <Icon iconName="LightningBolt" />
                    </a>
                    <a
                        className="btn"
                        id="translate-toggle"
                        title={intl.get("nav.translate")}
                        onClick={this.props.translate}
                        onMouseDown={e => {
                            if (
                                this.props.state.contextMenu.event ===
                                "#translate-toggle"
                            )
                                e.stopPropagation()
                        }}>
                        <Icon iconName="Translate" />
                    </a>
                    <a
                        className="btn"
                        id="rating-toggle"
                        title={intl.get("nav.rating")}
                        onClick={this.props.rating}
                        onMouseDown={e => {
                            if (
                                this.props.state.contextMenu.event ===
                                "#rating-toggle"
                            )
                                e.stopPropagation()
                        }}>
                        <Icon iconName="FavoriteStar" />
                    </a>
                    <a
                        className="btn"
                        title={intl.get("nav.settings")}
                        onClick={this.props.settings}>
                        <Icon iconName="Settings" />
                    </a>
                    <span className="seperator"></span>
                    <a
                        className="btn system"
                        title={intl.get("nav.minimize")}
                        onClick={this.minimize}
                        style={{ fontSize: 12 }}>
                        <Icon iconName="Remove" />
                    </a>
                    <a
                        className="btn system"
                        title={intl.get("nav.maximize")}
                        onClick={this.maximize}>
                        {this.state.maximized ? (
                            <Icon
                                iconName="ChromeRestore"
                                style={{ fontSize: 11 }}
                            />
                        ) : (
                            <Icon
                                iconName="Checkbox"
                                style={{ fontSize: 10 }}
                            />
                        )}
                    </a>
                    <a
                        className="btn system close"
                        title={intl.get("close")}
                        onClick={this.close}>
                        <Icon iconName="Cancel" />
                    </a>
                </div>
                {/* 菜单加载进度条 */}
                {!this.canFetch() && (
                    <ProgressIndicator
                        className="progress"
                        percentComplete={this.getProgress()}
                        label={intl.get("nav.loadingSources")}
                    />
                )}
                
                {/* 翻译进度条 */}
                {this.props.state.translateProgress.total > 0 && (
                    <ProgressIndicator
                        className="progress"
                        percentComplete={this.getTranslateProgress()}
                        label={intl.get("nav.translating", {
                            completed: this.props.state.translateProgress.completed,
                            total: this.props.state.translateProgress.total
                        })}
                    />
                )}
                
                {/* 摘要生成进度条 */}
                {this.props.state.digestGenerating && (
                    <ProgressIndicator
                        className="progress"
                        percentComplete={null}
                        label={intl.get("nav.generatingDigest")}
                    />
                )}
                
                {/* 翻译完成通知 */}
                {this.props.state.translateCompleteMessage && (
                    <div
                        className="progress-notification"
                        style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            backgroundColor: '#107c10',
                            color: 'white',
                            padding: '8px 16px',
                            textAlign: 'center',
                            fontSize: '13px',
                            cursor: 'pointer',
                            zIndex: 1001,
                        }}
                        onClick={() => {
                            // 点击清除通知
                            this.props.clearTranslateNotification()
                        }}>
                        ✓ {this.props.state.translateCompleteMessage}
                    </div>
                )}
            </nav>
        )
    }
}

export default Nav
