import * as React from "react"
import intl from "react-intl-universal"
import {
    Stack,
    Label,
    PrimaryButton,
    DefaultButton,
    DetailsList,
    IColumn,
    CommandBar,
    ICommandBarItemProps,
    Selection,
    SelectionMode,
    MarqueeSelection,
    Dropdown,
    TextField
} from "@fluentui/react"
import { SyncRule, SyncRuleCondition } from "../../schema-types"

type SyncRulesTabState = {
    rules: SyncRule[],
    selectedIndices: number[],
    isEditing: boolean,
    editingRule: Partial<SyncRule> | null,
}

class SyncRulesTab extends React.Component<{}, SyncRulesTabState> {
    private selection: Selection;

    constructor(props) {
        super(props);
        const settings = window.settings.getIntegrationSettings();
        this.state = {
            rules: settings.syncRules || [],
            selectedIndices: [],
            isEditing: false,
            editingRule: null,
        };

        this.selection = new Selection({
            onSelectionChanged: () => {
                this.setState({ selectedIndices: this.selection.getSelectedIndices() });
            },
        });
    }

    private getColumns = (): IColumn[] => [
        { key: 'name', name: intl.get("settings.syncRules.ruleName"), fieldName: 'name', minWidth: 100, maxWidth: 200, isResizable: true },
        {
            key: 'action', name: intl.get("settings.syncRules.action"), minWidth: 100, maxWidth: 200, isResizable: true, onRender: (rule: SyncRule) => {
                switch (rule.action.type) {
                    case 'sendToNotion': return intl.get("settings.syncRules.sendToNotion");
                    case 'sendToObsidian': return intl.get("settings.syncRules.sendToObsidian");
                    case 'sendToOneNote': return intl.get("settings.syncRules.sendToOneNote");
                    case 'sendToEvernote': return intl.get("settings.syncRules.sendToEvernote");
                    default: return intl.get("settings.syncRules.unknownAction");
                }
            }
        },
    ];

    private saveRules = (rules: SyncRule[]) => {
        const settings = window.settings.getIntegrationSettings();
        settings.syncRules = rules;
        window.settings.setIntegrationSettings(settings);
        this.setState({ rules });
    }

    private onNewRule = () => {
        this.setState({
            isEditing: true,
            editingRule: {
                id: `rule_${Date.now()}`,
                name: intl.get("settings.syncRules.newRule"),
                conditions: [{ field: "title", operator: "contains", value: "" }],
                action: { type: "sendToNotion" },
            }
        });
    }

    private onEditRule = () => {
        const selectedIndex = this.state.selectedIndices[0];
        const ruleToEdit = this.state.rules[selectedIndex];
        this.setState({ isEditing: true, editingRule: { ...ruleToEdit } });
    }

    private onDeleteRules = () => {
        const newRules = this.state.rules.filter((_, index) => !this.state.selectedIndices.includes(index));
        this.saveRules(newRules);
    }

    private onSaveEdit = () => {
        const rules = [...this.state.rules];
        const ruleIndex = rules.findIndex(r => r.id === this.state.editingRule.id);
        if (ruleIndex > -1) {
            rules[ruleIndex] = this.state.editingRule as SyncRule;
        } else {
            rules.push(this.state.editingRule as SyncRule);
        }
        this.saveRules(rules);
        this.setState({ isEditing: false, editingRule: null });
    }

    private onCancelEdit = () => {
        this.setState({ isEditing: false, editingRule: null });
    }

