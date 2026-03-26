import * as React from "react"
import RatingBadge from "./rating-badge"
import { ArticleRating } from "../../scripts/ratings-db"

type RatingFooterProps = {
    rating: ArticleRating | null
    compact?: boolean  // 紧凑模式，用于列表/紧凑视图
}

const RatingFooter: React.FunctionComponent<RatingFooterProps> = ({ rating, compact = false }) => {
    if (!rating) {
        return null
    }

    if (compact) {
        // 紧凑模式：只显示评分徽章和简短信息
        return (
            <div className="rating-footer rating-footer-compact" style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '9px',
                color: 'var(--neutralPrimary)',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                position: 'relative',
                zIndex: 100,
            }}>
                <RatingBadge rating={rating} showDetails={false} />
                <span style={{
                    maxWidth: '80px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    opacity: 0.8,
                }}>{rating.industryName}</span>
            </div>
        )
    }

    // 完整模式：显示所有信息
    return (
        <div className="rating-footer">
            <RatingBadge rating={rating} showDetails={false} />
            <span style={{
                maxWidth: '100px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                flexShrink: 1,
            }}>{rating.industryName}</span>
            <span style={{ opacity: 0.5, flexShrink: 0 }}>·</span>
            <span style={{
                maxWidth: '100px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                flexShrink: 1,
            }}>{rating.roleName}</span>
        </div>
    )
}

export default RatingFooter
