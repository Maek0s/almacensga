import { useMemo, useState, type FormEvent } from "react";
import { LoaderCircle, Save, X } from "lucide-react";
import type { AuthSession } from "./auth";
import { createWorkspaceRecord, type WorkspaceRecordInput, type WorkspaceResource } from "./workspace";
import { useI18n } from "./i18n";

type FieldDefinition = { key: string; label: string; placeholder?: string; type?: "text" | "number" | "date" };

const fieldDefinitions: Partial<Record<WorkspaceResource, FieldDefinition[]>> = {
  receipts: [
    { key: "reference", label: "Referencia", placeholder: "RC-NEW-001" },
    { key: "supplier", label: "Proveedor", placeholder: "Proveedor" },
    { key: "scheduledDate", label: "Fecha planificada", type: "date" },
    { key: "dock", label: "Muelle", placeholder: "M1" },
    { key: "units", label: "Unidades", type: "number" },
    { key: "status", label: "Estado", placeholder: "Pendiente" },
  ],
  picking: [
    { key: "reference", label: "Referencia", placeholder: "PK-NEW-001" },
    { key: "order", label: "Pedido", placeholder: "PED-20260001" },
    { key: "customer", label: "Cliente", placeholder: "Cliente" },
    { key: "picker", label: "Operario", placeholder: "Sin asignar" },
    { key: "units", label: "Unidades", type: "number" },
    { key: "status", label: "Estado", placeholder: "Pendiente" },
  ],
  shipments: [
    { key: "reference", label: "Referencia", placeholder: "EX-NEW-001" },
    { key: "order", label: "Pedido", placeholder: "PED-20260001" },
    { key: "customer", label: "Cliente", placeholder: "Cliente" },
    { key: "shippingDate", label: "Fecha de salida", type: "date" },
    { key: "carrier", label: "Transportista", placeholder: "Transportista" },
    { key: "status", label: "Estado", placeholder: "Pendiente" },
  ],
  locations: [
    { key: "code", label: "Ubicación", placeholder: "A-01-01-01" },
    { key: "warehouse", label: "Almacén", placeholder: "MADRID01_MAIN" },
    { key: "zone", label: "Zona", placeholder: "A" },
    { key: "type", label: "Tipo", placeholder: "Picking" },
    { key: "capacity", label: "Capacidad", type: "number" },
    { key: "status", label: "Estado", placeholder: "Disponible" },
  ],
  inventory: [
    { key: "reference", label: "Referencia", placeholder: "INV-NEW-001" },
    { key: "zone", label: "Zona", placeholder: "A" },
    { key: "location", label: "Ubicación", placeholder: "A-01-01-01" },
    { key: "sku", label: "SKU", placeholder: "SKU-100001" },
    { key: "expected", label: "Cantidad teórica", type: "number" },
    { key: "status", label: "Estado", placeholder: "Pendiente" },
  ],
  movements: [
    { key: "reference", label: "Referencia", placeholder: "MV-NEW-001" },
    { key: "type", label: "Tipo", placeholder: "Ajuste" },
    { key: "sku", label: "SKU", placeholder: "SKU-100001" },
    { key: "quantity", label: "Cantidad", type: "number" },
    { key: "reason", label: "Motivo", placeholder: "Reubicación" },
    { key: "status", label: "Estado", placeholder: "Pendiente" },
  ],
  replenishment: [
    { key: "reference", label: "Referencia", placeholder: "REP-NEW-001" },
    { key: "sku", label: "SKU", placeholder: "SKU-100001" },
    { key: "sourceLocation", label: "Origen", placeholder: "RES-A01" },
    { key: "targetLocation", label: "Destino", placeholder: "PK-A01" },
    { key: "quantity", label: "Cantidad", type: "number" },
    { key: "status", label: "Estado", placeholder: "Pendiente" },
  ],
  products: [
    { key: "sku", label: "SKU", placeholder: "SKU-NEW-001" },
    { key: "description", label: "Descripción", placeholder: "Artículo" },
    { key: "family", label: "Familia", placeholder: "Embalaje" },
    { key: "unit", label: "Unidad", placeholder: "uds" },
    { key: "minStock", label: "Stock mínimo", type: "number" },
    { key: "status", label: "Estado", placeholder: "Activo" },
  ],
  suppliers: [
    { key: "code", label: "Código", placeholder: "PRV-NEW-001" },
    { key: "name", label: "Nombre", placeholder: "Proveedor" },
    { key: "taxId", label: "NIF", placeholder: "B00000000" },
    { key: "contact", label: "Contacto", placeholder: "Persona de contacto" },
    { key: "email", label: "Email", placeholder: "compras@proveedor.demo" },
    { key: "status", label: "Estado", placeholder: "Activo" },
  ],
  customers: [
    { key: "code", label: "Código", placeholder: "CLI-NEW-001" },
    { key: "name", label: "Nombre", placeholder: "Cliente" },
    { key: "channel", label: "Canal", placeholder: "B2B" },
    { key: "segment", label: "Segmento", placeholder: "Estándar" },
    { key: "email", label: "Email", placeholder: "operaciones@cliente.demo" },
    { key: "status", label: "Estado", placeholder: "Activo" },
  ],
  queries: [
    { key: "code", label: "Código", placeholder: "QRY-NEW-001" },
    { key: "name", label: "Nombre", placeholder: "Consulta operativa" },
    { key: "category", label: "Categoría", placeholder: "Operaciones" },
    { key: "owner", label: "Propietario", placeholder: "Equipo SGA" },
    { key: "status", label: "Estado", placeholder: "Borrador" },
  ],
  users: [
    { key: "username", label: "Usuario", placeholder: "nuevo.usuario" },
    { key: "displayName", label: "Nombre visible", placeholder: "Nuevo usuario" },
    { key: "email", label: "Correo", placeholder: "usuario@nortelog.local" },
    { key: "password", label: "Contraseña inicial", placeholder: "ChangeMe123!" },
    { key: "roleKey", label: "Clave de rol", placeholder: "WAREHOUSE_MANAGER" },
    { key: "installationCode", label: "Instalación", placeholder: "MADRID01" },
  ],
  roles: [
    { key: "key", label: "Clave", placeholder: "SUPERVISOR" },
    { key: "name", label: "Nombre", placeholder: "Supervisor de almacén" },
    { key: "permissionKeys", label: "Permisos", placeholder: "workspace.read, workspace.operate" },
  ],
};