    private renderEditView = () => {
        const { editingRule } = this.state;
        return (
            <Stack tokens={{ childrenGap: 16 }}>
                <TextField
                    label={intl.get("settings.syncRules.ruleName")}
                    value={editingRule.name}
                    onChange={(e, newValue) => this.setState({ editingRule: { ...editingRule, name: newValue } })}
                />
                <Label>{intl.get("settings.syncRules.conditions")}</Label>
                {editingRule.conditions.map((cond, index) => (
                    <Stack horizontal tokens={{ childrenGap: 8 }} key={index}>
                        <Dropdown
                            options={[
                                { key: 'title', text: intl.get("settings.syncRules.field.title") },
                                { key: 'content', text: intl.get("settings.syncRules.field.content") },
                                { key: 'author', text: intl.get("settings.syncRules.field.author") },
                                { key: 'sourceId', text: intl.get("settings.syncRules.field.sourceId") },
                                { key: 'starred', text: intl.get("settings.syncRules.field.starred") },
                            ]}
                            selectedKey={cond.field}
                            onChange={(e, option) => this.updateCondition(index, 'field', option.key as string)}
                        />
                        <Dropdown
                            options={[
                                { key: 'contains', text: intl.get("settings.syncRules.operator.contains") },
                                { key: 'notContains', text: intl.get("settings.syncRules.operator.notContains") },
                                { key: 'is', text: intl.get("settings.syncRules.operator.is") },
                                { key: 'isNot', text: intl.get("settings.syncRules.operator.isNot") },
                            ]}
                            selectedKey={cond.operator}
                            onChange={(e, option) => this.updateCondition(index, 'operator', option.key as string)}
                        />
                        {cond.field === 'starred' ? (
                            <Dropdown
                                options={[
                                    { key: 'true', text: intl.get("settings.syncRules.true") },
                                    { key: 'false', text: intl.get("settings.syncRules.false") },
                                ]}
                                selectedKey={cond.value}
                                onChange={(e, option) => this.updateCondition(index, 'value', option.key as string)}
                                placeholder={intl.get("settings.syncRules.value")}
                            />
                        ) : (
                            <TextField
                                value={cond.value}
                                onChange={(e, newValue) => this.updateCondition(index, 'value', newValue)}
                                placeholder={intl.get("settings.syncRules.value")}
                            />
                        )}
                    </Stack>
                ))}
                <Label>{intl.get("settings.syncRules.action")}</Label>
                <Dropdown
                    options={[
                        { key: 'sendToNotion', text: intl.get("settings.syncRules.sendToNotion") },
                        { key: 'sendToObsidian', text: intl.get("settings.syncRules.sendToObsidian") },
                        { key: 'sendToOneNote', text: intl.get("settings.syncRules.sendToOneNote") },
                        { key: 'sendToEvernote', text: intl.get("settings.syncRules.sendToEvernote") },
                    ]}
                    selectedKey={editingRule.action.type}
                    onChange={(e, option) => this.setState({ editingRule: { ...editingRule, action: { type: option.key as any } } })}
                />
                <Stack horizontal tokens={{ childrenGap: 8 }}>
                    <PrimaryButton text={intl.get("settings.syncRules.save")} onClick={this.onSaveEdit} />
                    <DefaultButton text={intl.get("settings.syncRules.cancel")} onClick={this.onCancelEdit} />
                </Stack>
            </Stack>
        );
    }

    private updateCondition = (index: number, field: keyof SyncRuleCondition, value: string) => {
        const conditions = [...this.state.editingRule.conditions];
        conditions[index] = { ...conditions[index], [field]: value };
        this.setState({ editingRule: { ...this.state.editingRule, conditions } });
    }

    render() {
        const commandBarItems: ICommandBarItemProps[] = [
            { key: 'new', text: intl.get("settings.syncRules.newRule"), iconProps: { iconName: 'Add' }, onClick: this.onNewRule },
        ];
        const commandBarFarItems: ICommandBarItemProps[] = [
            { key: 'edit', text: intl.get("settings.syncRules.editRule"), iconProps: { iconName: 'Edit' }, disabled: this.state.selectedIndices.length !== 1, onClick: this.onEditRule },
            { key: 'delete', text: intl.get("settings.syncRules.deleteRule"), iconProps: { iconName: 'Delete' }, disabled: this.state.selectedIndices.length === 0, onClick: this.onDeleteRules },
        ];

        return (
            <div className="tab-body">
                {this.state.isEditing ? this.renderEditView() : (
                    <>
                        <CommandBar items={commandBarItems} farItems={commandBarFarItems} />
                        <MarqueeSelection selection={this.selection}>
                            <DetailsList
                                items={this.state.rules}
                                columns={this.getColumns()}
                                selection={this.selection}
                                selectionMode={SelectionMode.multiple}
                                setKey="id"
                            />
                        </MarqueeSelection>
                    </>
                )}
            </div>
        )
    }
}

export default SyncRulesTab;