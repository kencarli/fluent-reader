import * as React from "react"
import intl from "react-intl-universal"
import {
    Modal,
    Stack,
    TextField,
    PrimaryButton,
    DefaultButton,
    Label,
    IconButton,
    Link,
    MessageBar,
    MessageBarType,
    Dropdown,
} from "@fluentui/react"
import { IntegrationSettings } from "../../schema-types"
import {
    authorizeOneNote,
    authorizeEvernote,
    getOneNoteNotebooks,
    getEvernoteNotebooks,
    revokeOneNoteAuthorization,
    revokeEvernoteAuthorization,
} from "../../scripts/oauth-service"
import InputModal from "../utils/input-modal"

type CloudNoteServicesModalProps = {
    isOpen: boolean
    settings: IntegrationSettings
    onDismiss: () => void
    onSave: (settings: IntegrationSettings) => void
}

type CloudNoteServicesModalState = {
    tempSettings: IntegrationSettings
    isAuthorizingOneNote: boolean
    isAuthorizingEvernote: boolean
    onenoteNotebooks: { id: string, name: string }[]
    evernoteNotebooks: { guid: string, name: string }[]
    authError: string | null
    isTokenModalOpen: boolean
    tokenModalService: 'onenote' | 'evernote' | null
}

export default class CloudNoteServicesModal extends React.Component<
    CloudNoteServicesModalProps,
    CloudNoteServicesModalState
