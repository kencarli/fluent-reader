import * as React from "react"
import intl from "react-intl-universal"
import {
    Stack,
    Label,
    PrimaryButton,
    DetailsList,
    IColumn,
    Selection,
    SelectionMode,
    MessageBar,
    MessageBarType,
    Toggle,
    Icon,
    TextField,
    Dropdown,
    Separator,
    DefaultButton,
    Link,
    CommandBar,
} from "@fluentui/react"
import { AutomationRule, AutomationTrigger, AutomationCondition, AutomationAction } from "../../schema-types"
import { loadAutomationRules, saveAutomationRules, addAutomationRule, updateAutomationRule, deleteAutomationRule, toggleAutomationRule } from "../../scripts/automation-service"
import { RSSSource } from "../../scripts/models/source"

type SyncRulesTabState = {
    rules: AutomationRule[],
    editingRuleId: string | null,
    editingRule: AutomationRule | null,
    sources: RSSSource[],
    filterSourceId?: number,
}

class SyncRulesTab extends React.Component<{}, SyncRulesTabState> {
    private selection: Selection;
    private _isMounted: boolean = false;

    constructor(props) {
        super(props);
        this.state = {
            rules: [],
            editingRuleId: null,
            editingRule: null,
            sources: [],
            filterSourceId: undefined,
        };

        this.selection = new Selection({
            onSelectionChanged: () => {
                this.forceUpdate();
            },
        });
    }

    componentDidMount() {
        this._isMounted = true;
        this.loadRules();
        this.loadSources();
    }

    componentWillUnmount() {
        this._isMounted = false;
    }

    componentDidUpdate(prevProps: {}, prevState: SyncRulesTabState) {
        // 只在编辑状态改变时重新加载订阅源
        if (prevState.editingRuleId && !this.state.editingRuleId) {
            this.loadSources();
        }
    }

    loadSources = () => {
        if (!this._isMounted) return;
        try {
            const store = (window as any).__STORE__;
            if (!store) return;
            const state = store.getState();
            const sources = state?.sources || {};
            const sourcesList: RSSSource[] = Object.values(sources);
            this.setState({ sources: sourcesList });
        } catch (error) {
            console.error('Failed to load sources:', error);
        }
    }

    loadRules = () => {
        if (!this._isMounted) return;
        try {
            const rules = loadAutomationRules();
            this.setState({ rules });
        } catch (error) {
            console.error('Failed to load rules:', error);
            this.setState({ rules: [] });
        }
    }

    private getColumns = (): IColumn[] => [
        { 
            key: 'enabled', 
            name: '状态', 
            fieldName: 'enabled', 
            minWidth: 50, 
            maxWidth: 60,
            onRender: (item: AutomationRule) => (
                <Toggle
                    checked={item.enabled}
                    onChange={(e, checked) => this.handleToggle(item, checked)}
                    inlineLabel
                    styles={{ root: { margin: 0 } }}
                />
            )
        },
        { 
            key: 'name', 
            name: '规则名称', 
            fieldName: 'name', 
            minWidth: 100, 
            maxWidth: 150,
            styles: { cellName: { fontSize: 13 } }
        },
        {
            key: 'trigger',
            name: '触发',
            fieldName: 'trigger',
            minWidth: 80,
            styles: { cellName: { fontSize: 13 } },
            onRender: (item: AutomationRule) => {
                if (item.trigger.type === 'schedule') {
                    return `⏰ ${(item.trigger as any).time}`;
                } else if (item.trigger.type === 'newArticle') {
                    return '📰 新文章';
                } else if (item.trigger.type === 'onRead') {
                    return '📖 阅读时';
                }
                return '-';
            }
        },
        {
            key: 'actions',
            name: '动作',
            fieldName: 'actions',
            minWidth: 120,
            styles: { cellName: { fontSize: 13 } },
            onRender: (item: AutomationRule) => {
                const actionTexts = item.actions.map(a => {
                    if (a.type === 'aiDigest') return '🤖 AI';
                    if (a.type === 'pushDingTalk') return '📌 钉钉';
                    if (a.type === 'pushWeCom') return '💬 企微';
                    if (a.type === 'sendToObsidian') return '📓 Obs';
                    if (a.type === 'sendToNotion') return '📔 Notion';
                    return a.type;
                });
                return actionTexts.join('→');
            }
        }
    ];

