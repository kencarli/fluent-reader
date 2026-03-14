/**
 * Service to push content to external collaboration tools via Webhooks.
 */

export interface PushResult {
    success: boolean
    message?: string
}

/**
 * Pushes a markdown message to DingTalk Webhook.
 * @param webhookUrl - DingTalk webhook URL
 * @param title - Message title
 * @param markdown - Markdown content
 * @param keyword - Optional keyword to satisfy DingTalk robot security settings
 */
export async function pushToDingTalk(
    webhookUrl: string,
    title: string,
    markdown: string,
    keyword?: string
): Promise<PushResult> {
    try {
        console.log('[pushToDingTalk] Sending to:', webhookUrl.substring(0, 50) + '...')
        console.log('[pushToDingTalk] Content length:', markdown.length)
        
        // Add keyword at the beginning if provided (DingTalk requires this for security)
        const contentWithKeyword = keyword ? `${keyword}\n\n${markdown}` : markdown
        
        const response = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                msgtype: "markdown",
                markdown: {
                    title: title,
                    text: contentWithKeyword
                }
            })
        })

        console.log('[pushToDingTalk] Response status:', response.status)
        const data = await response.json()
        console.log('[pushToDingTalk] Response data:', data)
        
        if (data.errcode === 0) {
            return { success: true, message: '推送成功' }
        } else {
            return { 
                success: false, 
                message: `钉钉返回错误：${data.errcode} - ${data.errmsg}\n\n解决方案：请在设置中添加关键词，或在 webhook URL 后添加 &keyword=你的关键词`
            }
        }
    } catch (error) {
        console.error('[pushToDingTalk] Error:', error)
        return { success: false, message: `推送失败：${error.message}` }
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
        console.log('[pushToWeCom] Sending to:', webhookUrl.substring(0, 50) + '...')
        console.log('[pushToWeCom] Content length:', markdown.length)
        
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

        console.log('[pushToWeCom] Response status:', response.status)
        const data = await response.json()
        console.log('[pushToWeCom] Response data:', data)
        
        if (data.errcode === 0) {
            return { success: true, message: '推送成功' }
        } else {
            return { success: false, message: `企业微信返回错误：${data.errcode} - ${data.errmsg}` }
        }
    } catch (error) {
        console.error('[pushToWeCom] Error:', error)
        return { success: false, message: `推送失败：${error.message}` }
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
