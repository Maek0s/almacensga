import { useState } from "react";
import { ArrowDownToLine, ArrowLeftRight, Boxes, CheckCircle2, ClipboardList, Code2, Database, Download, FileCode2, GripVertical, MapPin, PackageOpen, Plus, Printer, RotateCcw, Save, Settings2, Trash2, Truck, Users, X, type LucideIcon } from "lucide-react";
import type { PageAction, PageActionVariant } from "./workspace";
import { useI18n } from "./i18n";

const actionButtonClass: Record<PageActionVariant, string> = {
  primary: "bg-brand text-white shadow-sm hover:bg-blue-700",
  secondary: "border border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-brand",
  danger: "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
};

const actionIcons: Record<string, LucideIcon> = {
  "new-stock-movement": ArrowLeftRight,
  "adjust-stock": RotateCcw,
  "view-stock-movements": ArrowLeftRight,
  "export-stock": Download,
  "new-receipt": ArrowDownToLine,
  "validate-receipt": CheckCircle2,
  "export-receipts": Download,
  "new-picking-wave": ClipboardList,
  "assign-picker": Users,
  "start-picking": PackageOpen,
  "export-picking": Download,
  "new-shipment": Truck,
  "confirm-load": CheckCircle2,
  "print-shipping-label": Printer,
  "export-shipments": Download,
  "new-installation": MapPin,
  "sync-installations": RotateCcw,
  "export-installations": Download,
  "new-location": MapPin,
  "import-layout": FileCode2,
  "print-location-labels": Printer,
  "export-locations": Download,
  "new-movement": ArrowLeftRight,
  "confirm-movement": CheckCircle2,
  "export-movements": Download,
  "new-inventory-count": ClipboardList,
  "approve-differences": CheckCircle2,
  "export-inventory": Download,
  "new-query": Database,
  "test-query": Code2,
  "export-queries": Download,
  "new-user": Users,
  "expire-sessions": RotateCcw,
  "export-users": Download,
  "new-product": Boxes,
  "import-products": FileCode2,
  "export-products": Download,
  "generate-replenishment": PackageOpen,
  "assign-replenishment": Users,
  "export-replenishment": Download,
  "new-supplier": Truck,
  "export-suppliers": Download,
  "new-customer": Users,
  "export-customers": Download,
  "run-integration": Database,
  "retry-integration": RotateCcw,
  "export-integrations": Download,
  "export-audit": Download,
  "download-audit-log": Download,
  "new-role": Settings2,
  "export-roles": Download,
};

function ActionIcon({ action }: { action: PageAction }) {
  const Icon = actionIcons[action.id] ?? (action.actionType === "export" ? Download : action.kind === "custom" ? Plus : Settings2);
  return <Icon size={15} strokeWidth={2.2} aria-hidden="true" />;
}

