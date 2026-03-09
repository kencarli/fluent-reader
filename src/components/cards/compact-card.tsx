import * as React from "react"
import { Card } from "./card"
import CardInfo from "./info"
import Time from "../utils/time"
import Highlights from "./highlights"
import { SourceTextDirection } from "../../scripts/models/source"

const className = (props: Card.Props) => {
    let cn = ["card", "compact-card"]
    if (props.item.hidden) cn.push("hidden")
    if (props.source.textDir === SourceTextDirection.RTL) cn.push("rtl")
    return cn.join(" ")
}

const CompactCard: React.FunctionComponent<Card.Props> = props => {
    // Get translated title from session storage
    const translatedTitle = React.useMemo(() => {
        if (typeof window !== 'undefined' && window.sessionStorage) {
            const translations = JSON.parse(window.sessionStorage.getItem('titleTranslations') || '{}')
            return translations[props.item._id]
        }
        return null
    }, [props.item._id])

    return (
        <div
            className={className(props)}
            {...Card.bindEventsToProps(props)}
            data-iid={props.item._id}
            data-is-focusable>
            <CardInfo source={props.source} item={props.item} hideTime />
            <div className="data">
                <span className="title">
                    {translatedTitle ? (
                        <span title={props.item.title}>{translatedTitle}</span>
                    ) : (
                        <Highlights
                            text={props.item.title}
                            filter={props.filter}
                            title
                        />
                    )}
                </span>
                <span className="snippet">
                    <Highlights text={props.item.snippet} filter={props.filter} />
                </span>
            </div>
            <Time date={props.item.date} />
        </div>
    )
}

export default CompactCard
