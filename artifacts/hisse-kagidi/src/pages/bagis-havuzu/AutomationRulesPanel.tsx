import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus, Trash2, Edit2, Play, Loader2, X,
  ArrowRightLeft, Tag, AlertTriangle, EyeOff,
  GripVertical,
} from "lucide-react";
import {
  fetchAutomationRules, createAutomationRule,
  updateAutomationRule, deleteAutomationRule, executeAutomationRules,
} from "@/lib/api";
import type { AutomationRule, RuleCondition, RuleAction, RuleExecutionResult, CustomTag, CompoundConditions, ConditionGroup } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

const FIELD_OPTIONS = [
  { value: "birim", label: "Birim" },
  { value: "temsilci", label: "Temsilci" },
  { value: "donationType", label: "Cinsi" },
  { value: "ozellik", label: "Özellik" },
  { value: "fiyat", label: "Fiyat" },
  { value: "yerTalebi", label: "Yer Talebi" },
  { value: "gunTalebi", label: "Gün Talebi" },
  { value: "ilkHayvan", label: "İlk Hayvan" },
  { value: "safi", label: "Şafi" },
  { value: "name", label: "Adına Kesilen" },
  { value: "description", label: "Vekaleti Veren" },
  { value: "vekalet", label: "Vekalet" },
  { value: "notes", label: "Notlar" },
  { value: "shareCount", label: "Hisse Sayısı" },
  { value: "tags", label: "Etiket" },
  { value: "aiCategories", label: "AI Kategorisi" },
  { value: "aiWarnings", label: "AI Uyarıları" },
  { value: "kesimAlaniId", label: "Kesim Listesi" },
];

const OPERATOR_OPTIONS: Record<string, { value: string; label: string }[]> = {
  text: [
    { value: "equals", label: "Eşittir" },
    { value: "not_equals", label: "Eşit Değildir" },
    { value: "contains", label: "İçerir" },
    { value: "not_contains", label: "İçermez" },
    { value: "is_empty", label: "Boş" },
    { value: "is_not_empty", label: "Dolu" },
  ],
  number: [
    { value: "equals", label: "Eşittir" },
    { value: "not_equals", label: "Eşit Değildir" },
    { value: "gt", label: "Büyüktür" },
    { value: "gte", label: "Büyük Eşit" },
    { value: "lt", label: "Küçüktür" },
    { value: "lte", label: "Küçük Eşit" },
    { value: "between", label: "Arasında" },
  ],
  tags: [
    { value: "in", label: "İçerir" },
    { value: "not_in", label: "İçermez" },
    { value: "is_empty", label: "Etiket Yok" },
    { value: "is_not_empty", label: "Etiket Var" },
  ],
  aiCategories: [
    { value: "contains", label: "İçerir" },
    { value: "not_contains", label: "İçermez" },
    { value: "is_empty", label: "Kategori Yok" },
    { value: "is_not_empty", label: "Kategori Var" },
  ],
};

function getOperatorType(field: string): string {
  if (field === "shareCount") return "number";
  if (field === "tags") return "tags";
  if (field === "aiCategories") return "aiCategories";
  if (field === "aiWarnings") return "text";
  return "text";
}

function needsValueInput(operator: string): boolean {
  return !["is_empty", "is_not_empty"].includes(operator);
}

const ACTION_LABELS: Record<string, string> = {
  transfer_to_ka: "Listeye Aktar",
  add_tag: "Etiket Ekle",
  flag: "Sorunlu İşaretle",
  exclude: "Sepetten Çıkar",
  compound: "Birleşik Eylem",
};

interface AutomationRulesPanelProps {
  projectId: string;
  kesimAlanlari: { id: string; name: string }[];
  globalTags: CustomTag[];
}

function isCompoundConditions(conditions: RuleCondition[] | CompoundConditions): conditions is CompoundConditions {
  return !Array.isArray(conditions) && "logic" in conditions && "groups" in conditions;
}

