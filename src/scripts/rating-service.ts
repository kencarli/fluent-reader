import { ArticleRating } from "./ratings-db"
import { RSSItem } from "./models/item"
import { IntegrationSettings } from "../schema-types"

// Industry options
export const INDUSTRY_OPTIONS = [
    { key: "hearing-healthcare", label: "听力保健", labelEn: "Hearing Healthcare" },
    { key: "medical-devices", label: "医疗器械", labelEn: "Medical Devices" },
    { key: "consumer-electronics", label: "消费电子", labelEn: "Consumer Electronics" },
    { key: "research-academia", label: "研究/学术", labelEn: "Research/Academia" },
    { key: "policy-regulation", label: "政策法规", labelEn: "Policy/Regulation" },
]

// Role options
export const ROLE_OPTIONS = [
    { key: "dispenser", label: "验配师", labelEn: "Hearing Aid Dispenser" },
    { key: "audiologist", label: "听力师", labelEn: "Audiologist" },
    { key: "researcher", label: "研究人员", labelEn: "Researcher" },
    { key: "distributor", label: "经销商/销售", labelEn: "Distributor/Sales" },
    { key: "patient", label: "患者/消费者", labelEn: "Patient/Consumer" },
]

function extractTextFromHtml(html: string): string {
    if (typeof window !== 'undefined') {
        const parser = new DOMParser()
        const doc = parser.parseFromString(html, 'text/html')
        return doc.body.textContent || ''
    }
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function buildRatingPrompt(
    item: RSSItem,
    content: string,
    config: IntegrationSettings
): string {
    const industries = config.ratingIndustries?.map(i => {
        const opt = INDUSTRY_OPTIONS.find(o => o.key === i)
        return opt ? opt.labelEn : i
    }).join(', ') || 'Hearing Healthcare'
    
    const roles = config.ratingRoles?.map(r => {
        const opt = ROLE_OPTIONS.find(o => o.key === r)
        return opt ? opt.labelEn : r
    }).join(', ') || 'Hearing Aid Dispenser'
    
    const truncatedContent = content.substring(0, 3000)
    
    return `You are an expert content analyst for the hearing healthcare industry.

Rate this article based on the following criteria:

USER PROFILE:
- Industries of interest: ${industries}
- Roles of interest: ${roles}

ARTICLE:
Title: ${item.title}
Content: ${truncatedContent}

RATE ON SCALE 1-5 (1=lowest, 5=highest):

1. Industry Relevance: How relevant is this to hearing healthcare, medical devices, consumer electronics, or research?
2. Role Relevance: How useful is this for hearing aid dispensers, audiologists, researchers, distributors, or patients?
3. Content Quality: Is the information accurate, deep, and timely?

Output ONLY valid JSON (no other text):
{
    "industryScore": 4,
    "industryName": "Hearing Healthcare",
    "industryReason": "Brief explanation in Chinese",
    "roleScore": 3,
    "roleName": "Hearing Aid Dispenser",
    "roleReason": "Brief explanation in Chinese",
    "qualityScore": 4,
    "qualityReason": "Brief explanation in Chinese",
    "overallScore": 3.7,
    "reason": "One sentence summary in Chinese"
}`
}

export async function rateArticle(
    item: RSSItem,
    config: IntegrationSettings
): Promise<ArticleRating> {
    const settings = window.settings.getIntegrationSettings()

    // Determine which LLM provider to use (priority order)
    let provider: 'openai' | 'nvidia' | 'deepseek' | 'ollama' | null = null
    let apiUrl: string | null = null
    let model: string | null = null
    let apiKey: string | null = null

    // Check providers in priority order
    if (settings.nvidiaApiKey) {
        provider = 'nvidia'
        apiUrl = 'https://integrate.api.nvidia.com/v1/chat/completions'
        model = 'meta/llama-3.1-70b-instruct'
        apiKey = settings.nvidiaApiKey
    } else if (settings.deepseekApiKey) {
        provider = 'deepseek'
        apiUrl = 'https://api.deepseek.com/v1/chat/completions'
        model = 'deepseek-chat'
        apiKey = settings.deepseekApiKey
    } else if (settings.openaiApiKey) {
        provider = 'openai'
        apiUrl = 'https://api.openai.com/v1/chat/completions'
        model = 'gpt-4o-mini'
        apiKey = settings.openaiApiKey
    } else if (settings.ollamaApiUrl && (settings.ollamaModel || settings.ratingModel)) {
        provider = 'ollama'
        apiUrl = settings.ollamaApiUrl.replace(/\/$/, '') + '/api/generate'
        // Use ratingModel if specified, otherwise fall back to ollamaModel
        model = settings.ratingModel || settings.ollamaModel
    }

    // Check if any provider is configured
    if (!provider || !apiUrl || !model || (provider !== 'ollama' && !apiKey)) {
        const errorMsg = `No LLM provider configured.

Current config:
- OpenAI API Key: ${settings.openaiApiKey ? '✓' : '✗'}
- NVIDIA API Key: ${settings.nvidiaApiKey ? '✓' : '✗'}
- DeepSeek API Key: ${settings.deepseekApiKey ? '✓' : '✗'}
- Ollama API URL: ${settings.ollamaApiUrl ? '✓' : '✗'}
- Ollama Model: ${settings.ollamaModel ? '✓' : '✗'}

Please configure at least one provider in Settings > Integrations > AI Services`
        throw new Error(errorMsg)
    }

    const content = extractTextFromHtml(item.content)
    const prompt = buildRatingPrompt(item, content, config)

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(apiKey && { 'Authorization': `Bearer ${apiKey}` }),
        },
        body: JSON.stringify(
            provider === 'ollama' ? {
                model: model,
                prompt: prompt,
                stream: false,
                options: {
                    temperature: 0.1,
                    top_p: 0.5,
                    num_predict: 500,
                }
            } : {
                model: model,
                messages: [
                    { role: 'user', content: prompt }
                ],
                temperature: 0.1,
                max_tokens: 500,
            }
        ),
    })

    if (!response.ok) {
        const error = await response.text()
        throw new Error(`Rating API failed (${response.status}): ${error}`)
    }

    const data = await response.json()

    // Parse JSON from response based on provider
    let ratingText: string
    if (provider === 'ollama') {
        ratingText = data.response
    } else {
        ratingText = data.choices?.[0]?.message?.content
    }

    if (!ratingText) {
        console.error('No response content:', data)
        throw new Error('No response from LLM')
    }

    // Parse JSON from response
    let rating: any
    try {
        // Try to extract JSON from response
        const jsonMatch = ratingText.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
            rating = JSON.parse(jsonMatch[0])
        } else {
            rating = JSON.parse(ratingText)
        }
    } catch (e) {
        console.error('Failed to parse rating JSON:', ratingText)
        throw new Error('Failed to parse rating response')
    }

    return {
        itemId: item._id,
        overallScore: Math.min(5, Math.max(1, rating.overallScore || 3)),
        industryScore: Math.min(5, Math.max(1, rating.industryScore || 3)),
        industryName: rating.industryName || 'General',
        industryReason: rating.industryReason || '',
        roleScore: Math.min(5, Math.max(1, rating.roleScore || 3)),
        roleName: rating.roleName || 'General',
        roleReason: rating.roleReason || '',
        qualityScore: Math.min(5, Math.max(1, rating.qualityScore || 3)),
        qualityReason: rating.qualityReason || '',
        reason: rating.reason || '',
        ratedAt: Date.now(),
        model: model!,
    }
}

export async function batchRateArticles(
    items: RSSItem[],
    config: IntegrationSettings,
    onProgress?: (completed: number, total: number, currentRating: ArticleRating | null) => void
): Promise<ArticleRating[]> {
    const ratings: ArticleRating[] = []
    const { saveRating } = await import('./ratings-db')
    
    for (let i = 0; i < items.length; i++) {
        try {
            const rating = await rateArticle(items[i], config)
            await saveRating(rating)
            ratings.push(rating)
            
            if (onProgress) {
                onProgress(i + 1, items.length, rating)
            }
        } catch (error) {
            console.error(`Failed to rate article ${items[i]._id}:`, error)
            if (onProgress) {
                onProgress(i + 1, items.length, null)
            }
        }
    }
    
    return ratings
}

export async function rateSingleArticle(
    item: RSSItem,
    config: IntegrationSettings
): Promise<ArticleRating> {
    const { saveRating, getRating } = await import('./ratings-db')
    
    // Check if already rated
    const existing = await getRating(item._id)
    if (existing) {
        return existing
    }
    
    const rating = await rateArticle(item, config)
    await saveRating(rating)
    
    return rating
}
