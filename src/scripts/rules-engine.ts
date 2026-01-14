import { RSSItem } from "./models/item"
import { SyncRule, IntegrationSettings } from "../schema-types"
import { sendToObsidian, sendToNotion } from "./integrations"
import { AppThunk } from "./utils"

function checkCondition(item: RSSItem, condition): boolean {
    const { field, operator, value } = condition;
    const itemValue = item[field] || "";

    switch (operator) {
        case "is":
            return itemValue === value;
        case "isNot":
            return itemValue !== value;
        case "contains":
            return itemValue.includes(value);
        case "notContains":
            return !itemValue.includes(value);
        default:
            return false;
    }
}

export function evaluateRules(item: RSSItem): AppThunk {
    return (dispatch, getState) => {
        const settings: IntegrationSettings = window.settings.getIntegrationSettings();
        if (!settings.syncRules || settings.syncRules.length === 0) {
            return;
        }

        for (const rule of settings.syncRules) {
            const conditionsMet = rule.conditions.every(condition => checkCondition(item, condition));
            if (conditionsMet) {
                switch (rule.action.type) {
                    case "sendToObsidian":
                        dispatch(sendToObsidian(item));
                        break;
                    case "sendToNotion":
                        dispatch(sendToNotion(item));
                        break;
                }
                // Stop after the first matching rule
                return;
            }
        }
    }
}