function normalizeToCompound(conditions: RuleCondition[] | CompoundConditions): CompoundConditions {
  if (isCompoundConditions(conditions)) return conditions;
  return { logic: "AND", groups: [{ logic: "AND", conditions }] };
}

function ConditionRow({
  cond,
  onUpdate,
  onRemove,
  kesimAlanlari,
  globalTags,
}: {
  cond: RuleCondition;
  onUpdate: (updates: Partial<RuleCondition>) => void;
  onRemove: () => void;
  kesimAlanlari: { id: string; name: string }[];
  globalTags: CustomTag[];
}) {
  const opType = getOperatorType(cond.field);
  const operators = OPERATOR_OPTIONS[opType];
  const showValue = needsValueInput(cond.operator);

  return (
    <div className="flex items-start gap-1.5 p-2 border rounded bg-muted/20">
      <Select value={cond.field} onValueChange={v => onUpdate({ field: v })}>
        <SelectTrigger className="h-8 text-xs w-[130px] flex-shrink-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FIELD_OPTIONS.map(f => (
            <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={cond.operator} onValueChange={v => onUpdate({ operator: v })}>
        <SelectTrigger className="h-8 text-xs w-[120px] flex-shrink-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {operators.map(o => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {showValue && (
        <>
          {cond.field === "kesimAlaniId" ? (
            <Select
              value={String(cond.value)}
              onValueChange={v => onUpdate({ value: v })}
            >
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue placeholder="Kesim Listesi" />
              </SelectTrigger>
              <SelectContent>
                {kesimAlanlari.map(ka => (
                  <SelectItem key={ka.id} value={ka.id}>{ka.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : cond.field === "tags" ? (
            <Select
              value={String(Array.isArray(cond.value) ? cond.value[0] || "" : cond.value)}
              onValueChange={v => onUpdate({ value: v })}
            >
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue placeholder="Etiket" />
              </SelectTrigger>
              <SelectContent>
                {globalTags.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : cond.operator === "between" ? (
            <div className="flex gap-1 flex-1">
              <Input
                type="number"
                placeholder="Min"
                value={Array.isArray(cond.value) ? cond.value[0] : ""}
                onChange={e => {
                  const cur = Array.isArray(cond.value) ? cond.value : [0, 0];
                  onUpdate({ value: [Number(e.target.value), Number(cur[1])] });
                }}
                className="h-8 text-xs"
              />
              <Input
                type="number"
                placeholder="Max"
                value={Array.isArray(cond.value) ? cond.value[1] : ""}
                onChange={e => {
                  const cur = Array.isArray(cond.value) ? cond.value : [0, 0];
                  onUpdate({ value: [Number(cur[0]), Number(e.target.value)] });
                }}
                className="h-8 text-xs"
              />
            </div>
          ) : opType === "number" ? (
            <Input
              type="number"
              placeholder="Değer"
              value={String(cond.value)}
              onChange={e => onUpdate({ value: Number(e.target.value) })}
              className="h-8 text-xs flex-1"
            />
          ) : (
            <Input
              placeholder="Değer"
              value={String(cond.value)}
              onChange={e => onUpdate({ value: e.target.value })}
              className="h-8 text-xs flex-1"
            />
          )}
        </>
      )}

      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 flex-shrink-0" onClick={onRemove}>
        <X className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

function LogicToggle({ value, onChange, size = "sm" }: { value: "AND" | "OR"; onChange: (v: "AND" | "OR") => void; size?: "sm" | "xs" }) {
  return (
    <button
      type="button"
      onClick={() => onChange(value === "AND" ? "OR" : "AND")}
      className={`inline-flex items-center rounded-full font-semibold transition-colors ${
        size === "xs" ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs"
      } ${
        value === "AND"
          ? "bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300"
          : "bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300"
      }`}
    >
      {value === "AND" ? "VE" : "VEYA"}
    </button>
  );
}

function ConditionBuilder({
  compound,
  onChange,
  kesimAlanlari,
  globalTags,
}: {
  compound: CompoundConditions;
  onChange: (c: CompoundConditions) => void;
  kesimAlanlari: { id: string; name: string }[];
  globalTags: CustomTag[];
}) {
  const addGroup = () => {
    onChange({
      ...compound,
      groups: [...compound.groups, { logic: "AND", conditions: [{ field: "birim", operator: "equals", value: "" }] }],
    });
  };

  const removeGroup = (groupIdx: number) => {
    const next = compound.groups.filter((_, i) => i !== groupIdx);
    onChange({ ...compound, groups: next.length === 0 ? [{ logic: "AND", conditions: [{ field: "birim", operator: "equals", value: "" }] }] : next });
  };

  const updateGroupLogic = (groupIdx: number, logic: "AND" | "OR") => {
    const next = compound.groups.map((g, i) => i === groupIdx ? { ...g, logic } : g);
    onChange({ ...compound, groups: next });
  };

  const addConditionToGroup = (groupIdx: number) => {
    const next = compound.groups.map((g, i) =>
      i === groupIdx ? { ...g, conditions: [...g.conditions, { field: "birim", operator: "equals", value: "" }] } : g
    );
    onChange({ ...compound, groups: next });
  };

  const updateCondition = (groupIdx: number, condIdx: number, updates: Partial<RuleCondition>) => {
    const next = compound.groups.map((g, gi) => {
      if (gi !== groupIdx) return g;
      const conditions = g.conditions.map((c, ci) => {
        if (ci !== condIdx) return c;
        const updated = { ...c, ...updates };
        if (updates.field && updates.field !== c.field) {
          const opType = getOperatorType(updates.field);
          const ops = OPERATOR_OPTIONS[opType];
          updated.operator = ops[0].value;
          updated.value = "";
        }
        return updated;
      });
      return { ...g, conditions };
    });
    onChange({ ...compound, groups: next });
  };

  const removeCondition = (groupIdx: number, condIdx: number) => {
    const next = compound.groups.map((g, gi) => {
      if (gi !== groupIdx) return g;
      const conditions = g.conditions.filter((_, ci) => ci !== condIdx);
      return { ...g, conditions };
    }).filter(g => g.conditions.length > 0);
    onChange({ ...compound, groups: next.length === 0 ? [{ logic: "AND", conditions: [] }] : next });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Koşullar</label>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={addGroup} className="h-7 text-xs">
            <Plus className="w-3 h-3 mr-1" />Grup Ekle
          </Button>
        </div>
      </div>

      {compound.groups.map((group, groupIdx) => (
        <div key={groupIdx}>
          {groupIdx > 0 && (
            <div className="flex items-center justify-center py-1">
              <div className="h-px bg-border flex-1" />
              <LogicToggle
                value={compound.logic}
                onChange={(v) => onChange({ ...compound, logic: v })}
              />
              <div className="h-px bg-border flex-1" />
            </div>
          )}
          <div className="border rounded-lg p-2 space-y-1.5 bg-muted/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {group.conditions.length > 1 && (
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <span>Grup içi:</span>
                    <LogicToggle
                      value={group.logic}
                      onChange={(v) => updateGroupLogic(groupIdx, v)}
                      size="xs"
                    />
                  </div>
                )}
                {compound.groups.length === 1 && group.conditions.length <= 1 && (
                  <span className="text-[10px] text-muted-foreground">Koşul Grubu</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => addConditionToGroup(groupIdx)}>
                  <Plus className="w-3 h-3 mr-0.5" />Koşul
                </Button>
                {compound.groups.length > 1 && (
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => removeGroup(groupIdx)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </div>
            {group.conditions.map((cond, condIdx) => (
              <div key={condIdx}>
                {condIdx > 0 && group.conditions.length > 1 && (
                  <div className="flex items-center justify-center py-0.5">
                    <span className={`text-[10px] font-semibold px-2 ${
                      group.logic === "AND"
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-amber-600 dark:text-amber-400"
                    }`}>
                      {group.logic === "AND" ? "VE" : "VEYA"}
                    </span>
                  </div>
                )}
                <ConditionRow
                  cond={cond}
                  onUpdate={(updates) => updateCondition(groupIdx, condIdx, updates)}
                  onRemove={() => removeCondition(groupIdx, condIdx)}
                  kesimAlanlari={kesimAlanlari}
                  globalTags={globalTags}
                />
              </div>
            ))}
            {group.conditions.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">
                Koşul ekleyin
              </p>
            )}
          </div>
        </div>
      ))}
      {compound.groups.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-3">
          En az bir koşul grubu ekleyin
        </p>
      )}
    </div>
  );
}

function ActionBuilder({
  action,
  onChange,
  kesimAlanlari,
  globalTags,
}: {
  action: RuleAction;
  onChange: (a: RuleAction) => void;
  kesimAlanlari: { id: string; name: string }[];
  globalTags: CustomTag[];
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Eylem</label>
      <div className="p-2 border rounded bg-muted/20 space-y-2">
        <Select value={action.type} onValueChange={v => onChange({ type: v as RuleAction["type"] })}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="transfer_to_ka">Listeye Aktar</SelectItem>
            <SelectItem value="add_tag">Etiket Ekle</SelectItem>
            <SelectItem value="flag">Sorunlu İşaretle</SelectItem>
            <SelectItem value="exclude">Sepetten Çıkar</SelectItem>
          </SelectContent>
        </Select>

        {action.type === "transfer_to_ka" && (
          <Select
            value={action.targetKesimAlaniId || ""}
            onValueChange={v => onChange({ ...action, targetKesimAlaniId: v })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Hedef Kesim Listesi" />
            </SelectTrigger>
            <SelectContent>
              {kesimAlanlari.map(ka => (
                <SelectItem key={ka.id} value={ka.id}>{ka.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {action.type === "add_tag" && (
          <Select
            value={action.tagId || ""}
            onValueChange={v => onChange({ ...action, tagId: v })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Etiket" />
            </SelectTrigger>
            <SelectContent>
              {globalTags.map(t => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {action.type === "flag" && (
          <Input
            placeholder="İşaretleme sebebi (opsiyonel)"
            value={action.flagReason || ""}
            onChange={e => onChange({ ...action, flagReason: e.target.value })}
            className="h-8 text-xs"
          />
        )}
      </div>
    </div>
  );
}

function getActionIcon(type: string) {
  switch (type) {
    case "transfer_to_ka": return <ArrowRightLeft className="w-3.5 h-3.5" />;
    case "add_tag": return <Tag className="w-3.5 h-3.5" />;
    case "flag": return <AlertTriangle className="w-3.5 h-3.5" />;
    case "exclude": return <EyeOff className="w-3.5 h-3.5" />;
    case "compound": return <AlertTriangle className="w-3.5 h-3.5" />;
    default: return null;
  }
}

function getActionDescription(action: RuleAction, kesimAlanlari: { id: string; name: string }[], globalTags: CustomTag[]): string {
  switch (action.type) {
    case "transfer_to_ka": {
      const ka = kesimAlanlari.find(k => k.id === action.targetKesimAlaniId);
      return `"${ka?.name || "?"}" listesine aktar`;
    }
    case "add_tag": {
      const tag = globalTags.find(t => t.id === action.tagId);
      return `"${tag?.name || "?"}" etiketi ekle`;
    }
    case "flag":
      return action.flagReason ? `Sorunlu işaretle: ${action.flagReason}` : "Sorunlu işaretle";
    case "exclude":
      return "Sepetten çıkar";
    case "compound": {
      if (Array.isArray(action.actions) && action.actions.length > 0) {
        return action.actions.map(a => getActionDescription(a as RuleAction, kesimAlanlari, globalTags)).join(" + ");
      }
      return "Birleşik eylem";
    }
    default:
      return "Bilinmeyen eylem";
  }
}

function getConditionDescription(cond: RuleCondition, kesimAlanlari: { id: string; name: string }[], globalTags: CustomTag[]): string {
  const fieldLabel = FIELD_OPTIONS.find(f => f.value === cond.field)?.label || cond.field;
  const opType = getOperatorType(cond.field);
  const operators = OPERATOR_OPTIONS[opType];
  const opLabel = operators.find(o => o.value === cond.operator)?.label || cond.operator;

  if (!needsValueInput(cond.operator)) {
    return `${fieldLabel} ${opLabel}`;
  }

  let valueStr = String(cond.value);
  if (cond.field === "kesimAlaniId") {
    const ka = kesimAlanlari.find(k => k.id === String(cond.value));
    valueStr = ka?.name || valueStr;
  } else if (cond.field === "tags") {
    const tagId = Array.isArray(cond.value) ? cond.value[0] : cond.value;
    const tag = globalTags.find(t => t.id === String(tagId));
    valueStr = tag?.name || String(tagId);
  } else if (cond.operator === "between" && Array.isArray(cond.value)) {
    valueStr = `${cond.value[0]} - ${cond.value[1]}`;
  }

  return `${fieldLabel} ${opLabel} "${valueStr}"`;
}

export function AutomationRulesPanel({ projectId, kesimAlanlari, globalTags }: AutomationRulesPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [executing, setExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<RuleExecutionResult | null>(null);
  const [resultDialogOpen, setResultDialogOpen] = useState(false);

  const [ruleName, setRuleName] = useState("");
  const [compound, setCompound] = useState<CompoundConditions>({ logic: "AND", groups: [{ logic: "AND", conditions: [{ field: "birim", operator: "equals", value: "" }] }] });
  const [action, setAction] = useState<RuleAction>({ type: "transfer_to_ka" });
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["automation-rules", projectId],
    queryFn: () => fetchAutomationRules(projectId),
    enabled: !!projectId,
  });

  const invalidateRules = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["automation-rules", projectId] });
  }, [queryClient, projectId]);

  const openCreateDialog = useCallback(() => {
    setEditingRule(null);
    setRuleName("");
    setCompound({ logic: "AND", groups: [{ logic: "AND", conditions: [{ field: "birim", operator: "equals", value: "" }] }] });
    setAction({ type: "transfer_to_ka" });
    setIsActive(true);
    setDialogOpen(true);
  }, []);

  const openEditDialog = useCallback((rule: AutomationRule) => {
    setEditingRule(rule);
    setRuleName(rule.name);
    setCompound(normalizeToCompound(rule.conditions));
    setAction(rule.action);
    setIsActive(rule.isActive);
    setDialogOpen(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!ruleName.trim()) {
      toast({ title: "Kural adı gerekli", variant: "destructive" });
      return;
    }
    const totalConditions = compound.groups.reduce((sum, g) => sum + g.conditions.length, 0);
    if (totalConditions === 0) {
      toast({ title: "En az bir koşul ekleyin", variant: "destructive" });
      return;
    }
    if (action.type === "transfer_to_ka" && !action.targetKesimAlaniId) {
      toast({ title: "Hedef kesim listesi seçin", variant: "destructive" });
      return;
    }
    if (action.type === "add_tag" && !action.tagId) {
      toast({ title: "Etiket seçin", variant: "destructive" });
      return;
    }

    const nonEmptyGroups = compound.groups.filter(g => g.conditions.length > 0);
    const conditionsToSave: CompoundConditions = { ...compound, groups: nonEmptyGroups };

    setSaving(true);
    try {
      if (editingRule) {
        await updateAutomationRule(projectId, editingRule.id, {
          name: ruleName.trim(),
          conditions: conditionsToSave,
          action,
          isActive,
        });
        toast({ title: "Kural güncellendi" });
      } else {
        await createAutomationRule(projectId, {
          name: ruleName.trim(),
          conditions: conditionsToSave,
          action,
          isActive,
        });
        toast({ title: "Kural oluşturuldu" });
      }
      setDialogOpen(false);
      invalidateRules();
    } catch (err) {
      toast({ title: "Hata", description: err instanceof Error ? err.message : "Bilinmeyen hata", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [editingRule, projectId, ruleName, compound, action, isActive, toast, invalidateRules]);

  const handleDelete = useCallback(async (ruleId: string) => {
    try {
      await deleteAutomationRule(projectId, ruleId);
      toast({ title: "Kural silindi" });
      invalidateRules();
    } catch (err) {
      toast({ title: "Silme başarısız", description: err instanceof Error ? err.message : "Hata", variant: "destructive" });
    }
  }, [projectId, toast, invalidateRules]);

  const handleToggleActive = useCallback(async (rule: AutomationRule) => {
    try {
      await updateAutomationRule(projectId, rule.id, { isActive: !rule.isActive });
      invalidateRules();
    } catch (err) {
      toast({ title: "Hata", description: err instanceof Error ? err.message : "Hata", variant: "destructive" });
    }
  }, [projectId, toast, invalidateRules]);

  const handleExecute = useCallback(async () => {
    setExecuting(true);
    try {
      const result = await executeAutomationRules(projectId);
      setExecutionResult(result);
      setResultDialogOpen(true);
      queryClient.invalidateQueries({ queryKey: ["pool-donations"] });
      queryClient.invalidateQueries({ queryKey: ["pool-stats"] });
      toast({ title: `Kurallar çalıştırıldı — ${result.totalAffected} bağış etkilendi` });
    } catch (err) {
      toast({ title: "Kurallar çalıştırılamadı", description: err instanceof Error ? err.message : "Hata", variant: "destructive" });
    } finally {
      setExecuting(false);
    }
  }, [projectId, queryClient, toast]);

  const activeRuleCount = rules.filter(r => r.isActive).length;

  return (
    <div className="border rounded-lg bg-background">
      <div className="flex items-center justify-between p-3 border-b">
        <div>
          <h3 className="text-sm font-semibold">Otomatik Kurallar</h3>
          <p className="text-xs text-muted-foreground">
            {rules.length} kural ({activeRuleCount} aktif)
          </p>
        </div>
        <div className="flex gap-1.5">
          <Button variant="outline" size="sm" onClick={openCreateDialog}>
            <Plus className="w-4 h-4 mr-1" />Yeni Kural
          </Button>
          <Button
            size="sm"
            onClick={handleExecute}
            disabled={executing || activeRuleCount === 0}
          >
            {executing ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Play className="w-4 h-4 mr-1" />
            )}
            Kuralları Çalıştır
          </Button>
        </div>
      </div>

      <div className="divide-y">
        {isLoading && (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Yükleniyor...
          </div>
        )}
        {!isLoading && rules.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Henüz kural tanımlanmamış. "Yeni Kural" ile başlayın.
          </div>
        )}
        {rules.map((rule, idx) => (
          <div
            key={rule.id}
            className={`p-3 hover:bg-muted/30 transition-colors ${!rule.isActive ? "opacity-50" : ""}`}
          >
            <div className="flex items-start gap-2">
              <div className="flex items-center gap-1 text-muted-foreground mt-0.5">
                <GripVertical className="w-3.5 h-3.5" />
                <span className="text-xs font-mono w-4 text-center">{idx + 1}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium truncate">{rule.name}</span>
                  {!rule.isActive && (
                    <Badge variant="outline" className="text-[10px] h-4">Devre Dışı</Badge>
                  )}
                </div>
                <div className="space-y-0.5">
                  <div className="flex flex-wrap gap-1 items-center">
                    {(() => {
                      const c = normalizeToCompound(rule.conditions);
                      return c.groups.map((group, gi) => (
                        <span key={gi} className="contents">
                          {gi > 0 && (
                            <span className={`text-[10px] font-bold px-1 ${
                              c.logic === "OR" ? "text-amber-600 dark:text-amber-400" : "text-blue-600 dark:text-blue-400"
                            }`}>
                              {c.logic === "AND" ? "VE" : "VEYA"}
                            </span>
                          )}
                          {c.groups.length > 1 && <span className="text-[10px] text-muted-foreground">(</span>}
                          {group.conditions.map((cond, ci) => (
                            <span key={ci} className="contents">
                              {ci > 0 && (
                                <span className={`text-[10px] font-bold px-0.5 ${
                                  group.logic === "OR" ? "text-amber-600 dark:text-amber-400" : "text-blue-600 dark:text-blue-400"
                                }`}>
                                  {group.logic === "AND" ? "VE" : "VEYA"}
                                </span>
                              )}
                              <Badge variant="secondary" className="text-[10px] h-5">
                                {getConditionDescription(cond, kesimAlanlari, globalTags)}
                              </Badge>
                            </span>
                          ))}
                          {c.groups.length > 1 && <span className="text-[10px] text-muted-foreground">)</span>}
                        </span>
                      ));
                    })()}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {getActionIcon(rule.action.type)}
                    <span>{getActionDescription(rule.action, kesimAlanlari, globalTags)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => handleToggleActive(rule)}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${rule.isActive ? "bg-primary" : "bg-muted-foreground/30"}`}
                >
                  <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${rule.isActive ? "translate-x-4" : "translate-x-0"}`} />
                </button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEditDialog(rule)}>
                  <Edit2 className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => handleDelete(rule.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRule ? "Kuralı Düzenle" : "Yeni Kural"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Kural Adı</label>
              <Input
                value={ruleName}
                onChange={e => setRuleName(e.target.value)}
                placeholder="Örn: Ankara bağışlarını KA-1'e aktar"
                className="mt-1"
              />
            </div>

            <ConditionBuilder
              compound={compound}
              onChange={setCompound}
              kesimAlanlari={kesimAlanlari}
              globalTags={globalTags}
            />

            <ActionBuilder
              action={action}
              onChange={setAction}
              kesimAlanlari={kesimAlanlari}
              globalTags={globalTags}
            />

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsActive(!isActive)}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${isActive ? "bg-primary" : "bg-muted-foreground/30"}`}
              >
                <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isActive ? "translate-x-4" : "translate-x-0"}`} />
              </button>
              <label className="text-sm cursor-pointer" onClick={() => setIsActive(!isActive)}>Kural aktif</label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>İptal</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {editingRule ? "Güncelle" : "Oluştur"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resultDialogOpen} onOpenChange={setResultDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Kural Çalıştırma Sonuçları</DialogTitle>
          </DialogHeader>
          {executionResult && (
            <div className="space-y-3">
              <div className="p-3 bg-muted/30 rounded-lg text-center">
                <span className="text-2xl font-bold">{executionResult.totalAffected}</span>
                <p className="text-sm text-muted-foreground">toplam etkilenen bağış</p>
              </div>
              <div className="divide-y">
                {executionResult.ruleResults.map((r, i) => (
                  <div key={i} className="py-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getActionIcon(r.action.type)}
                        <span className="text-sm font-medium">{r.ruleName}</span>
                      </div>
                      <Badge variant={r.affectedCount > 0 ? "default" : "secondary"}>
                        {r.affectedCount} bağış
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 ml-6">
                      {ACTION_LABELS[r.action.type] || r.action.type}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setResultDialogOpen(false)}>Kapat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
