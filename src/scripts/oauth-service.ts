import { IntegrationSettings } from "../schema-types"

// OneNote OAuth Configuration
// IMPORTANT: You need to register your app in Azure Portal to get these credentials
// 1. Go to https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade
// 2. Click "New registration"
// 3. Set redirect URI to "https://login.microsoftonline.com/common/oauth2/nativeclient"
// 4. Add Notes.Read, Notes.ReadWrite permissions under Microsoft Graph
// 5. Copy the Application (client) ID below
// 
// For testing, you can leave this empty and manually enter the access token
const ONENOTE_CLIENT_ID = "" // TODO: Replace with your Azure AD Application (client) ID
const ONENOTE_REDIRECT_URI = "https://login.microsoftonline.com/common/oauth2/nativeclient"
const ONENOTE_SCOPES = ["Notes.Read", "Notes.ReadWrite", "Notes.Create", "offline_access"]

// Evernote OAuth Configuration
// IMPORTANT: You need to get API credentials from Evernote Developer Portal
// 1. Go to https://dev.evernote.com/
// 2. Get an API key (Consumer Key)
// 3. For production, you'll need to request production access
//
// For testing, you can leave this empty and manually enter the developer token
const EVERNOTE_CONSUMER_KEY = "" // TODO: Replace with your Evernote Consumer Key
const EVERNOTE_CONSUMER_SECRET = "" // TODO: Replace with your Evernote Consumer Secret
const EVERNOTE_SANDBOX = true // Set to false for production

export interface OAuthResult {
    success: boolean
    accessToken?: string
    userId?: string
    userName?: string
    error?: string
}

/**
 * OneNote OAuth 2.0 Authorization
 * Uses Microsoft Identity Platform (Azure AD)
 */
export async function authorizeOneNote(): Promise<OAuthResult> {
    // Check if client ID is configured
    if (!ONENOTE_CLIENT_ID || ONENOTE_CLIENT_ID === "") {
        return {
            success: false,
            error: "OneNote OAuth is not configured. Please set ONENOTE_CLIENT_ID in oauth-service.ts"
        }
    }

    try {
        // Build authorization URL
        const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
            `client_id=${ONENOTE_CLIENT_ID}&` +
            `response_type=code&` +
            `redirect_uri=${encodeURIComponent(ONENOTE_REDIRECT_URI)}&` +
            `response_mode=query&` +
            `scope=${encodeURIComponent(ONENOTE_SCOPES.join(' '))}`

        // Open authorization URL in external browser
        window.utils.openExternal(authUrl)

        // Show dialog for user to enter authorization code
        const code = await promptForAuthCode(
            "OneNote Authorization",
            "Please paste the authorization code from the browser:"
        )

        if (!code) {
            return { success: false, error: "Authorization cancelled" }
        }

        // Exchange code for token
        // Note: This requires a backend service for security
        // For demo purposes, we'll use a simplified approach
        const tokenResult = await exchangeOneNoteCode(code)

        if (tokenResult.success) {
            // Get user info
            const userInfo = await getOneNoteUserInfo(tokenResult.accessToken!)
            return {
                success: true,
                accessToken: tokenResult.accessToken,
                userId: userInfo.userId,
                userName: userInfo.userName
            }
        }

        return tokenResult
    } catch (error) {
        console.error("OneNote authorization error:", error)
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error"
        }
    }
}

/**
 * Exchange authorization code for access token
 * In production, this should be done on a backend server
 */
async function exchangeOneNoteCode(code: string): Promise<OAuthResult> {
    try {
        const response = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: new URLSearchParams({
                client_id: ONENOTE_CLIENT_ID,
                scope: ONENOTE_SCOPES.join(' '),
                code: code,
                redirect_uri: ONENOTE_REDIRECT_URI,
                grant_type: "authorization_code"
            })
        })

        if (!response.ok) {
            const error = await response.text()
            throw new Error(`Token exchange failed: ${error}`)
        }

        const data = await response.json()
        return {
            success: true,
            accessToken: data.access_token
        }
    } catch (error) {
        console.error("OneNote token exchange error:", error)
        return {
            success: false,
            error: error instanceof Error ? error.message : "Token exchange failed"
        }
    }
}

/**
 * Get OneNote user information
 */
async function getOneNoteUserInfo(accessToken: string): Promise<{ userId: string, userName: string }> {
    try {
        const response = await fetch("https://graph.microsoft.com/v1.0/me", {
            headers: {
                "Authorization": `Bearer ${accessToken}`
            }
        })

        if (!response.ok) {
            throw new Error("Failed to get user info")
        }

        const data = await response.json()
        return {
            userId: data.id,
            userName: data.displayName || data.userPrincipalName || "Unknown User"
        }
    } catch (error) {
        console.error("OneNote user info error:", error)
        return {
            userId: "unknown",
            userName: "Unknown User"
        }
    }
}

/**
 * Get OneNote notebooks for the authorized user
 */