    getCommandBarItems = () => {
        const selectedCount = this.selection.getSelectedCount();
        const selectedRules = selectedCount > 0 
            ? this.selection.getSelectedIndices().map(i => this.state.rules[i])
            : [];

        return [
            {
                key: 'edit',
                text: '编辑',
                iconProps: { iconName: 'Edit' },
                disabled: selectedCount !== 1,
                onClick: () => {
                    if (selectedCount === 1 && selectedRules[0]) {
                        this.handleEdit(selectedRules[0]);
                    }
                }
            },
            {
                key: 'delete',
                text: '删除',
                iconProps: { iconName: 'Delete' },
                disabled: selectedCount === 0,
                onClick: () => {
                    // 如果正在编辑被删除的规则，先取消编辑
                    if (this.state.editingRuleId && selectedRules.some(r => r.id === this.state.editingRuleId)) {
                        this.setState({ editingRuleId: null, editingRule: null });
                    }
                    selectedRules.forEach(rule => {
                        deleteAutomationRule(rule.id);
                    });
                    this.selection.setAllSelected(false);
                    this.loadRules();
                }
            },
        ];
    }

    handleToggle = (rule: AutomationRule, checked?: boolean) => {
        toggleAutomationRule(rule.id, checked || false);
        this.loadRules();
    }

    handleEdit = (rule: AutomationRule) => {
        // 重新加载订阅源
        this.loadSources();
        this.setState({ editingRuleId: rule.id, editingRule: { ...rule } });
    }

    handleCancelEdit = () => {
        this.setState({ editingRuleId: null, editingRule: null });
    }

    handleSaveRule = () => {
        if (!this.state.editingRule) return;
        const rules = loadAutomationRules();
        const index = rules.findIndex(r => r.id === this.state.editingRule!.id);
        if (index !== -1) {
            rules[index] = { ...this.state.editingRule, updatedAt: new Date().toISOString() };
            saveAutomationRules(rules);
        } else {
            addAutomationRule({ ...this.state.editingRule, createdAt: new Date().toISOString() });
        }
        this.setState({ editingRuleId: null, editingRule: null });
        this.loadRules();
    }

    handleDelete = () => {
        const selectedRules = this.selection.getSelectedIndices().map(i => this.state.rules[i]);
        selectedRules.forEach(rule => {
            deleteAutomationRule(rule.id);
        });
        this.selection.setAllSelected(false);
        this.loadRules();
    }

    handleAddNew = () => {
        // 重新加载订阅源
        this.loadSources();
        const newRule: AutomationRule = {
            id: 'rule-' + Date.now(),
            name: '新规则',
            enabled: true,
            trigger: { type: 'onRead' },
            condition: {},
            actions: [],
        };
        this.setState({ editingRuleId: newRule.id, editingRule: newRule });
    }

    clearFilter = () => {
        this.setState({ filterSourceId: undefined });
    }

