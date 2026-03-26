import * as React from "react"
import { SyncStatus, RSSItem } from "../../scripts/models/item"
import { Icon } from "@fluentui/react"

type SyncStatusIconProps = {
    item: RSSItem
}

const SyncStatusIcon: React.FunctionComponent<SyncStatusIconProps> = (props) => {
    switch (props.item.syncStatus) {
        case SyncStatus.Syncing:
            return <Icon iconName="Sync" title="Syncing" />
        case SyncStatus.Synced:
            return <Icon iconName="Cloud" title="Synced" />
        case SyncStatus.Failed:
            return <Icon iconName="Error" title="Sync failed" />
        default:
            return null
    }
}

export default SyncStatusIcon
