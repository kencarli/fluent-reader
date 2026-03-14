/**
 * Automation Service - Manages and executes unified automation rules
 * Combines sync rules and automation rules into one system
 */

import { AutomationRule, AutomationTrigger, AutomationAction, AutomationCondition, IntegrationSettings, SyncRule } from "../schema-types"
import { generateEnhancedDigest } from "./digest-service"
import { pushToDingTalk, pushToWeCom } from "./push-service"

const AUTOMATION_RULES_KEY = "automationRules"
const SYNC_RULES_KEY = "syncRules"  // For migration

/**
 * Load automation rules from storage
 */
export function loadAutomationRules(): AutomationRule[] {
    try {
        const rules = localStorage.getItem(AUTOMATION_RULES_KEY)
        return rules ? JSON.parse(rules) : []
    } catch (error) {
        console.error('Failed to load automation rules:', error)
        return []
    }
}

/**
 * Save automation rules to storage
 */
export function saveAutomationRules(rules: AutomationRule[]): void {
    try {
        localStorage.setItem(AUTOMATION_RULES_KEY, JSON.stringify(rules))
    } catch (error) {
        console.error('Failed to save automation rules:', error)
    }
}

/**
 * Migrate old sync rules to unified automation rules
 */
export function migrateSyncRulesToAutomation(): void {
    try {
        const oldRulesStr = localStorage.getItem(SYNC_RULES_KEY)
        if (!oldRulesStr) return  // No old rules to migrate
        
        const oldRules: SyncRule[] = JSON.parse(oldRulesStr)
        if (oldRules.length === 0) return
        
        const existingRules = loadAutomationRules()
        
        // Convert each sync rule to automation rule
        for (const oldRule of oldRules) {
            // Check if already migrated
            if (existingRules.some(r => r.id === `sync-${oldRule.id}`)) {
                continue
            }
            
            // Convert conditions
            const condition: AutomationCondition = {}
            for (const cond of oldRule.conditions) {
                if (cond.field === 'title' && cond.operator === 'contains') {
                    condition.titleContains = [...(condition.titleContains || []), cond.value]
                } else if (cond.field === 'content' && cond.operator === 'contains') {
                    condition.contentContains = [...(condition.contentContains || []), cond.value]
                } else if (cond.field === 'author' && cond.operator === 'contains') {
                    condition.authorContains = [...(condition.authorContains || []), cond.value]
                } else if (cond.field === 'sourceId') {
                    condition.sourceIds = [...(condition.sourceIds || []), parseInt(cond.value)]
                } else if (cond.field === 'starred' && cond.value === 'true') {
                    condition.starredOnly = true
                }
            }
            
            // Convert action
            const action: AutomationAction = {
                type: oldRule.action.type as any,
                ...(oldRule.action.destination && { [getDestinationKey(oldRule.action.type)]: oldRule.action.destination })
            }
            
            const newRule: AutomationRule = {
                id: `sync-${oldRule.id}`,
                name: oldRule.name,
                enabled: oldRule.enabled !== false,  // Default to enabled
                trigger: { type: oldRule.trigger as any, sourceIds: [] },
                condition,
                actions: [action],
                createdAt: new Date().toISOString()
            }
            
            existingRules.push(newRule)
        }
        
        saveAutomationRules(existingRules)
        
        // Mark as migrated
        localStorage.setItem(SYNC_RULES_KEY + '_migrated', 'true')
        
        console.log('[migrateSyncRulesToAutomation] Migrated', oldRules.length, 'sync rules to automation rules')
    } catch (error) {
        console.error('Failed to migrate sync rules:', error)
    }
}

function getDestinationKey(type: string): string {
    switch (type) {
        case 'sendToObsidian': return 'vaultPath'
        case 'sendToNotion': return 'databaseId'
        case 'sendToOneNote': return 'notebookId'
        case 'sendToEvernote': return 'notebookGuid'
        default: return 'destination'
    }
}

/**
 * Add a new automation rule
 */
export function addAutomationRule(rule: AutomationRule): void {
    const rules = loadAutomationRules()
    rules.push(rule)
    saveAutomationRules(rules)
}

/**
 * Update an existing automation rule
 */
export function updateAutomationRule(rule: AutomationRule): void {
    const rules = loadAutomationRules()
    const index = rules.findIndex(r => r.id === rule.id)
    if (index !== -1) {
        rules[index] = rule
        saveAutomationRules(rules)
    }
}

/**
 * Delete an automation rule
 */