    render() {
        const { rules, editingRule, editingRuleId, sources, filterSourceId } = this.state;

        if (rules.length === 0 && !editingRuleId) {
            setTimeout(() => this.loadRules(), 0);
        }

        const filteredRules = filterSourceId
            ? rules.filter(r => r.condition.sourceIds?.includes(filterSourceId))
            : rules;

        return (
            <>
                <Stack tokens={{ childrenGap: 16 }} style={{ padding: '0 0 20px 0' }}>
                    <MessageBar messageBarType={MessageBarType.info}>
                        自动化规则可以根据阅读行为、新文章或定时任务自动执行操作，如生成 AI 摘要、推送到钉钉/企业微信、同步到笔记服务等。
                    </MessageBar>

                    {filterSourceId && (
                        <MessageBar messageBarType={MessageBarType.warning}>
                            <Stack horizontal horizontalAlign="space-between" style={{ width: '100%' }}>
                                <span>正在查看订阅源 ID {filterSourceId} 的自动化规则</span>
                                <Link onClick={this.clearFilter}>清除过滤</Link>
                            </Stack>
                        </MessageBar>
                    )}

                    <CommandBar
                        items={this.getCommandBarItems()}
                        farItems={[
                            {
                                key: 'add',
                                text: '+ 新建规则',
                                iconProps: { iconName: 'Add' },
                                onClick: this.handleAddNew,
                            } as any
                        ]}
                    />

                    {filteredRules.length === 0 && !editingRuleId ? (
                        <Stack horizontalAlign="center" tokens={{ childrenGap: 8 }} style={{ padding: '60px 0' }}>
                            <Icon iconName="Robot" style={{ fontSize: 48, color: 'var(--neutralTertiary)' }} />
                            <Label style={{ fontSize: 16 }}>暂无自动化规则</Label>
                            <Label style={{ color: 'var(--neutralSecondary)' }}>
                                点击右上角"+ 新建规则"按钮创建第一个规则
                            </Label>
                        </Stack>
                    ) : (
                        <DetailsList
                            items={editingRuleId ? [editingRule, ...filteredRules.filter(r => r.id !== editingRuleId)] : filteredRules}
                            columns={this.getColumns()}
                            setKey="rules"
                            selection={this.selection}
                            selectionMode={SelectionMode.multiple}
                            layoutMode={1}
                        />
                    )}
                </Stack>

                {editingRule && (
                    <InlineRuleEditor
                        rule={editingRule}
                        sources={sources}
                        onSave={this.handleSaveRule}
                        onCancel={this.handleCancelEdit}
                        onUpdate={(rule) => this.setState({ editingRule: rule })}
                    />
                )}
            </>
        );
    }
}

// ============ Inline Rule Editor Component ============

type InlineRuleEditorProps = {
    rule: AutomationRule;
    sources: RSSSource[];
    onSave: () => void;
    onCancel: () => void;
    onUpdate: (rule: AutomationRule) => void;
}