const titles: Partial<Record<WorkspaceResource, string>> = {
  receipts: "Nueva recepción",
  picking: "Nueva ola de picking",
  shipments: "Nueva expedición",
  locations: "Nueva ubicación",
  inventory: "Nuevo conteo de inventario",
  replenishment: "Generar reposición",
  products: "Nuevo artículo",
  suppliers: "Nuevo proveedor",
  customers: "Nuevo cliente",
  queries: "Nueva consulta",
  users: "Nuevo usuario",
  roles: "Nuevo rol",
};

export function WorkspaceRecordPanel({ resource, session, onClose, onSaved }: { resource: WorkspaceResource; session: AuthSession; onClose: () => void; onSaved: (message: string) => void }) {
  const { t } = useI18n();
  const fields = useMemo(() => fieldDefinitions[resource] ?? [{ key: "reference", label: "Referencia" }, { key: "status", label: "Estado" }], [resource]);
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((field) => [field.key, field.key === "status" ? "Pendiente" : ""] )));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const title = titles[resource] ?? "Nuevo registro";

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload: WorkspaceRecordInput = Object.fromEntries(Object.entries(values).map(([key, value]) => {
        const field = fields.find((candidate) => candidate.key === key);
        if (resource === "roles" && key === "permissionKeys") return [key, value.split(",").map((permission) => permission.trim()).filter(Boolean)];
        return [key, field?.type === "number" ? Number(value || 0) : value.trim()];
      }));
      await createWorkspaceRecord(resource, session.token, payload);
      onSaved(t("Registro guardado correctamente."));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("No se pudo crear el registro"));
    } finally {
      setSaving(false);
    }
  };

  return <div className="fixed inset-0 z-50 !mt-0 flex items-center justify-center bg-slate-950/35 p-4 sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
    <section className="max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="workspace-record-title">
      <header className="flex items-start justify-between border-b border-slate-100 px-6 py-5"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">{t("Operación de almacén")}</p><h2 id="workspace-record-title" className="mt-1 text-xl font-bold text-ink">{t(title)}</h2><p className="mt-1 text-sm text-slate-500">{t("Completa los datos para registrar la operación y continuar con el proceso.")}</p></div><button type="button" onClick={onClose} disabled={saving} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label={t("Cerrar")}><X size={19} /></button></header>
      <form onSubmit={submit} className="space-y-5 px-6 py-5"><div className="grid gap-4 sm:grid-cols-2">{fields.map((field) => <label key={field.key} className="block text-sm font-semibold text-slate-700">{t(field.label)}<input required={field.key === "reference" || field.key === "code" || field.key === "name" || field.key === "sku" || field.key === "username" || field.key === "key"} type={field.type ?? "text"} value={values[field.key] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))} placeholder={field.placeholder ? t(field.placeholder) : undefined} min={field.type === "number" ? 0 : undefined} className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 font-normal outline-none focus:border-brand focus:ring-4 focus:ring-blue-100" /></label>)}</div>{error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p>}<footer className="flex justify-end gap-3 border-t border-slate-100 pt-5"><button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600">{t("Cancelar")}</button><button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{saving ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />}{saving ? t("Guardando…") : t("Guardar registro")}</button></footer></form>
    </section>
  </div>;
}
