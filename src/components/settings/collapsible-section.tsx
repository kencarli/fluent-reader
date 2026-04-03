import * as React from "react"
import {
    Stack,
    IconButton,
    Separator,
} from "@fluentui/react"

type CollapsibleSectionProps = {
    title: string
    isCollapsed?: boolean
    onToggle?: (collapsed: boolean) => void
    children: React.ReactNode
    headerContent?: React.ReactNode
}

type CollapsibleSectionState = {
    isCollapsed: boolean
}

export default class CollapsibleSection extends React.Component<
    CollapsibleSectionProps,
    CollapsibleSectionState
> {
    constructor(props) {
        super(props)
        this.state = {
            isCollapsed: props.isCollapsed !== undefined ? props.isCollapsed : true,  // Default to collapsed
        }
    }

    toggleCollapse = () => {
        this.setState(
            prevState => ({ isCollapsed: !prevState.isCollapsed }),
            () => {
                if (this.props.onToggle) {
                    this.props.onToggle(this.state.isCollapsed)
                }
            }
        )
    }

    render() {
        const { title, children, headerContent } = this.props
        const { isCollapsed } = this.state

        return (
            <div className="collapsible-section" style={{ marginBottom: 16 }}>
                <Stack horizontal verticalAlign="center" horizontalAlign="space-between">
                    <Stack horizontal verticalAlign="center">
                        <IconButton
                            iconProps={{
                                iconName: isCollapsed ? "ChevronRight" : "ChevronDown",
                            }}
                            onClick={this.toggleCollapse}
                            styles={{
                                root: {
                                    width: 28,
                                    height: 28,
                                    padding: 0,
                                },
                                icon: {
                                    fontSize: 14,
                                },
                            }}
                            ariaLabel={isCollapsed ? "展开" : "收起"}
                        />
                        <span
                            style={{
                                fontSize: 15,
                                fontWeight: 600,
                                cursor: "pointer",
                                marginLeft: 4,
                            }}
                            onClick={this.toggleCollapse}
                        >
                            {title}
                        </span>
                    </Stack>
                    {headerContent && (
                        <div style={{ marginLeft: 16 }}>{headerContent}</div>
                    )}
                </Stack>
                {!isCollapsed && (
                    <div style={{ paddingLeft: 32, paddingTop: 8, paddingBottom: 8 }}>
                        {children}
                    </div>
                )}
            </div>
        )
    }
}