export function deleteAutomationRule(ruleId: string): void {
    const rules = loadAutomationRules()
    const filtered = rules.filter(r => r.id !== ruleId)
    saveAutomationRules(filtered)
}

/**
 * Enable/disable an automation rule
 */
export function toggleAutomationRule(ruleId: string, enabled: boolean): void {
    const rules = loadAutomationRules()
    const rule = rules.find(r => r.id === ruleId)
    if (rule) {
        rule.enabled = enabled
        saveAutomationRules(rules)
    }
}

/**
 * Execute a single automation action
 */
export async function executeAction(
    action: AutomationAction,
    settings: IntegrationSettings,
    briefingContent?: string,
    briefingCoverUrl?: string
): Promise<{ success: boolean; message?: string }> {
    try {
        switch (action.type) {
            case 'pushDingTalk': {
                if (!briefingContent) {
                    return { success: false, message: 'No content to push' }
                }
                return await pushToDingTalk(action.webhook, "Daily AI Briefing", briefingContent, action.keyword)
            }
            
            case 'pushWeCom': {
                if (!briefingContent) {
                    return { success: false, message: 'No content to push' }
                }
                return await pushToWeCom(action.webhook, briefingContent)
            }
            
            case 'aiDigest': {
                // This is handled at the rule level, not action level
                return { success: true, message: 'AI Digest generated' }
            }
            
            case 'sendToObsidian':
            case 'sendToNotion': {
                // TODO: Implement note service integration
                return { success: false, message: 'Not yet implemented' }
            }
            
            case 'multiple': {
                const results = await Promise.all(
                    action.actions.map(a => executeAction(a, settings, briefingContent, briefingCoverUrl))
                )
                const allSuccess = results.every(r => r.success)
                return {
                    success: allSuccess,
                    message: allSuccess ? 'All actions completed' : 'Some actions failed'
                }
            }
            
            default:
                return { success: false, message: `Unknown action type: ${(action as any).type}` }
        }
    } catch (error) {
        console.error('executeAction failed:', error)
        return { success: false, message: error instanceof Error ? error.message : 'Unknown error' }
    }
}

/**
 * Execute an automation rule
 */
export async function executeRule(
    rule: AutomationRule,
    settings: IntegrationSettings,
    feedId?: string
): Promise<{ success: boolean; message?: string; briefing?: any }> {
    try {
        console.log('[executeRule] Executing rule:', rule.name)
        
        let briefingContent: string | undefined
        let briefingCoverUrl: string | undefined
        
        // Execute actions in order
        for (const action of rule.actions) {
            if (action.type === 'aiDigest') {
                // Generate AI digest
                const digestSettings = {
                    ...settings,
                    dalleEnabled: action.dalleEnabled
                }
                
                const result = await generateEnhancedDigest({
                    settings: digestSettings,
                    language: 'zh-CN',
                    topics: action.topics || [],
                    dalleEnabled: action.dalleEnabled,
                    feedId: feedId || rule.condition.feedId
                })
                
                briefingContent = result.content
                briefingCoverUrl = result.coverUrl
                
                console.log('[executeRule] AI Digest generated:', result.articleCount, 'articles')
            } else {
                // Execute other actions (push, etc.)
                const result = await executeAction(action, settings, briefingContent, briefingCoverUrl)
                if (!result.success) {
                    console.error('[executeRule] Action failed:', result.message)
                    return { success: false, message: result.message }
                }
            }
        }
        
        // Update rule execution stats
        rule.lastExecuted = new Date().toISOString()
        rule.executionCount = (rule.executionCount || 0) + 1
        updateAutomationRule(rule)
        
        return {
            success: true,
            message: 'Rule executed successfully',
            briefing: briefingContent ? { content: briefingContent, coverUrl: briefingCoverUrl } : undefined
        }
    } catch (error) {
        console.error('[executeRule] Rule execution failed:', error)
        return { success: false, message: error instanceof Error ? error.message : 'Unknown error' }
    }
}

/**
 * Check if a rule should be triggered by a feed change
 */
export function shouldTriggerOnFeed(rule: AutomationRule, feedId: string): boolean {
    if (!rule.enabled || rule.trigger.type !== 'schedule') {
        return false
    }
    
    const condition = rule.condition
    if (!condition) return true
    
    if (condition.feedId && condition.feedId !== feedId && condition.feedId !== 'ALL') {
        return false
    }
    
    if (condition.sourceIds && condition.sourceIds.length > 0) {
        const currentSourceId = feedId.startsWith('s-') ? parseInt(feedId.substring(2)) : null
        if (currentSourceId && !condition.sourceIds.includes(currentSourceId)) {
            return false
        }
    }
    
    return true
}