class InlineRuleEditor extends React.Component<InlineRuleEditorProps> {
    render() {
        const { rule, sources, onSave, onCancel, onUpdate } = this.props;

        return (
            <div style={{
                background: 'var(--neutralLighter)',
                padding: '16px',
                borderRadius: '4px',
                marginTop: '16px',
            }}>
                <Stack tokens={{ childrenGap: 12 }}>
                    <Stack horizontal horizontalAlign="space-between">
                        <Label style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
                            {rule.id.startsWith('sync-') || rule.createdAt ? '编辑规则' : '新建规则'}
                        </Label>
                        <DefaultButton text="取消" onClick={onCancel} styles={{ root: { padding: '4px 12px' } }} />
                    </Stack>

                    <Separator>触发条件</Separator>

                    {/* 第一行：规则名称 + 触发类型 + 执行时间 + 每天执行 */}
                    <Stack horizontal tokens={{ childrenGap: 12 }} style={{ alignItems: 'flex-end' }}>
                        <TextField
                            label="规则名称"
                            value={rule.name}
                            onChange={(e, v) => onUpdate({ ...rule, name: v || '' })}
                            styles={{ root: { width: 150 } }}
                        />
                        <Dropdown
                            label="触发类型"
                            selectedKey={rule.trigger.type}
                            options={[
                                { key: 'onRead', text: '📖 阅读文章时' },
                                { key: 'newArticle', text: '📰 新文章到达时' },
                                { key: 'schedule', text: '⏰ 定时执行' }
                            ]}
                            styles={{ root: { width: 140 } }}
                            onChange={(e, v) => {
                                if (v?.key === 'schedule') {
                                    onUpdate({ ...rule, trigger: { type: 'schedule', time: '09:00', enabled: true } as AutomationTrigger });
                                } else if (v?.key === 'newArticle') {
                                    onUpdate({ ...rule, trigger: { type: 'newArticle' } as AutomationTrigger });
                                } else if (v?.key === 'onRead') {
                                    onUpdate({ ...rule, trigger: { type: 'onRead' } as AutomationTrigger });
                                }
                            }}
                        />

                        {rule.trigger.type === 'schedule' && (
                            <>
                                <TextField
                                    label="执行时间"
                                    type="time"
                                    value={(rule.trigger as any).time || '09:00'}
                                    onChange={(e, v) => onUpdate({ ...rule, trigger: { ...rule.trigger, time: v || '09:00' } as any })}
                                    styles={{ root: { width: 110 } }}
                                />
                                <Toggle
                                    label="每天执行"
                                    checked={(rule.trigger as any).enabled || false}
                                    onChange={(e, v) => onUpdate({ ...rule, trigger: { ...rule.trigger, enabled: v || false } as any })}
                                    styles={{ root: { marginTop: 24, minWidth: 80 } }}
                                />
                            </>
                        )}
                    </Stack>

                    {(rule.trigger.type === 'schedule' || rule.trigger.type === 'newArticle') && (
                        <>
                            <Separator>订阅源</Separator>
                            <Dropdown
                                label="选择订阅源（多选，留空表示所有）"
                                selectedKeys={(rule.condition as any).sourceIds?.map(id => id.toString()) || []}
                                options={sources.map(s => ({ key: s.sid.toString(), text: s.name }))}
                                multiSelect
                                onChange={(_, selectedOption) => {
                                    const currentIds = (rule.condition as any).sourceIds || [];
                                    const selectedId = parseInt(selectedOption!.key as string);
                                    let newSourceIds: number[];
                                    if (currentIds.includes(selectedId)) {
                                        newSourceIds = currentIds.filter(id => id !== selectedId);
                                    } else {
                                        newSourceIds = [...currentIds, selectedId];
                                    }
                                    onUpdate({
                                        ...rule,
                                        condition: { ...rule.condition, sourceIds: newSourceIds }
                                    });
                                }}
                                placeholder="不选则监听所有"
                                styles={{ root: { maxWidth: 400 } }}
                            />
                        </>
                    )}

                    <Separator>过滤条件（可选）</Separator>

                    <Stack horizontal tokens={{ childrenGap: 8 }}>
                        <Dropdown
                            label="过滤类型"
                            selectedKey={(rule.condition as any).filterType || 'title'}
                            options={[
                                { key: 'title', text: '标题' },
                                { key: 'content', text: '内容' }
                            ]}
                            styles={{ root: { width: 100 } }}
                            onChange={(e, v) => onUpdate({
                                ...rule,
                                condition: {
                                    ...rule.condition,
                                    filterType: v?.key as string
                                }
                            })}
                        />
                        <TextField
                            label="关键词（逗号分隔）"
                            placeholder="AI, 机器学习"
                            value={(() => {
                                const filterType = (rule.condition as any).filterType || 'title';
                                return filterType === 'title' 
                                    ? rule.condition.titleContains?.join(', ') || ''
                                    : rule.condition.contentContains?.join(', ') || '';
                            })()}
                            onChange={(e, v) => {
                                const keywords = v ? v.split(',').map(s => s.trim()).filter(s => s) : [];
                                const filterType = (rule.condition as any).filterType || 'title';
                                onUpdate({
                                    ...rule,
                                    condition: {
                                        ...rule.condition,
                                        [filterType === 'title' ? 'titleContains' : 'contentContains']: keywords
                                    }
                                });
                            }}
                            styles={{ root: { flexGrow: 1, maxWidth: 400 } }}
                        />

                        {rule.trigger.type !== 'onRead' && (
                            <Dropdown
                                label="文章日期"
                                selectedKey={(rule.condition as any).articleDateRange || 'all'}
                                options={[
                                    { key: 'all', text: '全部文章' },
                                    { key: '1d', text: '1 天前' },
                                    { key: '3d', text: '3 天前' },
                                    { key: '7d', text: '7 天前' }
                                ]}
                                styles={{ root: { width: 120 } }}
                                onChange={(e, v) => onUpdate({
                                    ...rule,
                                    condition: {
                                        ...rule.condition,
                                        articleDateRange: v?.key as string
                                    }
                                })}
                            />
                        )}
                    </Stack>

                    <Separator>执行动作</Separator>

                    {rule.actions.map((action, index) => (
                        <ActionEditor
                            key={index}
                            action={action}
                            index={index}
                            onUpdate={(a) => {
                                const newActions = [...rule.actions];
                                newActions[index] = a;
                                onUpdate({ ...rule, actions: newActions });
                            }}
                            onRemove={() => {
                                const newActions = rule.actions.filter((_, i) => i !== index);
                                onUpdate({ ...rule, actions: newActions });
                            }}
                        />
                    ))}

                    <Stack horizontal tokens={{ childrenGap: 8 }}>
                        <DefaultButton
                            text="+ 添加动作"
                            iconProps={{ iconName: 'Add' }}
                            menuProps={{
                                items: [
                                    {
                                        key: 'sendToObsidian',
                                        text: '📓 同步到 Obsidian',
                                        onClick: () => {
                                            const newActions = [...rule.actions, { type: 'sendToObsidian' } as AutomationAction];
                                            onUpdate({ ...rule, actions: newActions });
                                        }
                                    },
                                    {
                                        key: 'sendToNotion',
                                        text: '📔 同步到 Notion',
                                        onClick: () => {
                                            const newActions = [...rule.actions, { type: 'sendToNotion' } as AutomationAction];
                                            onUpdate({ ...rule, actions: newActions });
                                        }
                                    },
                                    {
                                        key: 'aiDigest',
                                        text: '🤖 AI 生成摘要',
                                        onClick: () => {
                                            const newActions = [...rule.actions, { type: 'aiDigest' } as AutomationAction];
                                            onUpdate({ ...rule, actions: newActions });
                                        }
                                    },
                                    {
                                        key: 'pushDingTalk',
                                        text: '📌 推送到钉钉',
                                        onClick: () => {
                                            const newActions = [...rule.actions, { type: 'pushDingTalk', webhook: '' } as AutomationAction];
                                            onUpdate({ ...rule, actions: newActions });
                                        }
                                    },
                                    {
                                        key: 'pushWeCom',
                                        text: '💬 推送到企业微信',
                                        onClick: () => {
                                            const newActions = [...rule.actions, { type: 'pushWeCom', webhook: '' } as AutomationAction];
                                            onUpdate({ ...rule, actions: newActions });
                                        }
                                    }
                                ]
                            }}
                        />
                    </Stack>

                    <Stack horizontal tokens={{ childrenGap: 8 }} style={{ marginTop: 16 }}>
                        <PrimaryButton text="保存" onClick={onSave} />
                        <DefaultButton text="取消" onClick={onCancel} />
                    </Stack>
                </Stack>
            </div>
        );
    }
}

