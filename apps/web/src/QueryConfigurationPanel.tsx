import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Code2, Download, Filter, Palette, Plus, Save, Send, Trash2, Upload, X } from "lucide-react";
import type { AuthSession } from "./auth";
import { ErrorFeedback } from "./ErrorFeedback";
import { classifyError, type SupportIncident } from "./error-utils";
import { useI18n } from "./i18n";
import {
  fetchQueryConfiguration,
  publishQueryConfiguration,
  saveQueryConfiguration,
  type QueryColumnType,
  type QueryConfiguration,
  type QueryConfigurationColumn,
  type QueryConfigurationCondition,
  type QueryConfigurationInput,
  type QueryConditionOperator,
  type WorkspaceResource,
} from "./workspace";

type QueryConfigurationPanelProps = {
  resource: WorkspaceResource;
  session: AuthSession;
  onReportError?: (incident: SupportIncident) => void;
  onClose: () => void;
  onPublished?: (configuration: QueryConfiguration) => void;
};

type PortableQueryConfiguration = QueryConfigurationInput & {
  schemaVersion: 1;
  resource: WorkspaceResource;
};

const defaultSql = `SELECT sku, description, lot, warehouse, zone, quantity, available, reserved, status
FROM stock
WHERE installation_id = :installationId
  AND available > 0
ORDER BY last_movement DESC`;

const defaultColumns: QueryConfigurationColumn[] = [
  { key: "sku", label: "SKU", visible: true, type: "text" },
  { key: "description", label: "Descripción", visible: true, type: "text" },
  { key: "lot", label: "Lote", visible: true, type: "text" },
  { key: "warehouse", label: "Almacén", visible: true, type: "text" },
  { key: "zone", label: "Zona", visible: true, type: "text" },
  { key: "quantity", label: "Cantidad", visible: true, type: "number", decimals: 0 },
  { key: "available", label: "Disponible", visible: true, type: "number", decimals: 0, background: "#eff6ff", textColor: "#1d4ed8" },
  { key: "reserved", label: "Reservado", visible: false, type: "number", decimals: 0 },
  {
    key: "status", label: "Estado", visible: true, type: "status", badge: true,
    conditions: [
      { operator: "eq", value: "Disponible", background: "#dcfce7", textColor: "#166534" },
      { operator: "eq", value: "Bloqueado", background: "#fee2e2", textColor: "#991b1b" },
      { operator: "eq", value: "Reservado", background: "#fef3c7", textColor: "#92400e" },
    ],
  },
];

const defaultFilters = `warehouse | Almacén | select
zone | Zona | select
status | Estado | select
sku | SKU | text`;

const columnTypes: Array<{ value: QueryColumnType; label: string }> = [
  { value: "text", label: "Texto" },
  { value: "number", label: "Numérico" },
  { value: "percentage", label: "Porcentaje" },
  { value: "currency", label: "Moneda" },
  { value: "date", label: "Fecha" },
  { value: "status", label: "Estado / etiqueta" },
];

const operators: Array<{ value: QueryConditionOperator; label: string }> = [
  { value: "eq", label: "es igual a" },
  { value: "neq", label: "es distinto de" },
  { value: "gt", label: "es mayor que" },
  { value: "gte", label: "es mayor o igual" },
  { value: "lt", label: "es menor que" },
  { value: "lte", label: "es menor o igual" },
  { value: "contains", label: "contiene" },
];

const cloneColumns = (columns: QueryConfigurationColumn[]) => columns.map((column) => ({ ...column, conditions: column.conditions?.map((condition) => ({ ...condition })) }));
const toListText = (values: string[]) => values.join(", ");
const parseList = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);
const normalizeColumn = (value: Partial<QueryConfigurationColumn>, index: number): QueryConfigurationColumn => ({
  key: typeof value.key === "string" && value.key.trim() ? value.key.trim() : `campo_${index + 1}`,
  label: typeof value.label === "string" && value.label.trim() ? value.label.trim() : `Campo ${index + 1}`,
  visible: value.visible !== false,
  type: columnTypes.some((item) => item.value === value.type) ? value.type as QueryColumnType : "text",
  decimals: typeof value.decimals === "number" ? value.decimals : undefined,
  suffix: typeof value.suffix === "string" ? value.suffix : undefined,
  background: typeof value.background === "string" ? value.background : undefined,
  textColor: typeof value.textColor === "string" ? value.textColor : undefined,
  badge: value.badge === true,
  conditions: Array.isArray(value.conditions) ? value.conditions.map((condition) => ({
    operator: operators.some((item) => item.value === condition.operator) ? condition.operator : "eq",
    value: condition.value ?? "",
    background: condition.background || "#fee2e2",
    textColor: condition.textColor || "#991b1b",
    label: condition.label,
  })) : [],
});

