import * as React from "react"
import { Card } from "./card"
import CardInfo from "./info"
import Highlights from "./highlights"
import { SourceTextDirection } from "../../scripts/models/source"
import RatingFooter from "./rating-footer"
import { ArticleRating } from "../../scripts/ratings-db"

const className = (props: Card.Props) => {
    let cn = ["card", "default-card"]
    if (props.item.snippet && props.item.thumb) cn.push("transform")
    if (props.item.hidden) cn.push("hidden")
    if (props.source.textDir === SourceTextDirection.RTL) cn.push("rtl")
    return cn.join(" ")
}

const DefaultCard: React.FunctionComponent<Card.Props> = props => {
    const [translationVersion, setTranslationVersion] = React.useState(0)
    const [rating, setRating] = React.useState<ArticleRating | null>(null)
    
    // Get translated title from session storage
    const translatedTitle = React.useMemo(() => {
        if (typeof window !== 'undefined' && window.sessionStorage) {
            const translations = JSON.parse(window.sessionStorage.getItem('titleTranslations') || '{}')
            return translations[props.item._id]
        }
        return null
    }, [props.item._id, translationVersion])
    
    // Load rating on mount
    React.useEffect(() => {
        const loadRating = async () => {
            if (typeof window !== 'undefined') {
                try {
                    const { getRating } = await import('../../scripts/ratings-db')
                    const r = await getRating(props.item._id)
                    setRating(r)
                } catch (e) {
                    // Silently fail - rating is optional
                }
            }
        }
        loadRating()
    }, [props.item._id])
    
    // Listen for translation refresh
    React.useEffect(() => {
        const handleRefresh = () => setTranslationVersion(v => v + 1)
        window.addEventListener('translation-updated', handleRefresh)
        return () => window.removeEventListener('translation-updated', handleRefresh)
    }, [])

    return (
        <div
            className={className(props)}
            {...Card.bindEventsToProps(props)}
            data-iid={props.item._id}
            data-is-focusable>
            {props.item.thumb ? (
                <img className="bg" src={props.item.thumb} />
            ) : null}
            <div className="bg"></div>
            {props.item.thumb ? (
                <img className="head" src={props.item.thumb} />
            ) : null}
            <CardInfo source={props.source} item={props.item} />
            <h3 className="title">
                {translatedTitle ? (
                    <span title={props.item.title}>{translatedTitle}</span>
                ) : (
                    <Highlights text={props.item.title} filter={props.filter} title />
                )}
            </h3>
            <p className={"snippet" + (props.item.thumb ? "" : " show")}>
                <Highlights text={props.item.snippet} filter={props.filter} />
            </p>
            {rating && (
                <RatingFooter rating={rating} />
            )}
        </div>
    )
}

export default DefaultCard
