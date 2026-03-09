import * as React from "react"
import { Card } from "./card"
import CardInfo from "./info"
import Highlights from "./highlights"
import { ViewConfigs } from "../../schema-types"
import { SourceTextDirection } from "../../scripts/models/source"

const className = (props: Card.Props) => {
    let cn = ["card", "list-card"]
    if (props.item.hidden) cn.push("hidden")
    if (props.selected) cn.push("selected")
    if (props.viewConfigs & ViewConfigs.FadeRead && props.item.hasRead)
        cn.push("read")
    if (props.source.textDir === SourceTextDirection.RTL) cn.push("rtl")
    return cn.join(" ")
}

const ListCard: React.FunctionComponent<Card.Props> = props => {
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
            {props.item.thumb && props.viewConfigs & ViewConfigs.ShowCover ? (
                <div className="head">
                    <img src={props.item.thumb} />
                </div>
            ) : null}
            <div className="data">
                <CardInfo source={props.source} item={props.item} />
                <h3 className="title">
                    {translatedTitle ? (
                        <span title={props.item.title}>{translatedTitle}</span>
                    ) : (
                        <Highlights
                            text={props.item.title}
                            filter={props.filter}
                            title
                        />
                    )}
                </h3>
                {Boolean(props.viewConfigs & ViewConfigs.ShowSnippet) && (
                    <p className="snippet">
                        <Highlights
                            text={props.item.snippet}
                            filter={props.filter}
                        />
                    </p>
                )}
            </div>
        </div>
    )
}

export default ListCard