> {
    constructor(props) {
        super(props)
        // Note: initializeIcons() should only be called once in the app lifecycle
        // It's now called in the main entry point
        this.state = {
            tempSettings: { ...props.settings },
            isAuthorizingOneNote: false,
            isAuthorizingEvernote: false,
            onenoteNotebooks: [],
            evernoteNotebooks: [],
            authError: null,
            isTokenModalOpen: false,
            tokenModalService: null,
        }
    }

    componentDidUpdate(prevProps: CloudNoteServicesModalProps) {
        if (prevProps.isOpen !== this.props.isOpen && this.props.isOpen) {
            this.setState({ tempSettings: { ...this.props.settings } })
        }
    }

    handleInputChange = (
        event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>,
        newValue?: string
    ) => {
        const name = (event.target as HTMLInputElement).name
        this.setState(prevState => ({
            tempSettings: { ...prevState.tempSettings, [name]: newValue },
        }))
    }

    handleSave = () => {
        this.props.onSave(this.state.tempSettings)
        this.props.onDismiss()
    }

    handleOneNoteAuth = async () => {
        this.setState({ isAuthorizingOneNote: true, authError: null })
        
        // Check if OAuth is configured
        if (!this.isOneNoteOAuthConfigured()) {
            // Show manual token input dialog
            this.showManualTokenDialog('onenote')
            this.setState({ isAuthorizingOneNote: false })
            return
        }
        
        try {
            const result = await authorizeOneNote()
            if (result.success) {
                this.setState(prevState => ({
                    tempSettings: {
                        ...prevState.tempSettings,
                        onenoteAccessToken: result.accessToken,
                        onenoteUserId: result.userId,
                        onenoteUserName: result.userName,
                        onenoteAuthorized: true,
                    },
                    isAuthorizingOneNote: false,
                }))
                // Load notebooks
                this.loadOneNoteNotebooks(result.accessToken!)
            } else {
                this.setState({
                    isAuthorizingOneNote: false,
                    authError: `OneNote: ${result.error}`,
                })
            }
        } catch (error) {
            this.setState({
                isAuthorizingOneNote: false,
                authError: `OneNote: ${error instanceof Error ? error.message : 'Unknown error'}`,
            })
        }
    }

    handleEvernoteAuth = async () => {
        this.setState({ isAuthorizingEvernote: true, authError: null })
        
        // Check if OAuth is configured
        if (!this.isEvernoteOAuthConfigured()) {
            // Show manual token input dialog
            this.showManualTokenDialog('evernote')
            this.setState({ isAuthorizingEvernote: false })
            return
        }
        
        try {
            const result = await authorizeEvernote()
            if (result.success) {
                this.setState(prevState => ({
                    tempSettings: {
                        ...prevState.tempSettings,
                        evernoteToken: result.accessToken,
                        evernoteUserName: result.userName,
                        evernoteAuthorized: true,
                    },
                    isAuthorizingEvernote: false,
                }))
                // Load notebooks
                this.loadEvernoteNotebooks(result.accessToken!)
            } else {
                this.setState({
                    isAuthorizingEvernote: false,
                    authError: `Evernote: ${result.error}`,
                })
            }
        } catch (error) {
            this.setState({
                isAuthorizingEvernote: false,
                authError: `Evernote: ${error instanceof Error ? error.message : 'Unknown error'}`,
            })
        }
    }

    isOneNoteOAuthConfigured = (): boolean => {
        // Check if client ID is configured (would be in oauth-service.ts)
        // For now, always return false to show manual input
        return false
    }

    isEvernoteOAuthConfigured = (): boolean => {
        // Check if consumer key is configured
        return false
    }

    showManualTokenDialog = (service: 'onenote' | 'evernote') => {
        const isOneNote = service === 'onenote'
        const serviceName = isOneNote ? 'OneNote' : 'Evernote'
        const tokenName = isOneNote ? 'Access Token' : 'Developer Token'
        const applyUrl = isOneNote 
            ? 'https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade'
            : 'https://dev.evernote.com/doc/articles/dev_tokens.php'
        
        // Show instructions
        window.utils.showMessageBox(
            `${serviceName} ${tokenName}`,
            `OAuth is not configured. You have two options:\n\n` +
            `1. Manual Setup (Recommended):\n` +
            `   - For ${serviceName}, obtain a ${tokenName} manually\n` +
            `   - ${isOneNote ? 'Use Microsoft Graph Explorer or Azure Portal' : 'Visit Evernote Dev Portal to get a developer token'}\n\n` +
            `2. OAuth Setup (Advanced):\n` +
            `   - Register an application at ${applyUrl}\n` +
            `   - Configure the client ID in oauth-service.ts\n\n` +
            `Click OK to enter the ${tokenName} manually, or Cancel to open setup instructions.`,
            "OK",
            "Cancel",
            false
        ).then(result => {
            if (result) {
                // User clicked OK, show token input modal
                this.setState({ 
                    isTokenModalOpen: true,
                    tokenModalService: service,
                })
            } else {
                // User clicked Cancel, show setup instructions
                window.utils.openExternal(applyUrl)
            }
        })
    }

    handleTokenConfirm = (token: string) => {
        const service = this.state.tokenModalService
        if (!service) return
        
        const isOneNote = service === 'onenote'
        const serviceName = isOneNote ? 'OneNote' : 'Evernote'
        const tokenName = isOneNote ? 'Access Token' : 'Developer Token'
        
        this.setState(prevState => ({
            tempSettings: {
                ...prevState.tempSettings,
                ...(isOneNote ? {
                    onenoteAccessToken: token,
                    onenoteAuthorized: true,
                    onenoteUserName: 'Manual Token User',
                } : {
                    evernoteToken: token,
                    evernoteAuthorized: true,
                    evernoteUserName: 'Manual Token User',
                }),
            },
            isTokenModalOpen: false,
            tokenModalService: null,
        }))
        
        window.utils.showMessageBox(
            'Success',
            `${tokenName} saved! You can now use ${serviceName} integration.`,
            'OK',
            '',
            false
        )
    }

    closeTokenModal = () => {
        this.setState({ 
            isTokenModalOpen: false,
            tokenModalService: null,
        })
    }

    loadOneNoteNotebooks = async (accessToken: string) => {
        const notebooks = await getOneNoteNotebooks(accessToken)
        this.setState({ onenoteNotebooks: notebooks })
    }

    loadEvernoteNotebooks = async (token: string) => {
        const notebooks = await getEvernoteNotebooks(token)
        this.setState({ evernoteNotebooks: notebooks })
    }

    handleOneNoteLogout = async () => {
        if (this.state.tempSettings.onenoteAccessToken) {
            await revokeOneNoteAuthorization(this.state.tempSettings.onenoteAccessToken)
        }
        this.setState(prevState => ({
            tempSettings: {
                ...prevState.tempSettings,
                onenoteAccessToken: undefined,
                onenoteUserId: undefined,
                onenoteUserName: undefined,
                onenoteNotebookId: undefined,
                onenoteAuthorized: false,
            },
            onenoteNotebooks: [],
        }))
    }

    handleEvernoteLogout = async () => {
        if (this.state.tempSettings.evernoteToken) {
            await revokeEvernoteAuthorization(this.state.tempSettings.evernoteToken)
        }
        this.setState(prevState => ({
            tempSettings: {
                ...prevState.tempSettings,
                evernoteToken: undefined,
                evernoteUserName: undefined,
                evernoteNotebookGuid: undefined,
                evernoteAuthorized: false,
            },
            evernoteNotebooks: [],
        }))
    }

    render() {
        const { tempSettings } = this.state
        const hasOnenote = !!tempSettings.onenoteAccessToken
        const hasEvernote = !!tempSettings.evernoteToken

        return (
            <>
                <Modal
                    isOpen={this.props.isOpen}
                    onDismiss={this.props.onDismiss}
                    isBlocking={false}
                    containerClassName="modal-container"
                >
                    <div style={{ padding: 20, maxWidth: 700 }}>
                    <Stack horizontal horizontalAlign="space-between">
                        <Label
                            style={{
                                fontSize: 20,
                                fontWeight: 600,
                                marginBottom: 0,
                            }}>
                            {intl.get("settings.cloudNoteServices.name")}
                        </Label>
                        <IconButton
                            iconProps={{ iconName: "Cancel" }}
                            onClick={this.props.onDismiss}
                            title={intl.get("close")}
                            ariaLabel={intl.get("close")}
                        />
                    </Stack>

                    <Stack
                        tokens={{ childrenGap: 16 }}
                        style={{ marginTop: 20 }}>
                        {/* Error Message */}
                        {this.state.authError && (
                            <MessageBar
                                messageBarType={MessageBarType.error}
                                isMultiline={true}
                                onDismiss={() => this.setState({ authError: null })}
                            >
                                {this.state.authError}
                            </MessageBar>
                        )}

                        {/* OneNote Section */}
                        <Label
                            style={{
                                fontSize: 16,
                                fontWeight: 600,
                                marginTop: 8,
                            }}>
                            {intl.get("settings.cloudNoteServices.onenoteIntegration")}
                        </Label>

                        {hasOnenote ? (
                            <Stack tokens={{ childrenGap: 8 }}>
                                <MessageBar messageBarType={MessageBarType.success}>
                                    {intl.get("settings.cloudNoteServices.onenoteLoggedIn")} {this.state.tempSettings.onenoteUserName}
                                </MessageBar>
                                <Stack horizontal tokens={{ childrenGap: 8 }}>
                                    <PrimaryButton
                                        text={intl.get("settings.cloudNoteServices.refreshNotebooks")}
                                        onClick={() => this.loadOneNoteNotebooks(tempSettings.onenoteAccessToken!)}
                                        disabled={this.state.isAuthorizingOneNote}
                                    />
                                    <DefaultButton
                                        text={intl.get("settings.cloudNoteServices.logout")}
                                        onClick={this.handleOneNoteLogout}
                                        disabled={this.state.isAuthorizingOneNote}
                                    />
                                </Stack>
                                {this.state.onenoteNotebooks.length > 0 && (
                                    <Dropdown
                                        label={intl.get("settings.cloudNoteServices.onenoteNotebookId")}
                                        selectedKey={tempSettings.onenoteNotebookId || ""}
                                        options={this.state.onenoteNotebooks.map(nb => ({
                                            key: nb.id,
                                            text: nb.name,
                                        }))}
                                        onChange={(e, option) => this.handleInputChange(
                                            { target: { name: "onenoteNotebookId" } } as any,
                                            option?.key as string
                                        )}
                                    />
                                )}
                            </Stack>
                        ) : (
                            <Stack tokens={{ childrenGap: 8 }}>
                                <p style={{ fontSize: 14, color: "var(--neutralSecondary)" }}>
                                    {intl.get("settings.cloudNoteServices.onenoteLoginDescription")}
                                </p>
                                <PrimaryButton
                                    text={intl.get("settings.cloudNoteServices.loginWithMicrosoft")}
                                    onClick={this.handleOneNoteAuth}
                                    disabled={this.state.isAuthorizingOneNote}
                                    iconProps={{ iconName: "OfficeLogo" }}
                                />
                                {this.state.isAuthorizingOneNote && (
                                    <Label>{intl.get("settings.cloudNoteServices.authorizing")}...</Label>
                                )}
                            </Stack>
                        )}

                        {/* Evernote Section */}
                        <Label
                            style={{
                                fontSize: 16,
                                fontWeight: 600,
                                marginTop: 16,
                            }}>
                            {intl.get("settings.cloudNoteServices.evernoteIntegration")}
                        </Label>

                        {hasEvernote ? (
                            <Stack tokens={{ childrenGap: 8 }}>
                                <MessageBar messageBarType={MessageBarType.success}>
                                    {intl.get("settings.cloudNoteServices.evernoteLoggedIn")} {this.state.tempSettings.evernoteUserName}
                                </MessageBar>
                                <Stack horizontal tokens={{ childrenGap: 8 }}>
                                    <PrimaryButton
                                        text={intl.get("settings.cloudNoteServices.refreshNotebooks")}
                                        onClick={() => this.loadEvernoteNotebooks(tempSettings.evernoteToken!)}
                                        disabled={this.state.isAuthorizingEvernote}
                                    />
                                    <DefaultButton
                                        text={intl.get("settings.cloudNoteServices.logout")}
                                        onClick={this.handleEvernoteLogout}
                                        disabled={this.state.isAuthorizingEvernote}
                                    />
                                </Stack>
                                {this.state.evernoteNotebooks.length > 0 && (
                                    <Dropdown
                                        label={intl.get("settings.cloudNoteServices.evernoteNotebookGuid")}
                                        selectedKey={tempSettings.evernoteNotebookGuid || ""}
                                        options={this.state.evernoteNotebooks.map(nb => ({
                                            key: nb.guid,
                                            text: nb.name,
                                        }))}
                                        onChange={(e, option) => this.handleInputChange(
                                            { target: { name: "evernoteNotebookGuid" } } as any,
                                            option?.key as string
                                        )}
                                    />
                                )}
                            </Stack>
                        ) : (
                            <Stack tokens={{ childrenGap: 8 }}>
                                <p style={{ fontSize: 14, color: "var(--neutralSecondary)" }}>
                                    {intl.get("settings.cloudNoteServices.evernoteLoginDescription")}
                                </p>
                                <PrimaryButton
                                    text={intl.get("settings.cloudNoteServices.loginWithEvernote")}
                                    onClick={this.handleEvernoteAuth}
                                    disabled={this.state.isAuthorizingEvernote}
                                    iconProps={{ iconName: "FileImage" }}
                                />
                                {this.state.isAuthorizingEvernote && (
                                    <Label>{intl.get("settings.cloudNoteServices.authorizing")}...</Label>
                                )}
                            </Stack>
                        )}

                        <Stack
                            horizontal
                            tokens={{ childrenGap: 8 }}
                            style={{ marginTop: 16 }}>
                            <PrimaryButton
                                text={intl.get("confirm")}
                                onClick={this.handleSave}
                            />
                            <DefaultButton
                                text={intl.get("cancel")}
                                onClick={this.props.onDismiss}
                            />
                        </Stack>

                        {(hasOnenote || hasEvernote) && (
                            <Stack
                                horizontal
                                tokens={{ childrenGap: 16 }}
                                style={{ marginTop: 8 }}>
                                {hasOnenote && (
                                    <Label
                                        style={{
                                            color: "var(--green)",
                                            fontSize: 12,
                                        }}>
                                        ✓ OneNote
                                    </Label>
                                )}
                                {hasEvernote && (
                                    <Label
                                        style={{
                                            color: "var(--green)",
                                            fontSize: 12,
                                        }}>
                                        ✓ Evernote
                                    </Label>
                                )}
                            </Stack>
                        )}
                    </Stack>
                </div>
            </Modal>

            <InputModal
                isOpen={this.state.isTokenModalOpen}
                title={this.state.tokenModalService === 'onenote' ? 'OneNote Access Token' : 'Evernote Developer Token'}
                message={`Please enter your ${this.state.tokenModalService === 'onenote' ? 'OneNote Access Token' : 'Evernote Developer Token'}. You can obtain this from the developer portal.`}
                inputLabel="Token"
                inputPlaceholder="Enter your token here..."
                confirmText="Save"
                cancelText="Cancel"
                onConfirm={this.handleTokenConfirm}
                onDismiss={this.closeTokenModal}
            />
            </>
        )
    }
}
