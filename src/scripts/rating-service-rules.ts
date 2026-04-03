/**
 * 纯JS文章评分工具类（浏览器兼容，无依赖）
 * 基于关键词匹配、文本分析、结构完整性等规则进行评分
 * 可作为Ollama AI评分的fallback方案
 */

import { ArticleRating } from "./ratings-db"
import { RSSItem } from "./models/item"
import { IntegrationSettings } from "../schema-types"

// ==================== 行业关键词库 ====================
export const INDUSTRY_KEYWORDS: Record<string, string[]> = {
    "hearing-healthcare": [
        "助听器", "hearing aid", "验配", "fitting", "听力损失", "hearing loss",
        "耳鸣", "tinnitus", "声阻抗", "impedance", "耳声发射", "otoacoustic",
        "纯音测听", "pure tone", "言语识别", "speech recognition", "听觉处理",
        "auditory processing", "人工耳蜗", "cochlear implant", "听力学", "audiology",
        "听力保健", "hearing healthcare", "听力筛查", "hearing screening",
        "新生儿听力", "newborn hearing", "听力康复", "hearing rehabilitation"
    ],
    "medical-devices": [
        "医疗器械", "medical device", "BOM", "SOP", "良率", "yield rate",
        "供应链", "supply chain", "合规", "compliance", "FDA", "CE认证",
        "临床试验", "clinical trial", "注册", "registration", "质量管理体系",
        "quality management", "ISO 13485", "风险管理", "risk management",
        "生物相容性", "biocompatibility", "灭菌", "sterilization"
    ],
    "consumer-electronics": [
        "消费电子", "consumer electronics", "智能穿戴", "wearable", "TWS",
        "蓝牙", "Bluetooth", "ANC", "主动降噪", "active noise cancellation",
        "空间音频", "spatial audio", "骨传导", "bone conduction",
        "健康监测", "health monitoring", "传感器", "sensor", "芯片", "chip",
        "SoC", "低功耗", "low power", "电池续航", "battery life"
    ],
    "research-academia": [
        "研究", "research", "论文", "paper", "学术", "academic",
        "实验", "experiment", "数据", "data", "算法", "algorithm",
        "深度学习", "deep learning", "神经网络", "neural network",
        "AI", "机器学习", "machine learning", "综述", "review",
        "meta分析", "meta-analysis", "随机对照", "randomized controlled",
        "同行评审", "peer review", "影响因子", "impact factor"
    ],
    "policy-regulation": [
        "政策", "policy", "法规", "regulation", "标准", "standard",
        "医保", "medical insurance", "报销", "reimbursement", "集采",
        "volume-based procurement", "招标", "bidding", "准入", "market access",
        "监管", "supervision", "审批", "approval", "指南", "guideline",
        "共识", "consensus", "行业报告", "industry report"
    ]
}

// ==================== 角色关键词库 ====================
export const ROLE_KEYWORDS: Record<string, string[]> = {
    "dispenser": [
        "调试", "debug", "fitting", "验配", "声场测试", "sound field",
        "真耳分析", "real ear", "听力评估", "hearing assessment",
        "患者管理", "patient management", "随访", "follow-up",
        "助听器编程", "hearing aid programming", "增益", "gain",
        "压缩", "compression", "反馈抑制", "feedback cancellation",
        "降噪", "noise reduction", "方向性麦克风", "directional microphone"
    ],
    "audiologist": [
        "听力师", "audiologist", "诊断", "diagnosis", "听力图", "audiogram",
        "前庭", "vestibular", "平衡", "balance", "耳鸣管理", "tinnitus management",
        "听觉过敏", "hyperacusis", "助听器效果验证", "hearing aid verification",
        " counseling", "咨询", "康复计划", "rehabilitation plan",
        "儿科听力", "pediatric audiology", "老年听力", "geriatric audiology"
    ],
    "researcher": [
        "研究", "research", "实验设计", "experimental design", "统计分析",
        "statistical analysis", "文献", "literature", "假设", "hypothesis",
        "变量", "variable", "显著性", "significance", "样本量", "sample size",
        "方法论", "methodology", "创新", "innovation", "技术路线",
        "technical route", "专利申请", "patent application"
    ],
    "distributor": [
        "渠道", "channel", "市场", "market", "竞品", "competitor",
        "客户", "customer", "销售", "sales", "经销商", "distributor",
        "代理商", "agent", "售后", "after-sales", "培训", "training",
        "推广", "promotion", "定价", "pricing", "利润率", "profit margin",
        "库存", "inventory", "订单", "order", "市场份额", "market share"
    ],
    "patient": [
        "患者", "patient", "用户", "user", "体验", "experience",
        "舒适度", "comfort", "电池", "battery", "保养", "maintenance",
        "故障", "troubleshooting", "使用指南", "user guide", "价格", "price",
        "保险", "insurance", "补贴", "subsidy", "科普", "popular science",
        "生活方式", "lifestyle", "心理健康", "mental health", "社交", "social"
    ]
}

