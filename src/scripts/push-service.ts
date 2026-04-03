/**
 * Service to push content to external collaboration tools via Webhooks.
 */

export interface PushResult {
    success: boolean
    message?: string
}

/**
 * Pushes a markdown message to DingTalk Webhook.
 */
export async function pushToDingTalk(
    webhookUrl: string,
    title: string,
    markdown: string
): Promise<PushResult> {
    try {
        const response = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                msgtype: "markdown",
                markdown: {
                    title: title,
                    text: markdown
                }
            })
        })

        const data = await response.json()
        if (data.errcode === 0) {
            return { success: true }
        } else {
            return { success: false, message: data.errmsg }
        }
    } catch (error) {
        return { success: false, message: error.message }
    }
}

/**
 * Pushes a markdown message to WeCom (WeChat Work) Webhook.
 */
export async function pushToWeCom(
    webhookUrl: string,
    markdown: string
): Promise<PushResult> {
    try {
        const response = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                msgtype: "markdown",
                markdown: {
                    content: markdown
                }
            })
        })

        const data = await response.json()
        if (data.errcode === 0) {
            return { success: true }
        } else {
            return { success: false, message: data.errmsg }
        }
    } catch (error) {
        return { success: false, message: error.message }
    }
}

/**
 * Generic Webhook push (POST JSON)
 */
export async function pushToGenericWebhook(
    webhookUrl: string,
    payload: any
): Promise<PushResult> {
    try {
        const response = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        })

        if (response.ok) {
            return { success: true }
        } else {
            return { success: false, message: response.statusText }
        }
    } catch (error) {
        return { success: false, message: error.message }
    }
}