/**
 * Start scheduled automation rules
 */
let scheduleCheckInterval: NodeJS.Timeout | null = null

export function startScheduledRules(): void {
    if (scheduleCheckInterval) {
        clearInterval(scheduleCheckInterval)
    }
    
    // Check every minute
    scheduleCheckInterval = setInterval(() => {
        const now = new Date()
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
        const today = now.toDateString()
        
        const rules = loadAutomationRules()
        
        for (const rule of rules) {
            if (!rule.enabled || rule.trigger.type !== 'schedule') continue
            if (!rule.trigger.enabled) continue
            if (rule.trigger.time !== currentTime) continue
            
            // Check if already executed today
            if (rule.lastExecuted) {
                const lastExec = new Date(rule.lastExecuted)
                if (lastExec.toDateString() === today) {
                    continue // Already executed today
                }
            }
            
            // Execute the rule
            const settings = window.settings.getIntegrationSettings()
            executeRule(rule, settings, rule.condition.feedId)
                .then(result => {
                    if (result.success) {
                        console.log('[startScheduledRules] Rule executed:', rule.name)
                    } else {
                        console.error('[startScheduledRules] Rule failed:', rule.name, result.message)
                    }
                })
                .catch(error => {
                    console.error('[startScheduledRules] Rule error:', rule.name, error)
                })
        }
    }, 60000) // Check every minute
    
    console.log('[startScheduledRules] Started checking scheduled rules')
}

/**
 * Stop scheduled rules
 */
export function stopScheduledRules(): void {
    if (scheduleCheckInterval) {
        clearInterval(scheduleCheckInterval)
        scheduleCheckInterval = null
        console.log('[startScheduledRules] Stopped checking scheduled rules')
    }
}

/**
 * Migrate old daily briefing settings to automation rules
 */
export function migrateDailyBriefingToRules(): void {
    const settings = window.settings.getIntegrationSettings()
    
    // Check if migration is needed
    if (settings.digestTime && !settings._migratedToAutomation) {
        const rules = loadAutomationRules()
        
        // Check if rule already exists
        const existingRule = rules.find(r => r.name === '每日 AI 简报')
        if (existingRule) {
            return
        }
        
        // Create new automation rule from old settings
        const actions: AutomationAction[] = []
        
        // Add AI digest action
        const provider = settings.openaiApiKey ? 'openai' :
                        settings.nvidiaApiKey ? 'nvidia' :
                        settings.deepseekApiKey ? 'deepseek' :
                        settings.ollamaApiUrl ? 'ollama' : 'openai'
        
        actions.push({
            type: 'aiDigest',
            provider: provider as any,
            topics: settings.digestTopics ? settings.digestTopics.split(',').map(t => t.trim()) : [],
            dalleEnabled: settings.dalleEnabled
        })
        
        // Add push actions
        if (settings.dingtalkWebhook) {
            // Extract keyword from URL if present
            let webhook = settings.dingtalkWebhook
            let keyword: string | undefined
            if (webhook.includes('&keyword=')) {
                const parts = webhook.split('&keyword=')
                webhook = parts[0]
                keyword = parts[1]
            }
            actions.push({
                type: 'pushDingTalk',
                webhook: webhook,
                keyword: keyword
            })
        }
        
        if (settings.wecomWebhook) {
            actions.push({
                type: 'pushWeCom',
                webhook: settings.wecomWebhook
            })
        }
        
        const newRule: AutomationRule = {
            id: 'rule-' + Date.now(),
            name: '每日 AI 简报',
            enabled: settings.autoPushEnabled !== false,
            trigger: {
                type: 'schedule',
                time: settings.digestTime,
                enabled: true
            },
            condition: {
                feedId: settings.digestFeedId || 'ALL',
                titleContains: settings.digestFilters?.titleContains,
                contentContains: settings.digestFilters?.contentContains,
                articleDateRange: 'all'  // Default to all articles
            },
            actions: actions,
            createdAt: new Date().toISOString()
        }
        
        rules.push(newRule)
        saveAutomationRules(rules)
        
        // Mark as migrated
        window.settings.setIntegrationSettings({
            ...settings,
            _migratedToAutomation: true
        })
        
        console.log('[migrateDailyBriefingToRules] Migrated daily briefing to automation rule')
    }
    
    // Also migrate sync rules
    migrateSyncRulesToAutomation()
}
