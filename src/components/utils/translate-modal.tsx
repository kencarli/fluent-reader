import * as React from "react"
import intl from "react-intl-universal"
import {
    Modal,
    Stack,
    PrimaryButton,
    DefaultButton,
    IconButton,
    Spinner,
    SpinnerSize,
    Label,
    MessageBar,
    MessageBarType,
    Dropdown,
    IDropdownOption,
} from "@fluentui/react"
import { RSSItem } from "../../scripts/models/item"
import { translateHtml } from "../../scripts/translate"

type TranslateModalProps = {
    display: boolean
    items: RSSItem[]
    onDismiss: () => void
}

type TranslateModalState = {
    translating: boolean
    translatedCount: number
    totalCount: number
    error: string | null
    success: boolean
}

export default class TranslateModal extends React.Component<
    TranslateModalProps,
    TranslateModalState
> {
    constructor(props) {
        super(props)
        this.state = {
            translating: false,
            translatedCount: 0,
            totalCount: 0,
            error: null,
            success: false,
        }
    }

    translate = async () => {
        if (!this.props.items || this.props.items.length === 0) {
            this.setState({ error: "No articles to translate" })
            return
        }

        this.setState({ 
            translating: true, 
            error: null, 
            success: false,
            translatedCount: 0,
            totalCount: this.props.items.length 
        })

        try {
            let successCount = 0
            for (const item of this.props.items) {
                try {
                    // Translate article content
                    const content = item.content
                    if (content) {
                        const translation = await translateHtml(content)
                        // Store translation (this would need to be persisted to database)
                        console.log(`Translated article: ${item.title}`)
                        successCount++
                        this.setState({ translatedCount: successCount })
                    }
                } catch (error) {
                    console.error(`Failed to translate article ${item.title}:`, error)
                }
                
                // Small delay to avoid overwhelming the translation service
                await new Promise(resolve => setTimeout(resolve, 100))
            }

            this.setState({ 
                translating: false,
                success: successCount > 0,
                translatedCount: successCount
            })
        } catch (e) {
            this.setState({ 
                translating: false, 
                error: e.message 
            })
        }
    }

    onDismiss = () => {
        this.props.onDismiss()
    }

    render() {
        return (
            <Modal
                isOpen={this.props.display}
                onDismiss={this.onDismiss}
                isBlocking={false}
                containerClassName="translate-modal-container"
                styles={{ 
                    main: { 
                        maxWidth: '600px',
                        minHeight: 300, 
                        padding: 24 
                    } 
                }}
            >
                <Stack tokens={{ childrenGap: 20 }}>
                    <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
                        <Label style={{ fontSize: 20, fontWeight: 600 }}>
                            {intl.get("translate.title") || "Translate Articles"}
                        </Label>
                        <IconButton 
                            iconProps={{ iconName: "Cancel" }} 
                            onClick={this.onDismiss} 
                        />
                    </Stack>

                    {!this.state.translating && !this.state.success && (
                        <Stack horizontalAlign="center" tokens={{ childrenGap: 12 }} style={{ padding: "40px 0" }}>
                            <Label>
                                {intl.get("translate.description", { 
                                    count: this.props.items?.length || 0 
                                }) || `Translate ${this.props.items?.length || 0} articles?`}
                            </Label>
                            <PrimaryButton
                                text={intl.get("translate.start") || "Start Translation"}
                                iconProps={{ iconName: "Translate" }}
                                onClick={this.translate}
                                disabled={!this.props.items || this.props.items.length === 0}
                            />
                        </Stack>
                    )}

                    {this.state.translating && (
                        <Stack horizontalAlign="center" tokens={{ childrenGap: 12 }} style={{ padding: "40px 0" }}>
                            <Spinner 
                                size={SpinnerSize.large} 
                                label={`${intl.get("translate.translating") || "Translating..."} ${this.state.translatedCount}/${this.state.totalCount}`} 
                            />
                        </Stack>
                    )}

                    {this.state.error && (
                        <MessageBar 
                            messageBarType={MessageBarType.error} 
                            onDismiss={() => this.setState({ error: null })}
                        >
                            {this.state.error}
                        </MessageBar>
                    )}

                    {this.state.success && (
                        <MessageBar 
                            messageBarType={MessageBarType.success} 
                            onDismiss={() => this.setState({ success: null })}
                        >
                            {intl.get("translate.success", { 
                                count: this.state.translatedCount 
                            }) || `Successfully translated ${this.state.translatedCount} articles!`}
                        </MessageBar>
                    )}

                    {this.state.success && (
                        <Stack horizontal tokens={{ childrenGap: 12 }} horizontalAlign="center">
                            <PrimaryButton
                                text={intl.get("close") || "Close"}
                                onClick={this.onDismiss}
                            />
                        </Stack>
                    )}
                </Stack>
            </Modal>
        )
    }
}
