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
        { key: 'name', name: 'Name', fieldName: 'name', minWidth: 100, maxWidth: 200, isResizable: true },
        { key: 'action', name: 'Action', minWidth: 100, maxWidth: 200, isResizable: true, onRender: (rule: SyncRule) => {
            switch (rule.action.type) {
                case 'sendToNotion': return 'Send to Notion';
                case 'sendToObsidian': return 'Send to Obsidian';
                default: return 'Unknown Action';
            }
        }},
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
                name: "New Rule",
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
                    label="Rule Name"
                    value={editingRule.name}
                    onChange={(e, newValue) => this.setState({ editingRule: { ...editingRule, name: newValue } })}
                />
                <Label>Conditions</Label>
                {editingRule.conditions.map((cond, index) => (
                    <Stack horizontal tokens={{ childrenGap: 8 }} key={index}>
                        <Dropdown
                            options={[
                                { key: 'title', text: 'Title' },
                                { key: 'content', text: 'Content' },
                                { key: 'author', text: 'Author' },
                                { key: 'sourceId', text: 'Source ID' },
                            ]}
                            selectedKey={cond.field}
                            onChange={(e, option) => this.updateCondition(index, 'field', option.key as string)}
                        />
                        <Dropdown
                            options={[
                                { key: 'contains', text: 'contains' },
                                { key: 'notContains', text: 'does not contain' },
                                { key: 'is', text: 'is' },
                                { key: 'isNot', text: 'is not' },
                            ]}
                            selectedKey={cond.operator}
                            onChange={(e, option) => this.updateCondition(index, 'operator', option.key as string)}
                        />
                        <TextField
                            value={cond.value}
                            onChange={(e, newValue) => this.updateCondition(index, 'value', newValue)}
                            placeholder="Value"
                        />
                    </Stack>
                ))}
                <Label>Action</Label>
                <Dropdown
                    options={[
                        { key: 'sendToNotion', text: 'Send to Notion' },
                        { key: 'sendToObsidian', text: 'Send to Obsidian' },
                    ]}
                    selectedKey={editingRule.action.type}
                    onChange={(e, option) => this.setState({ editingRule: { ...editingRule, action: { type: option.key as any } } })}
                />
                <Stack horizontal tokens={{ childrenGap: 8 }}>
                    <PrimaryButton text="Save" onClick={this.onSaveEdit} />
                    <DefaultButton text="Cancel" onClick={this.onCancelEdit} />
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
            { key: 'new', text: 'New Rule', iconProps: { iconName: 'Add' }, onClick: this.onNewRule },
        ];
        const commandBarFarItems: ICommandBarItemProps[] = [
            { key: 'edit', text: 'Edit', iconProps: { iconName: 'Edit' }, disabled: this.state.selectedIndices.length !== 1, onClick: this.onEditRule },
            { key: 'delete', text: 'Delete', iconProps: { iconName: 'Delete' }, disabled: this.state.selectedIndices.length === 0, onClick: this.onDeleteRules },
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