export function PageActionsBar({ actions, roleKey, canConfigure, busy = false, onAction, onConfigure }: { actions: PageAction[]; roleKey: string; canConfigure: boolean; busy?: boolean; onAction: (action: PageAction) => void; onConfigure: () => void }) {
  const { t } = useI18n();
  const visibleActions = actions.filter((action) => action.enabled && (!action.roleKeys || action.roleKeys.includes(roleKey)));
  return <section className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-panel" aria-labelledby="page-actions-title"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-50 text-brand"><Settings2 size={16} /></span><div><h2 id="page-actions-title" className="text-sm font-bold text-ink">{t("Acciones de la página")}</h2><p className="text-xs text-slate-400">{busy ? t("Ejecutando acción…") : visibleActions.length ? `${visibleActions.length} ${t("acciones activas")}` : t("No hay acciones activas para este perfil")}</p></div></div>{canConfigure && <button type="button" onClick={onConfigure} disabled={busy} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-50" aria-label={t("Configurar acciones de la página")}><Settings2 size={15} />{t("Configurar acciones")}</button>}</div><div className="mt-3 flex flex-wrap gap-2">{visibleActions.map((action) => <button key={action.id} type="button" disabled={busy} onClick={() => onAction(action)} className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition ${actionButtonClass[action.variant]} disabled:cursor-wait disabled:opacity-50`}><ActionIcon action={action} />{action.label}</button>)}</div></section>;
}

export function PageActionsConfigurationPanel({ actions, onClose, onSave }: { actions: PageAction[]; onClose: () => void; onSave: (actions: PageAction[]) => Promise<void> }) {
  const [draft, setDraft] = useState<PageAction[]>(actions.map((action) => ({ ...action, roleKeys: action.roleKeys ? [...action.roleKeys] : undefined })));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const updateAction = (id: string, update: Partial<PageAction>) => setDraft((current) => current.map((action) => action.id === id ? { ...action, ...update } : action));
  const addCustom = () => setDraft((current) => [...current, { id: `custom-${Date.now()}`, label: "Nueva acción", kind: "custom", actionType: "custom", enabled: true, variant: "secondary" }]);
  const save = async () => { setSaving(true); setError(""); try { await onSave(draft); onClose(); } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudieron guardar las acciones"); } finally { setSaving(false); } };

  return <div className="fixed inset-0 z-50 flex items-start justify-end bg-slate-950/35 p-4 sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="page-actions-config-title"><header className="flex items-start justify-between border-b border-slate-100 px-6 py-5"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">Personalización por instalación</p><h2 id="page-actions-config-title" className="mt-1 text-xl font-bold text-ink">Configurar acciones</h2><p className="mt-1 max-w-xl text-sm text-slate-500">Activa o desactiva las acciones definidas y añade botones propios para este módulo.</p></div><button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Cerrar configuración de acciones"><X size={19} /></button></header><div className="space-y-3 px-6 py-5">{draft.map((action) => <article key={action.id} className={`rounded-xl border p-4 ${action.enabled ? "border-slate-200 bg-white" : "border-slate-200 bg-slate-50"}`}><div className="flex items-start gap-3"><GripVertical size={17} className="mt-2 shrink-0 text-slate-300" aria-hidden="true" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-3"><label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={action.enabled} onChange={(event) => updateAction(action.id, { enabled: event.target.checked })} />Activa</label><div className="flex items-center gap-2"><span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${action.kind === "custom" ? "bg-violet-50 text-violet-700" : "bg-blue-50 text-blue-700"}`}>{action.kind === "custom" ? "Custom" : "Definida"}</span>{action.kind === "custom" && <button type="button" onClick={() => setDraft((current) => current.filter((item) => item.id !== action.id))} className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Eliminar ${action.label}`}><Trash2 size={15} /></button>}</div></div><div className="mt-3 grid gap-3 sm:grid-cols-[1fr_0.75fr_0.75fr]">{action.kind === "custom" ? <label className="text-xs font-semibold text-slate-500">Texto del botón<input value={action.label} onChange={(event) => updateAction(action.id, { label: event.target.value })} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-700 outline-none focus:border-brand focus:ring-4 focus:ring-blue-100" /></label> : <div className="rounded-lg bg-slate-50 px-3 py-2.5"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Acción definida</p><p className="mt-1 text-sm font-semibold text-slate-700">{action.label}</p></div>}<label className="text-xs font-semibold text-slate-500">Estilo<select value={action.variant} onChange={(event) => updateAction(action.id, { variant: event.target.value as PageActionVariant })} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 outline-none focus:border-brand focus:ring-4 focus:ring-blue-100"><option value="primary">Principal</option><option value="secondary">Secundaria</option><option value="danger">Peligro</option></select></label><div className="rounded-lg bg-slate-50 px-3 py-2.5"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Comportamiento</p><p className="mt-1 text-sm text-slate-600">{action.actionType === "custom" ? "Custom" : action.actionType === "export" ? "Exportación" : action.actionType === "navigation" ? "Navegación" : "Operación"}</p></div></div>{action.kind === "custom" && <p className="mt-2 text-xs text-slate-400">El botón queda registrado como acción custom. Su operación de negocio se conectará cuando exista el caso de uso correspondiente.</p>}</div></div></article>)}{draft.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 px-5 py-8 text-center text-sm text-slate-500">No hay acciones configuradas. Añade una acción custom para empezar.</div>}<button type="button" onClick={addCustom} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-dashed border-brand px-3.5 py-2.5 text-sm font-semibold text-brand hover:bg-blue-50"><Plus size={16} />Añadir acción custom</button>{error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p>}</div><footer className="flex justify-between border-t border-slate-100 px-6 py-4"><p className="self-center text-xs text-slate-400">Los cambios se guardan para la instalación actual.</p><div className="flex gap-3"><button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button><button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60">{saving ? "Guardando…" : <><Save size={16} />Guardar acciones</>}</button></div></footer></section></div>;
}
