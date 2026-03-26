import * as React from "react"
import { Icon, Callout, Stack, Label, Separator } from "@fluentui/react"
import { ArticleRating } from "../../scripts/ratings-db"

type RatingBadgeProps = {
    rating: ArticleRating | null
    showDetails?: boolean
}

type RatingBadgeState = {
    showCallout: boolean
}

export default class RatingBadge extends React.Component<RatingBadgeProps, RatingBadgeState> {
    constructor(props) {
        super(props)
        this.state = {
            showCallout: false,
        }
    }

    render() {
        const { rating, showDetails = true } = this.props
        const { showCallout } = this.state
        
        if (!rating) {
            return null
        }

        const score = rating.overallScore
        const stars = this.renderStars(score)
        
        return (
            <>
                <div
                    className="rating-badge"
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '2px 6px',
                        background: this.getScoreColor(score),
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: '#fff',
                        cursor: showDetails ? 'pointer' : 'default',
                    }}
                    onClick={() => showDetails && this.setState({ showCallout: !showCallout })}
                    onMouseEnter={() => showDetails && this.setState({ showCallout: true })}
                    onMouseLeave={() => showDetails && this.setState({ showCallout: false })}
                >
                    <Icon iconName="FavoriteStar" style={{ fontSize: 10 }} />
                    <span>{score.toFixed(1)}</span>
                </div>

                {showDetails && showCallout && rating && (
                    <Callout
                        target={".rating-badge"}
                        onDismiss={() => this.setState({ showCallout: false })}
                        gapSpace={0}
                        calloutMaxWidth={280}
                        styles={{
                            root: {
                                padding: 12,
                            }
                        }}
                    >
                        <Stack tokens={{ childrenGap: 10 }}>
                            <Label style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>
                                📊 AI 评分详情
                            </Label>
                            
                            <Separator style={{ margin: 0 }} />
                            
                            <div>
                                <Label style={{ fontSize: 12, margin: 0, opacity: 0.8 }}>
                                    综合评分
                                </Label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: 20, fontWeight: 700 }}>
                                        {score.toFixed(1)}
                                    </span>
                                    <span style={{ fontSize: 12, opacity: 0.6 }}>/ 5.0</span>
                                </div>
                            </div>

                            <Separator style={{ margin: 0 }} />

                            <div>
                                <Label style={{ fontSize: 11, margin: 0, opacity: 0.8 }}>
                                    🏥 行业相关性
                                </Label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: 2 }}>
                                    {this.renderMiniStars(rating.industryScore)}
                                    <span style={{ fontSize: 11 }}>{rating.industryScore.toFixed(1)}</span>
                                </div>
                                <Label style={{ fontSize: 10, margin: '4px 0 0 0', opacity: 0.6 }}>
                                    {rating.industryName}
                                </Label>
                                {rating.industryReason && (
                                    <Label style={{ fontSize: 10, margin: '4px 0 0 0', opacity: 0.5 }}>
                                        {rating.industryReason}
                                    </Label>
                                )}
                            </div>

                            <div>
                                <Label style={{ fontSize: 11, margin: '8px 0 0 0', opacity: 0.8 }}>
                                    👨‍⚕️ 角色相关性
                                </Label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: 2 }}>
                                    {this.renderMiniStars(rating.roleScore)}
                                    <span style={{ fontSize: 11 }}>{rating.roleScore.toFixed(1)}</span>
                                </div>
                                <Label style={{ fontSize: 10, margin: '4px 0 0 0', opacity: 0.6 }}>
                                    {rating.roleName}
                                </Label>
                                {rating.roleReason && (
                                    <Label style={{ fontSize: 10, margin: '4px 0 0 0', opacity: 0.5 }}>
                                        {rating.roleReason}
                                    </Label>
                                )}
                            </div>

                            <div>
                                <Label style={{ fontSize: 11, margin: '8px 0 0 0', opacity: 0.8 }}>
                                    📝 内容质量
                                </Label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: 2 }}>
                                    {this.renderMiniStars(rating.qualityScore)}
                                    <span style={{ fontSize: 11 }}>{rating.qualityScore.toFixed(1)}</span>
                                </div>
                                {rating.qualityReason && (
                                    <Label style={{ fontSize: 10, margin: '4px 0 0 0', opacity: 0.5 }}>
                                        {rating.qualityReason}
                                    </Label>
                                )}
                            </div>

                            {rating.reason && (
                                <>
                                    <Separator style={{ margin: 0 }} />
                                    <Label style={{ fontSize: 10, margin: 0, opacity: 0.7 }}>
                                        💡 {rating.reason}
                                    </Label>
                                </>
                            )}

                            <Label style={{ fontSize: 9, margin: '4px 0 0 0', opacity: 0.4 }}>
                                模型：{rating.model}
                            </Label>
                        </Stack>
                    </Callout>
                )}
            </>
        )
    }

    renderStars(score: number): JSX.Element {
        const fullStars = Math.floor(score)
        const hasHalf = score % 1 >= 0.5
        const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0)
        
        return (
            <span style={{ letterSpacing: '1px' }}>
                {'⭐'.repeat(fullStars)}
                {hasHalf ? '⭒' : ''}
                {'☆'.repeat(emptyStars)}
            </span>
        )
    }

    renderMiniStars(score: number): JSX.Element {
        const fullStars = Math.floor(score)
        const emptyStars = 5 - fullStars
        
        return (
            <span style={{ fontSize: 10, letterSpacing: '1px' }}>
                {'⭐'.repeat(fullStars)}
                {'☆'.repeat(emptyStars)}
            </span>
        )
    }

    getScoreColor(score: number): string {
        if (score >= 4.5) return '#107c10'  // 绿色 - 高度推荐
        if (score >= 3.5) return '#0078d4'  // 蓝色 - 推荐
        if (score >= 2.5) return '#ff8c00'  // 橙色 - 一般
        return '#d13438'  // 红色 - 不推荐
    }
}
