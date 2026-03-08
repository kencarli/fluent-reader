import * as React from "react"
import {
    Modal,
    Stack,
    TextField,
    PrimaryButton,
    DefaultButton,
    Label,
    IconButton,
    MessageBar,
    MessageBarType,
} from "@fluentui/react"

type InputModalProps = {
    isOpen: boolean
    title: string
    message: string
    inputLabel?: string
    inputPlaceholder?: string
    confirmText: string
    cancelText: string
    onConfirm: (value: string) => void
    onDismiss: () => void
}

type InputModalState = {
    value: string
    error?: string
}

export default class InputModal extends React.Component<InputModalProps, InputModalState> {
    constructor(props) {
        super(props)
        this.state = {
            value: "",
            error: undefined,
        }
    }

    componentDidUpdate(prevProps: InputModalProps) {
        if (prevProps.isOpen !== this.props.isOpen && this.props.isOpen) {
            this.setState({ value: "", error: undefined })
        }
    }

    handleConfirm = () => {
        if (!this.state.value.trim()) {
            this.setState({ error: "This field is required" })
            return
        }
        this.props.onConfirm(this.state.value.trim())
    }

    render() {
        return (
            <Modal
                isOpen={this.props.isOpen}
                onDismiss={this.props.onDismiss}
                isBlocking={false}
                containerClassName="modal-container"
            >
                <div style={{ padding: 20, minWidth: 400 }}>
                    <Stack horizontal horizontalAlign="space-between">
                        <Label
                            style={{
                                fontSize: 18,
                                fontWeight: 600,
                                marginBottom: 0,
                            }}>
                            {this.props.title}
                        </Label>
                        <IconButton
                            iconProps={{ iconName: "Cancel" }}
                            onClick={this.props.onDismiss}
                            title="Close"
                            ariaLabel="Close"
                        />
                    </Stack>

                    <Stack tokens={{ childrenGap: 16 }} style={{ marginTop: 16 }}>
                        {this.props.message && (
                            <p style={{ fontSize: 14, color: "var(--neutralPrimary)" }}>
                                {this.props.message}
                            </p>
                        )}

                        {this.props.inputLabel && (
                            <TextField
                                label={this.props.inputLabel}
                                value={this.state.value}
                                onChange={(_, newValue) => this.setState({ value: newValue || "", error: undefined })}
                                placeholder={this.props.inputPlaceholder}
                                errorMessage={this.state.error}
                                autoFocus
                            />
                        )}

                        {this.props.children}

                        <Stack
                            horizontal
                            horizontalAlign="end"
                            tokens={{ childrenGap: 8 }}
                            style={{ marginTop: 16 }}
                        >
                            <PrimaryButton
                                text={this.props.confirmText}
                                onClick={this.handleConfirm}
                            />
                            <DefaultButton
                                text={this.props.cancelText}
                                onClick={this.props.onDismiss}
                            />
                        </Stack>
                    </Stack>
                </div>
            </Modal>
        )
    }
}
