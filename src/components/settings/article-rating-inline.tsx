import * as React from "react"
import intl from "react-intl-universal"
import {
    Label,
    Stack,
    Toggle,
    Dropdown,
    IDropdownOption,
    Checkbox,
    MessageBar,
    MessageBarType,
} from "@fluentui/react"
import { IntegrationSettings } from "../../schema-types"
import CollapsibleSection from "./collapsible-section"
import { INDUSTRY_OPTIONS, ROLE_OPTIONS } from "../../scripts/rating-service"
import { initRatingsDB, getAllRatings } from "../../scripts/ratings-db"

type ArticleRatingInlineProps = {
    settings: IntegrationSettings
    onChange: (settings: IntegrationSettings) => void
}

type ArticleRatingInlineState = {
    localSettings: IntegrationSettings
    ollamaConnected: boolean
    ratedCount: number
    useRuleEngine: boolean  // Whether using rule-based engine as fallback
}

export default class ArticleRatingInline extends React.Component<
    ArticleRatingInlineProps,
    ArticleRatingInlineState
> {
    constructor(props) {
        super(props)
        this.state = {
            localSettings: { ...props.settings },
            ollamaConnected: false,
            ratedCount: 0,
            useRuleEngine: false,
        }
        this.checkOllamaConnection()
        this.loadRatedCount()
    }

    componentDidUpdate(prevProps: ArticleRatingInlineProps) {
        if (prevProps.settings !== this.props.settings) {
            this.setState({ localSettings: { ...this.props.settings } })
        }
    }

    checkOllamaConnection = async () => {
        const settings = window.settings.getIntegrationSettings()
        if (settings.ollamaApiUrl && settings.ollamaModel) {
            try {
                const response = await fetch(`${settings.ollamaApiUrl.replace(/\/$/, '')}/api/tags`, {
                    method: 'GET',
                })
                if (response.ok) {
                    this.setState({ ollamaConnected: true, useRuleEngine: false })
                } else {
                    this.setState({ ollamaConnected: false, useRuleEngine: true })
                }
            } catch (e) {
                this.setState({ ollamaConnected: false, useRuleEngine: true })
            }
        } else {
            this.setState({ ollamaConnected: false, useRuleEngine: true })
        }
    }

    loadRatedCount = async () => {
        try {
            await initRatingsDB()
            const ratings = await getAllRatings()
            this.setState({ ratedCount: ratings.length })
        } catch (e) {
            console.error('Failed to load rated count:', e)
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
        checked: boolean
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

    handleIndustryChange = (_, option?: IDropdownOption) => {
        if (!option) return
        const key = option.key as string
        this.setState(prevState => {
            const current = prevState.localSettings.ratingIndustries || []
            const updated = current.includes(key)
                ? current.filter(k => k !== key)
                : [...current, key]
            return {
                localSettings: {
                    ...prevState.localSettings,
                    ratingIndustries: updated,
                }
            }
        }, () => {
            this.props.onChange(this.state.localSettings)
        })
    }

    handleRoleChange = (_, option?: IDropdownOption) => {
        if (!option) return
        const key = option.key as string
        this.setState(prevState => {
            const current = prevState.localSettings.ratingRoles || []
            const updated = current.includes(key)
                ? current.filter(k => k !== key)
                : [...current, key]
            return {
                localSettings: {
                    ...prevState.localSettings,
                    ratingRoles: updated,
                }
            }
        }, () => {
            this.props.onChange(this.state.localSettings)
        })
    }

    render() {
        const { localSettings, ollamaConnected, ratedCount, useRuleEngine } = this.state

        const statusIndicators = (
            <Stack horizontal tokens={{ childrenGap: 8 }}>
                {localSettings.ratingEnabled && (
                    <Label style={{ color: "var(--green)", fontSize: 12, margin: 0 }}>
                        ✓ 已启用
                    </Label>
                )}
                {ollamaConnected && (
                    <Label style={{ color: "var(--green)", fontSize: 12, margin: 0 }}>
                        ✓ Ollama AI
                    </Label>
                )}
                {useRuleEngine && localSettings.ratingEnabled && (
                    <Label style={{ color: "var(--neutralSecondary)", fontSize: 12, margin: 0 }}>
                        ⚙️ 规则引擎
                    </Label>
                )}
                {ratedCount > 0 && (
                    <Label style={{ color: "var(--neutralSecondary)", fontSize: 12, margin: 0 }}>
                        已评分：{ratedCount}篇
                    </Label>
                )}
            </Stack>
        )

        return (
            <CollapsibleSection
                title="AI 文章评分"
                headerContent={statusIndicators}
            >
                <Stack tokens={{ childrenGap: 16 }}>
                    {/* 第一行：三个控件并排 - 始终显示 */}
                    <Stack horizontal tokens={{ childrenGap: 16 }} wrap verticalAlign="center">
                        <div style={{ minWidth: 140 }}>
                            <Toggle
                                label="✅ 启用 AI 评分"
                                checked={localSettings.ratingEnabled || false}
                                onChange={(e, checked) => {
                                    this.setState(prevState => ({
                                        localSettings: {
                                            ...prevState.localSettings,
                                            ratingEnabled: checked,
                                        }
                                    }), () => {
                                        this.props.onChange(this.state.localSettings)
                                    })
                                }}
                                inlineLabel
                                styles={{
                                    label: { fontSize: 12, fontWeight: 600 },
                                    text: { fontSize: 12 },
                                    root: { marginTop: 0, alignItems: 'center' },
                                }}
                            />
                        </div>

                        <div style={{ flex: 1 }} />

                        <div style={{ minWidth: 180 }}>
                            <Toggle
                                label="⚙️ 导入新文章时自动评分"
                                checked={localSettings.ratingAutoRate || false}
                                onChange={(e, checked) => {
                                    this.setState(prevState => ({
                                        localSettings: {
                                            ...prevState.localSettings,
                                            ratingAutoRate: checked,
                                        }
                                    }), () => {
                                        this.props.onChange(this.state.localSettings)
                                    })
                                }}
                                inlineLabel
                                styles={{
                                    label: { fontSize: 12, fontWeight: 600 },
                                    text: { fontSize: 12 },
                                    root: { marginTop: 0, alignItems: 'center' },
                                }}
                            />
                        </div>
                    </Stack>

                    {/* 启用时显示更多选项 */}
                    {localSettings.ratingEnabled && (
                        <>
                            <MessageBar messageBarType={MessageBarType.info}>
                                {useRuleEngine
                                    ? "当前使用规则评分引擎（无需AI服务）。基于行业/角色关键词匹配、内容质量、结构完整性进行评分。"
                                    : "AI 会根据您的行业和角色偏好，自动为文章评分（1-5 星），帮助您快速识别重要内容。"}
                            </MessageBar>

                            {/* 第二行：行业和角色并排 */}
                            <Stack horizontal tokens={{ childrenGap: 32 }} wrap>
                                <div style={{ flex: 1, minWidth: 200 }}>
                                    <Label style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                                        🏭 您的行业？（多选）
                                    </Label>
                                    <Stack wrap tokens={{ childrenGap: 4 }}>
                                        {INDUSTRY_OPTIONS.map(opt => (
                                            <Checkbox
                                                key={opt.key}
                                                label={opt.label}
                                                checked={(localSettings.ratingIndustries || []).includes(opt.key)}
                                                onChange={() => this.handleIndustryChange(null, { key: opt.key } as IDropdownOption)}
                                                styles={{
                                                    label: { fontSize: 12 },
                                                    checkbox: { fontSize: 12 },
                                                }}
                                            />
                                        ))}
                                    </Stack>
                                </div>

                                <div style={{ flex: 1, minWidth: 200 }}>
                                    <Label style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                                        👨‍⚕️ 您的工作角色？（多选）
                                    </Label>
                                    <Stack wrap tokens={{ childrenGap: 4 }}>
                                        {ROLE_OPTIONS.map(opt => (
                                            <Checkbox
                                                key={opt.key}
                                                label={opt.label}
                                                checked={(localSettings.ratingRoles || []).includes(opt.key)}
                                                onChange={() => this.handleRoleChange(null, { key: opt.key } as IDropdownOption)}
                                                styles={{
                                                    label: { fontSize: 12 },
                                                    checkbox: { fontSize: 12 },
                                                }}
                                            />
                                        ))}
                                    </Stack>
                                </div>
                            </Stack>

                            <MessageBar messageBarType={MessageBarType.info}>
                                💡 提示：点击导航栏的 ⭐ 按钮，可以快速开始评分或筛选文章。
                            </MessageBar>

                            {!ollamaConnected && useRuleEngine && (
                                <MessageBar messageBarType={MessageBarType.warning}>
                                    ⚙️ Ollama 未连接，已自动切换到规则评分引擎（无需配置，开箱即用）。
                                    如需更精准的AI评分，请配置 Ollama API 地址和模型。
                                </MessageBar>
                            )}

                            {!ollamaConnected && !useRuleEngine && (
                                <MessageBar messageBarType={MessageBarType.warning}>
                                    请先在"AI 服务配置"中配置 Ollama API 地址和模型。
                                </MessageBar>
                            )}
                        </>
                    )}

                    {/* 未启用时显示提示 */}
                    {!localSettings.ratingEnabled && (
                        <MessageBar messageBarType={MessageBarType.info}>
                            启用 AI 文章评分功能后，系统将自动为您的文章打分（1-5 星），帮助您快速识别重要内容。
                            您可以选择使用 AI 评分或规则引擎评分。
                        </MessageBar>
                    )}
                </Stack>
            </CollapsibleSection>
        )
    }
}