// ==================== 停用词 ====================
const STOP_WORDS = new Set([
    '的', '了', '在', '是', '我', '有', '和', '就', '都', '而', '及', '与', '这', '那',
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'of', 'for',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
    'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
    'must', 'shall', 'can', 'need', 'it', 'its', 'this', 'that', 'these', 'those',
    'i', 'you', 'he', 'she', 'we', 'they', 'what', 'which', 'who', 'whom',
    'where', 'when', 'why', 'how', 'not', 'no', 'nor', 'so', 'if', 'then', 'than'
])

// ==================== 工具函数 ====================

/**
 * 从HTML中提取纯文本
 */
function extractTextFromHtml(html: string): string {
    if (typeof window !== 'undefined') {
        const parser = new DOMParser()
        const doc = parser.parseFromString(html, 'text/html')
        return doc.body.textContent || ''
    }
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * 分词（简单实现）
 */
function tokenize(text: string): string[] {
    return text
        .toLowerCase()
        .split(/[\s，。、：；""''!?（）【】《》\.\,\!\?\;\:\(\)\[\]\{\}]+/)
        .filter(w => w && w.length > 1 && !STOP_WORDS.has(w))
}

/**
 * 计算关键词匹配分数
 */
function calcKeywordScore(
    text: string,
    selectedKeys: string[],
    keywordDict: Record<string, string[]>,
    maxScore: number
): number {
    if (!selectedKeys || selectedKeys.length === 0) return maxScore * 0.5

    const tokens = tokenize(text)
    const tokenSet = new Set(tokens)

    let totalMatches = 0
    let totalKeywords = 0

    for (const key of selectedKeys) {
        const keywords = keywordDict[key] || []
        totalKeywords += keywords.length

        for (const kw of keywords) {
            const kwLower = kw.toLowerCase()
            // Check if any token contains the keyword or vice versa
            for (const token of tokenSet) {
                if (token.includes(kwLower) || kwLower.includes(token)) {
                    totalMatches++
                    break
                }
            }
        }
    }

    if (totalKeywords === 0) return maxScore * 0.5

    // Calculate coverage ratio and scale to maxScore
    const coverage = totalMatches / Math.min(selectedKeys.length, totalKeywords)
    return Math.min(maxScore, Math.round(coverage * maxScore * 10) / 10)
}

/**
 * 计算信息丰富度分数（0-15分）
 */
function calcRichnessScore(text: string): number {
    const tokens = tokenize(text)
    const uniqueTokens = new Set(tokens)

    // Factor 1: Text length (0-5 points)
    const lengthScore = Math.min(5, text.length / 300)

    // Factor 2: Vocabulary diversity (0-5 points)
    const diversityScore = tokens.length > 0
        ? Math.min(5, (uniqueTokens.size / tokens.length) * 10)
        : 0

    // Factor 3: Professional term density (0-5 points)
    // Count words with length > 6 as potential professional terms
    const professionalTerms = tokens.filter(t => t.length > 6)
    const termDensity = tokens.length > 0
        ? professionalTerms.length / tokens.length
        : 0
    const termScore = Math.min(5, termDensity * 20)

    return Math.round((lengthScore + diversityScore + termScore) * 10) / 10
}

/**
 * 计算结构完整性分数（0-10分）
 */
function calcStructureScore(text: string): number {
    let score = 0

    // Check for title/heading (0-2 points)
    if (text.includes('#') || text.includes('Title:') || text.includes('标题:')) {
        score += 2
    }

    // Check for multiple paragraphs (0-3 points)
    const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 20)
    score += Math.min(3, paragraphs.length * 0.6)

    // Check for data/numbers (0-2 points)
    const numberCount = (text.match(/\d+/g) || []).length
    score += Math.min(2, numberCount * 0.2)

    // Check for conclusion/summary indicators (0-3 points)
    const conclusionMarkers = [
        '结论', '总结', '综上所述', '因此', 'conclusion', 'summary',
        '总之', 'in conclusion', 'in summary', 'therefore'
    ]
    const hasConclusion = conclusionMarkers.some(m =>
        text.toLowerCase().includes(m.toLowerCase())
    )
    if (hasConclusion) score += 3

    return Math.round(Math.min(10, score) * 10) / 10
}