// ============ Action Editor Component ============

type ActionEditorProps = {
    action: AutomationAction;
    index: number;
    onUpdate: (action: AutomationAction) => void;
    onRemove: () => void;
}

class ActionEditor extends React.Component<ActionEditorProps> {
    render() {
        const { action, onUpdate, onRemove } = this.props;

        return (
            <Stack tokens={{ childrenGap: 8 }} style={{ padding: 12, background: 'var(--neutralLighterAlt)', borderRadius: 4 }}>
                <Stack horizontal horizontalAlign="space-between">
                    <Label style={{ margin: 0, fontWeight: 600 }}>
                        {action.type === 'aiDigest' && '🤖 AI 生成摘要'}
                        {action.type === 'pushDingTalk' && '📌 推送到钉钉'}
                        {action.type === 'pushWeCom' && '💬 推送到企业微信'}
                        {action.type === 'sendToObsidian' && '📓 同步到 Obsidian'}
                        {action.type === 'sendToNotion' && '📔 同步到 Notion'}
                        {action.type === 'sendToOneNote' && '📕 同步到 OneNote'}
                        {action.type === 'sendToEvernote' && '📒 同步到 Evernote'}
                        {action.type === 'multiple' && '🔀 组合动作'}
                    </Label>
                    <button
                        type="button"
                        onClick={onRemove}
                        title="删除"
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '4px',
                            color: 'var(--neutralSecondaryAlt)',
                        }}
                    >
                        <span style={{ fontSize: '16px' }}>🗑️</span>
                    </button>
                </Stack>
            </Stack>
        );
    }
}

export default SyncRulesTab;
