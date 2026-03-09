import * as React from "react"
import { Card } from "./card"
import CardInfo from "./info"
import Highlights from "./highlights"
import { SourceTextDirection } from "../../scripts/models/source"

const className = (props: Card.Props) => {
    let cn = ["card", "default-card"]
    if (props.item.snippet && props.item.thumb) cn.push("transform")
    if (props.item.hidden) cn.push("hidden")
    if (props.source.textDir === SourceTextDirection.RTL) cn.push("rtl")
    return cn.join(" ")
}

const DefaultCard: React.FunctionComponent<Card.Props> = props => {
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
        </div>
    )
}

export default DefaultCard