/**
 * 计算重复率扣分（0-10分）
 */
function calcRepeatDeduction(text: string): number {
    const sentences = text
        .split(/[。！？；.!?;]+/)
        .map(s => s.trim())
        .filter(s => s.length > 10)

    if (sentences.length < 3) return 0

    // Simple sentence similarity check
    let repeatCount = 0
    const tokenizedSentences = sentences.map(s => new Set(tokenize(s)))

    for (let i = 0; i < tokenizedSentences.length; i++) {
        for (let j = i + 1; j < tokenizedSentences.length; j++) {
            // Calculate Jaccard similarity
            const intersection = new Set(
                [...tokenizedSentences[i]].filter(x => tokenizedSentences[j].has(x))
            )
            const union = new Set([
                ...tokenizedSentences[i],
                ...tokenizedSentences[j]
            ])
            const similarity = intersection.size / union.size

            if (similarity > 0.7) {
                repeatCount++
            }
        }
    }

    const repeatRate = repeatCount / (sentences.length * (sentences.length - 1) / 2)
    return Math.round(Math.min(10, repeatRate * 30) * 10) / 10
}

// ==================== 主评分函数 ====================

/**
 * 基于规则的文章评分（替代AI评分）
 * @param item 文章对象
 * @param config 配置
 * @returns 评分结果
 */
export function rateArticleByRules(
    item: RSSItem,
    config: IntegrationSettings
): ArticleRating {
    const content = extractTextFromHtml(item.content || '')
    const title = item.title || ''
    const fullText = title + ' ' + content

    const industries = config.ratingIndustries || []
    const roles = config.ratingRoles || []

    // 1. 行业匹配分（35分）
    const industryScoreRaw = calcKeywordScore(
        fullText,
        industries,
        INDUSTRY_KEYWORDS,
        35
    )

    // 2. 角色匹配分（30分）
    const roleScoreRaw = calcKeywordScore(
        fullText,
        roles,
        ROLE_KEYWORDS,
        30
    )

    // 3. 信息丰富度（15分）
    const richnessScore = calcRichnessScore(content)

    // 4. 结构完整性（10分）
    const structureScore = calcStructureScore(content)

    // 5. 重复扣分（-10分）
    const repeatDeduction = calcRepeatDeduction(content)

    // Calculate total score (0-100)
    const totalScore = industryScoreRaw + roleScoreRaw + richnessScore + structureScore - repeatDeduction

    // Convert to 1-5 star rating
    const overallScore = Math.max(1, Math.min(5, Math.round(totalScore / 20 * 10) / 10))

    // Determine primary industry and role
    const primaryIndustry = industries.length > 0
        ? industries[0]
        : 'general'

    const primaryRole = roles.length > 0
        ? roles[0]
        : 'general'

    // Generate reasons
    const industryReason = `行业匹配度: ${Math.round(industryScoreRaw / 35 * 100)}%`
    const roleReason = `角色相关度: ${Math.round(roleScoreRaw / 30 * 100)}%`
    const qualityReason = `内容丰富度: ${richnessScore}/15, 结构分: ${structureScore}/10`
    const reason = `综合评分 ${overallScore}/5，基于行业、角色、内容质量和结构分析`

    return {
        itemId: item._id,
        overallScore,
        industryScore: Math.round(industryScoreRaw / 35 * 5 * 10) / 10,
        industryName: primaryIndustry,
        industryReason,
        roleScore: Math.round(roleScoreRaw / 30 * 5 * 10) / 10,
        roleName: primaryRole,
        roleReason,
        qualityScore: Math.round((richnessScore + structureScore) / 25 * 5 * 10) / 10,
        qualityReason,
        reason,
        ratedAt: Date.now(),
        model: 'rule-based',
    }
}

/**
 * 批量评分
 */
export async function batchRateArticlesByRules(
    items: RSSItem[],
    config: IntegrationSettings,
    onProgress?: (completed: number, total: number, currentRating: ArticleRating | null) => void
): Promise<ArticleRating[]> {
    const ratings: ArticleRating[] = []
    const { saveRating } = await import('./ratings-db')

    for (let i = 0; i < items.length; i++) {
        try {
            const rating = rateArticleByRules(items[i], config)
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

/**
 * 单篇文章评分（带缓存检查）
 */
export async function rateSingleArticleByRules(
    item: RSSItem,
    config: IntegrationSettings
): Promise<ArticleRating> {
    const { saveRating, getRating } = await import('./ratings-db')

    // Check if already rated
    const existing = await getRating(item._id)
    if (existing) {
        return existing
    }

    const rating = rateArticleByRules(item, config)
    await saveRating(rating)

    return rating
}