export async function getOneNoteNotebooks(accessToken: string): Promise<Array<{ id: string, name: string }>> {
    try {
        const response = await fetch("https://graph.microsoft.com/v1.0/me/onenote/notebooks", {
            headers: {
                "Authorization": `Bearer ${accessToken}`
            }
        })

        if (!response.ok) {
            throw new Error("Failed to get notebooks")
        }

        const data = await response.json()
        return data.value.map((nb: any) => ({
            id: nb.id,
            name: nb.displayName
        }))
    } catch (error) {
        console.error("OneNote notebooks error:", error)
        return []
    }
}

/**
 * Evernote OAuth 1.0a Authorization
 * Note: Evernote uses OAuth 1.0a which is more complex
 * For production, consider using a library or backend service
 */
export async function authorizeEvernote(): Promise<OAuthResult> {
    // Check if consumer key is configured
    if (!EVERNOTE_CONSUMER_KEY || EVERNOTE_CONSUMER_KEY === "") {
        return {
            success: false,
            error: "Evernote OAuth is not configured. Please set EVERNOTE_CONSUMER_KEY in oauth-service.ts"
        }
    }

    try {
        // For Evernote, we need to use OAuth 1.0a flow
        // This is a simplified version - production should use proper OAuth library
        
        // Step 1: Get request token
        const requestTokenResult = await getEvernoteRequestToken()
        if (!requestTokenResult.success) {
            return requestTokenResult
        }

        // Step 2: Direct user to authorization page
        const authUrl = EVERNOTE_SANDBOX
            ? `https://sandbox.evernote.com/OAuth.action?oauth_token=${requestTokenResult.requestToken}`
            : `https://www.evernote.com/OAuth.action?oauth_token=${requestTokenResult.requestToken}`

        window.utils.openExternal(authUrl)

        // Step 3: Wait for user to authorize and enter verifier
        const verifier = await promptForAuthCode(
            "Evernote Authorization",
            "After authorizing in the browser, please enter the verifier code (if required):"
        )

        // Step 4: Exchange for access token
        const tokenResult = await exchangeEvernoteToken(
            requestTokenResult.requestToken!,
            requestTokenResult.requestTokenSecret!,
            verifier || ""
        )

        if (tokenResult.success) {
            // Get user info
            const userInfo = await getEvernoteUserInfo(tokenResult.accessToken!)
            return {
                success: true,
                accessToken: tokenResult.accessToken,
                userId: userInfo.userId,
                userName: userInfo.userName
            }
        }

        return tokenResult
    } catch (error) {
        console.error("Evernote authorization error:", error)
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error"
        }
    }
}

/**
 * Get Evernote request token (OAuth 1.0a)
 */
async function getEvernoteRequestToken(): Promise<{ success: boolean, requestToken?: string, requestTokenSecret?: string, error?: string }> {
    // This is a simplified implementation
    // Production should use proper OAuth 1.0a library
    try {
        // For now, return a placeholder
        // In production, implement proper OAuth 1.0a request token exchange
        return {
            success: false,
            error: "Evernote OAuth requires backend support. Please use developer token for now."
        }
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to get request token"
        }
    }
}

/**
 * Exchange Evernote token
 */
async function exchangeEvernoteToken(
    requestToken: string,
    requestTokenSecret: string,
    verifier: string
): Promise<OAuthResult> {
    // Simplified implementation
    return {
        success: false,
        error: "Evernote OAuth requires backend support. Please use developer token for now."
    }
}

/**
 * Get Evernote user information
 */
async function getEvernoteUserInfo(accessToken: string): Promise<{ userId: string, userName: string }> {
    try {
        // Evernote API requires specific endpoint based on region
        const host = EVERNOTE_SANDBOX ? "sandbox.evernote.com" : "www.evernote.com"
        
        // This would require proper EDAM protocol implementation
        // For now, return placeholder
        return {
            userId: "unknown",
            userName: "Evernote User"
        }
    } catch (error) {
        console.error("Evernote user info error:", error)
        return {
            userId: "unknown",
            userName: "Unknown User"
        }
    }
}

/**
 * Get Evernote notebooks
 */
export async function getEvernoteNotebooks(token: string): Promise<Array<{ guid: string, name: string }>> {
    try {
        // This would require proper EDAM protocol implementation
        // For now, return empty array
        console.log("Getting Evernote notebooks...")
        return []
    } catch (error) {
        console.error("Evernote notebooks error:", error)
        return []
    }
}

/**
 * Prompt user for authorization code
 */
async function promptForAuthCode(title: string, message: string): Promise<string> {
    return new Promise((resolve) => {
        // Create a simple prompt dialog
        const result = window.prompt(message)
        resolve(result || "")
    })
}

/**
 * Revoke OneNote authorization
 */
export async function revokeOneNoteAuthorization(accessToken: string): Promise<boolean> {
    try {
        // Microsoft doesn't provide a direct token revocation endpoint for consumer apps
        // Clear local data only
        return true
    } catch (error) {
        console.error("OneNote revoke error:", error)
        return false
    }
}

/**
 * Revoke Evernote authorization
 */
export async function revokeEvernoteAuthorization(token: string): Promise<boolean> {
    try {
        // Evernote doesn't provide a direct token revocation endpoint
        // Clear local data only
        return true
    } catch (error) {
        console.error("Evernote revoke error:", error)
        return false
    }
}