const downloadJson = (configuration: PortableQueryConfiguration) => {
  const blob = new Blob([JSON.stringify(configuration, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${configuration.resource}-consulta-${configuration.name.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}.json`;
  link.click();
  URL.revokeObjectURL(url);
};

export function QueryConfigurationPanel({ resource, session, onClose, onPublished, onReportError }: QueryConfigurationPanelProps) {
  const { t } = useI18n();
  const importInputRef = useRef<HTMLInputElement>(null);
  const [configuration, setConfiguration] = useState<QueryConfiguration | null>(null);
  const [name, setName] = useState("Stock operativo");
  const [description, setDescription] = useState("Existencias disponibles para la operación diaria del almacén.");
  const [sqlText, setSqlText] = useState(defaultSql);
  const [columns, setColumns] = useState<QueryConfigurationColumn[]>(cloneColumns(defaultColumns));
  const [filtersText, setFiltersText] = useState(defaultFilters);
  const [parametersText, setParametersText] = useState("installationId");
  const [defaultSort, setDefaultSort] = useState("lastMovement desc");
  const [actionsText, setActionsText] = useState("Exportar, Ajustar stock, Ver movimientos");
  const [allowedRolesText, setAllowedRolesText] = useState("WAREHOUSE_MANAGER, DEVELOPER, PRODUCT_OWNER");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetchQueryConfiguration(resource, session.token)
      .then((nextConfiguration) => {
        if (!active) return;
        setConfiguration(nextConfiguration);
        setName(nextConfiguration.name);
        setDescription(nextConfiguration.description ?? "");
        setSqlText(nextConfiguration.sqlText);
        setColumns(cloneColumns(nextConfiguration.columns.map(normalizeColumn)));
        setFiltersText(nextConfiguration.filters.map((filter) => `${filter.key} | ${filter.label} | ${filter.type}`).join("\n"));
        setParametersText(toListText(nextConfiguration.parameters));
        setDefaultSort(nextConfiguration.defaultSort ?? "");
        setActionsText(toListText(nextConfiguration.actions));
        setAllowedRolesText(toListText(nextConfiguration.allowedRoles));
      })
      .catch((nextError) => { if (active) setError(nextError instanceof Error ? nextError.message : "No se pudo cargar la configuración"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [resource, session.token]);

  const updateColumn = (index: number, change: Partial<QueryConfigurationColumn>) => setColumns((current) => current.map((column, columnIndex) => columnIndex === index ? { ...column, ...change } : column));
  const addColumn = () => setColumns((current) => [...current, normalizeColumn({ key: "nuevo_campo", label: "Nuevo campo", type: "text" }, current.length)]);
  const removeColumn = (index: number) => setColumns((current) => current.filter((_, columnIndex) => columnIndex !== index));
  const addCondition = (columnIndex: number) => setColumns((current) => current.map((column, index) => index === columnIndex ? { ...column, conditions: [...(column.conditions ?? []), { operator: "eq", value: "", background: "#fee2e2", textColor: "#991b1b" }] } : column));
  const updateCondition = (columnIndex: number, conditionIndex: number, change: Partial<QueryConfigurationCondition>) => setColumns((current) => current.map((column, index) => index === columnIndex ? { ...column, conditions: (column.conditions ?? []).map((condition, ruleIndex) => ruleIndex === conditionIndex ? { ...condition, ...change } : condition) } : column));
  const removeCondition = (columnIndex: number, conditionIndex: number) => setColumns((current) => current.map((column, index) => index === columnIndex ? { ...column, conditions: (column.conditions ?? []).filter((_, ruleIndex) => ruleIndex !== conditionIndex) } : column));

  const getInput = (): QueryConfigurationInput => ({
    name,
    description: description || null,
    sqlText,
    columns: columns.map((column, index) => normalizeColumn(column, index)),
    filters: filtersText.split(/\r?\n/).map((line) => line.split("|").map((item) => item.trim())).filter(([key]) => Boolean(key)).map(([key, label, type = "search"]) => ({ key, label: label || key, type })),
    parameters: parseList(parametersText),
    defaultSort: defaultSort || null,
    actions: parseList(actionsText),
    allowedRoles: parseList(allowedRolesText),
  });

  const exportConfiguration = () => downloadJson({ schemaVersion: 1, resource, ...getInput() });
  const importConfiguration = async (file: File) => {
    try {
      const imported = JSON.parse(await file.text()) as Partial<PortableQueryConfiguration>;
      if (imported.resource && imported.resource !== resource) throw new Error(`Este archivo pertenece al módulo ${imported.resource}, no a ${resource}`);
      if (!Array.isArray(imported.columns) || typeof imported.sqlText !== "string") throw new Error("El JSON no contiene una configuración de consulta válida");
      setName(imported.name || name);
      setDescription(imported.description || "");
      setSqlText(imported.sqlText);
      setColumns(imported.columns.map(normalizeColumn));
      if (Array.isArray(imported.filters)) setFiltersText(imported.filters.map((filter) => `${filter.key} | ${filter.label} | ${filter.type}`).join("\n"));
      if (Array.isArray(imported.parameters)) setParametersText(imported.parameters.join(", "));
      setDefaultSort(imported.defaultSort || "");
      setActionsText(imported.actions?.join(", ") || "");
      setAllowedRolesText(imported.allowedRoles?.join(", ") || "");
      setFeedback("JSON cargado. Revisa y guarda para aplicarlo");
      setError("");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "No se pudo importar el JSON");
    } finally {
      if (importInputRef.current) importInputRef.current.value = "";
    }
  };

  const saveDraft = async () => {
    setSaving(true); setFeedback(""); setError("");
    try {
      const saved = await saveQueryConfiguration(resource, session.token, getInput());
      setConfiguration(saved); setFeedback(`Borrador v${saved.version} guardado`);
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : "No se pudo guardar el borrador"); }
    finally { setSaving(false); }
  };

  const publish = async () => {
    setSaving(true); setFeedback(""); setError("");
    try {
      await saveQueryConfiguration(resource, session.token, getInput());
      const published = await publishQueryConfiguration(resource, session.token);
      setConfiguration(published); setFeedback(`Versión v${published.version} publicada para ${session.installation.name}`); onPublished?.(published);
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : "No se pudo publicar la configuración"); }
    finally { setSaving(false); }
  };

  return <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/30" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <aside className="flex h-full w-full max-w-[980px] flex-col bg-white shadow-2xl" aria-label="Configuración de consulta">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
        <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">Administración por instalación</p><h2 className="mt-1 text-xl font-bold text-ink">Configurar consulta · {resource}</h2><p className="mt-1 text-sm text-slate-500">{session.installation.name} · {session.client.name}</p></div>
        <div className="flex items-center gap-2"><input ref={importInputRef} type="file" accept="application/json,.json" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importConfiguration(file); }} /><button type="button" onClick={() => importInputRef.current?.click()} className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"><Upload size={16} />Importar JSON</button><button type="button" onClick={exportConfiguration} className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"><Download size={16} />Exportar JSON</button><button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-lg text-slate-400 hover:bg-slate-100" aria-label="Cerrar configuración"><X size={18} /></button></div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-900"><strong>Configuración portable y aislada.</strong> Trabaja con formularios. El botón Exportar JSON crea un paquete que puedes importar en otra instalación o cliente; no necesitas editar el JSON manualmente.</div>
         {error && <div className="mb-5"><ErrorFeedback incident={{ ...classifyError(new Error(error), "No se pudo gestionar la configuración de la consulta"), resource, action: "Configuración de consulta" }} onOpenSupport={onReportError} /></div>}
        {loading ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">Cargando configuración de la instalación…</div> : <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]"><Field label="Nombre de la consulta"><input value={name} onChange={(event) => setName(event.target.value)} className={inputClass} /></Field><div className="flex items-end gap-2 pb-0.5"><span className={`rounded-full px-3 py-2 text-xs font-bold ${configuration?.status === "PUBLISHED" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{configuration?.status === "PUBLISHED" ? "Publicada" : "Borrador"}</span><span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">v{configuration?.version ?? 1}</span></div></div>
          <Field label="Descripción"><textarea value={description} onChange={(event) => setDescription(event.target.value)} className={`${inputClass} min-h-20 resize-y py-2`} /></Field>
          <Field label="SQL parametrizado" hint="En Stock usa :installationId y la vista lógica stock. Al publicar, la tabla ejecuta esta consulta en modo lectura con límite de filas y tiempo máximo."><div className="relative"><Code2 size={16} className="pointer-events-none absolute left-3 top-3 text-slate-400" /><textarea value={sqlText} onChange={(event) => setSqlText(event.target.value)} className={`${inputClass} min-h-36 resize-y py-3 pl-10 font-mono text-xs leading-6`} spellCheck={false} /></div></Field>
          <Field label="Parámetros disponibles" hint="Separados por comas. Se rellenan automáticamente desde el contexto de sesión."><input value={parametersText} onChange={(event) => setParametersText(event.target.value)} className={inputClass} /></Field>
          <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-sm font-bold text-slate-800">Campos de la tabla</h3><p className="mt-1 text-xs leading-5 text-slate-500">Define el tipo de dato y la apariencia sin escribir JSON. Las reglas se aplican de arriba abajo.</p></div><button type="button" onClick={addColumn} className="flex min-h-10 items-center gap-2 rounded-lg bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"><Plus size={16} />Añadir campo</button></div><div className="mt-4 space-y-3">{columns.map((column, index) => <ColumnEditor key={index} column={column} index={index} onChange={updateColumn} onRemove={removeColumn} onAddCondition={addCondition} onUpdateCondition={updateCondition} onRemoveCondition={removeCondition} />)}</div></section>
          <div className="grid gap-5 lg:grid-cols-2"><Field label="Filtros disponibles" hint="Una línea por filtro: clave | etiqueta | tipo"><div className="relative"><Filter size={16} className="pointer-events-none absolute left-3 top-3 text-slate-400" /><textarea value={filtersText} onChange={(event) => setFiltersText(event.target.value)} className={`${inputClass} min-h-36 resize-y py-3 pl-10 font-mono text-xs leading-6`} /></div></Field><div className="space-y-4"><Field label="Ordenación inicial" hint="Ejemplo: lastMovement desc"><input value={defaultSort} onChange={(event) => setDefaultSort(event.target.value)} className={inputClass} /></Field><Field label="Acciones de la vista" hint="Separadas por comas"><input value={actionsText} onChange={(event) => setActionsText(event.target.value)} className={inputClass} /></Field></div></div>
          <Field label="Roles con acceso" hint="Separados por comas"><input value={allowedRolesText} onChange={(event) => setAllowedRolesText(event.target.value)} className={inputClass} /></Field>
        </div>}
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-6 py-4"><span className={`flex items-center gap-1.5 text-xs font-semibold ${feedback ? "text-emerald-600" : "text-slate-400"}`}>{feedback && <Check size={15} />}{feedback || "Los cambios se aplican solo a esta instalación"}</span><div className="flex gap-2"><button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button><button type="button" disabled={saving || loading} onClick={saveDraft} className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><Save size={16} />Guardar borrador</button><button type="button" disabled={saving || loading} onClick={publish} className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"><Send size={16} />Publicar versión</button></div></footer>
    </aside>
  </div>;
}

function ColumnEditor({ column, index, onChange, onRemove, onAddCondition, onUpdateCondition, onRemoveCondition }: { column: QueryConfigurationColumn; index: number; onChange: (index: number, change: Partial<QueryConfigurationColumn>) => void; onRemove: (index: number) => void; onAddCondition: (index: number) => void; onUpdateCondition: (columnIndex: number, conditionIndex: number, change: Partial<QueryConfigurationCondition>) => void; onRemoveCondition: (columnIndex: number, conditionIndex: number) => void }) {
  return <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"><div className="grid items-end gap-3 md:grid-cols-[1.15fr_1.15fr_1fr_auto_auto_auto]"><Field label="Campo"><input value={column.key} onChange={(event) => onChange(index, { key: event.target.value })} className={smallInputClass} /></Field><Field label="Etiqueta"><input value={column.label} onChange={(event) => onChange(index, { label: event.target.value })} className={smallInputClass} /></Field><Field label="Tipo"><select value={column.type} onChange={(event) => onChange(index, { type: event.target.value as QueryColumnType })} className={smallInputClass}>{columnTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></Field><label className="flex h-9 items-center gap-2 text-xs font-semibold text-slate-600"><input type="checkbox" checked={column.visible} onChange={(event) => onChange(index, { visible: event.target.checked })} />Visible</label><button type="button" onClick={() => onChange(index, { badge: !column.badge })} className={`grid h-9 w-9 place-items-center rounded-lg border ${column.badge ? "border-brand bg-blue-50 text-brand" : "border-slate-200 text-slate-400"}`} aria-label={`${column.badge ? "Quitar" : "Añadir"} etiqueta visual`} title="Usar etiqueta visual"><Palette size={16} /></button><button type="button" onClick={() => onRemove(index)} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600" aria-label={`Eliminar campo ${column.label}`}><Trash2 size={16} /></button></div><details className="mt-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"><summary className="cursor-pointer text-xs font-bold text-slate-600">Formato y colores</summary><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Field label="Decimales"><input type="number" min="0" max="4" value={column.decimals ?? 0} onChange={(event) => onChange(index, { decimals: Number(event.target.value) })} className={smallInputClass} /></Field><Field label="Sufijo"><input value={column.suffix ?? (column.type === "percentage" ? "%" : "")} onChange={(event) => onChange(index, { suffix: event.target.value })} className={smallInputClass} placeholder="%, uds…" /></Field><ColorField label="Fondo fijo" value={column.background} onChange={(value) => onChange(index, { background: value })} /><ColorField label="Texto" value={column.textColor} onChange={(value) => onChange(index, { textColor: value })} /></div><div className="mt-4 border-t border-slate-200 pt-3"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold text-slate-600">Color condicional</p><p className="text-[11px] text-slate-400">Ejemplo: si estado = Bloqueado, fondo rojo.</p></div><button type="button" onClick={() => onAddCondition(index)} className="flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"><Plus size={14} />Añadir regla</button></div><div className="mt-2 space-y-2">{(column.conditions ?? []).map((condition, conditionIndex) => <div key={conditionIndex} className="grid items-end gap-2 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]"><Field label="Operador"><select value={condition.operator} onChange={(event) => onUpdateCondition(index, conditionIndex, { operator: event.target.value as QueryConditionOperator })} className={smallInputClass}>{operators.map((operator) => <option key={operator.value} value={operator.value}>{operator.label}</option>)}</select></Field><Field label="Valor"><input value={String(condition.value)} onChange={(event) => onUpdateCondition(index, conditionIndex, { value: event.target.value })} className={smallInputClass} /></Field><ColorField label="Fondo" value={condition.background} onChange={(value) => onUpdateCondition(index, conditionIndex, { background: value })} /><ColorField label="Texto" value={condition.textColor} onChange={(value) => onUpdateCondition(index, conditionIndex, { textColor: value })} /><button type="button" onClick={() => onRemoveCondition(index, conditionIndex)} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Eliminar regla"><Trash2 size={14} /></button></div>)}</div></div></details></article>;
}

function ColorField({ label, value, onChange }: { label: string; value?: string; onChange: (value: string | undefined) => void }) {
  const { t } = useI18n();
  return <label className="block"><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-400">{t(label)}</span><div className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2"><input type="color" value={value || "#ffffff"} onChange={(event) => onChange(event.target.value)} className="h-6 w-7 cursor-pointer border-0 bg-transparent p-0" /><button type="button" onClick={() => onChange(undefined)} className="text-[11px] font-semibold text-slate-400 hover:text-slate-700">{t("Quitar")}</button></div></label>;
}

const inputClass = "h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-ink outline-none transition focus:border-brand focus:bg-white focus:ring-4 focus:ring-blue-100";
const smallInputClass = "h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-ink outline-none transition focus:border-brand focus:ring-4 focus:ring-blue-100";

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  const { t } = useI18n();
  return <label className="block"><span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">{t(label)}</span>{children}{hint && <span className="mt-1.5 block text-xs leading-5 text-slate-400">{t(hint)}</span>}</label>;
}
