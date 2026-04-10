import type { AutomationRule, RuleCondition, RuleAction, RuleExecutionResult } from "../types";
import { apiFetch } from "./core";

export async function fetchAutomationRules(projectId: string): Promise<AutomationRule[]> {
  const res = await apiFetch<{ rules: AutomationRule[] }>(`/projects/${projectId}/automation-rules`);
  return res.rules;
}

export async function createAutomationRule(
  projectId: string,
  data: { name: string; conditions: RuleCondition[]; action: RuleAction; priority?: number; isActive?: boolean },
): Promise<AutomationRule> {
  const res = await apiFetch<{ rule: AutomationRule }>(`/projects/${projectId}/automation-rules`, {
    method: "POST",
    body: JSON.stringify(data),
  });
  return res.rule;
}

export async function updateAutomationRule(
  projectId: string,
  ruleId: string,
  data: Partial<{ name: string; conditions: RuleCondition[]; action: RuleAction; priority: number; isActive: boolean }>,
): Promise<AutomationRule> {
  const res = await apiFetch<{ rule: AutomationRule }>(`/projects/${projectId}/automation-rules/${ruleId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
  return res.rule;
}

export async function deleteAutomationRule(projectId: string, ruleId: string): Promise<void> {
  await apiFetch(`/projects/${projectId}/automation-rules/${ruleId}`, {
    method: "DELETE",
  });
}

export async function executeAutomationRules(projectId: string): Promise<RuleExecutionResult> {
  return apiFetch<RuleExecutionResult>(`/projects/${projectId}/automation-rules/execute`, {
    method: "POST",
  });
}
