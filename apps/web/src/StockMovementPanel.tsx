import { useState, type FormEvent } from "react";
import { ArrowDownToLine, ArrowUpFromLine, LoaderCircle, X } from "lucide-react";
import type { AuthSession } from "./auth";
import { createStockMovement, type StockMovementInput } from "./workspace";
import { useI18n } from "./i18n";

const initialForm: StockMovementInput = { sku: "", lot: "", type: "IN", quantity: 1, reason: "", origin: "", destination: "", sourceDocument: "" };

export function StockMovementPanel({ session, initialValues, onClose, onSaved }: { session: AuthSession; initialValues?: Partial<StockMovementInput>; onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n();
  const [form, setForm] = useState<StockMovementInput>({ ...initialForm, ...initialValues });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const update = <K extends keyof StockMovementInput>(key: K, value: StockMovementInput[K]) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await createStockMovement(session.token, { ...form, sku: form.sku.trim(), lot: form.lot?.trim(), reason: form.reason.trim(), origin: form.origin?.trim(), destination: form.destination?.trim(), sourceDocument: form.sourceDocument?.trim() });
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("No se pudo registrar el movimiento"));
    } finally {
      setSaving(false);
    }
  };

  return <div className="fixed inset-0 z-50 !mt-0 flex items-center justify-center bg-slate-950/35 p-4 sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="movement-title">
      <header className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
        <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">{t("Operación de almacén")}</p><h2 id="movement-title" className="mt-1 text-xl font-bold text-ink">{t("Nuevo movimiento")}</h2><p className="mt-1 text-sm text-slate-500">{t("Actualiza existencias y deja trazabilidad en la auditoría.")}</p></div>
        <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label={t("Cerrar")}><X size={19} /></button>
      </header>
      <form onSubmit={submit} className="space-y-5 px-6 py-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_0.8fr]">
          <label className="block text-sm font-semibold text-slate-700">SKU<input required value={form.sku} onChange={(event) => update("sku", event.target.value)} placeholder="Ej. SKU-10024" className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 font-normal outline-none ring-brand/20 focus:border-brand focus:ring-4" /></label>
          <label className="block text-sm font-semibold text-slate-700">{t("Lote")} <span className="font-normal text-slate-400">({t("opcional")})</span><input value={form.lot} onChange={(event) => update("lot", event.target.value)} placeholder="L2025-001" className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 font-normal outline-none ring-brand/20 focus:border-brand focus:ring-4" /></label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-slate-700">{t("Tipo")}<select value={form.type} onChange={(event) => update("type", event.target.value as StockMovementInput["type"])} className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-normal outline-none ring-brand/20 focus:border-brand focus:ring-4"><option value="IN">{t("Entrada / ajuste positivo")}</option><option value="OUT">{t("Salida / ajuste negativo")}</option></select></label>
          <label className="block text-sm font-semibold text-slate-700">{t("Cantidad")}<input required min="1" step="1" type="number" value={form.quantity} onChange={(event) => update("quantity", Number(event.target.value))} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 font-normal outline-none ring-brand/20 focus:border-brand focus:ring-4" /></label>
        </div>
        <label className="block text-sm font-semibold text-slate-700">{t("Motivo")}<input required value={form.reason} onChange={(event) => update("reason", event.target.value)} placeholder={t("Reposición, ajuste de inventario…")} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 font-normal outline-none ring-brand/20 focus:border-brand focus:ring-4" /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-slate-700">{t("Origen")} <span className="font-normal text-slate-400">({t("opcional")})</span><input value={form.origin} onChange={(event) => update("origin", event.target.value)} placeholder={t("Recepción, ubicación…")} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 font-normal outline-none ring-brand/20 focus:border-brand focus:ring-4" /></label>
          <label className="block text-sm font-semibold text-slate-700">{t("Destino")} <span className="font-normal text-slate-400">({t("opcional")})</span><input value={form.destination} onChange={(event) => update("destination", event.target.value)} placeholder="A-01-02-03" className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 font-normal outline-none ring-brand/20 focus:border-brand focus:ring-4" /></label>
        </div>
        <label className="block text-sm font-semibold text-slate-700">{t("Documento origen")} <span className="font-normal text-slate-400">({t("opcional")})</span><input value={form.sourceDocument} onChange={(event) => update("sourceDocument", event.target.value)} placeholder={t("Albarán, pedido o referencia")} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 font-normal outline-none ring-brand/20 focus:border-brand focus:ring-4" /></label>
        <div className={`flex items-start gap-3 rounded-lg px-3 py-3 text-sm ${form.type === "IN" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}><span className="mt-0.5">{form.type === "IN" ? <ArrowDownToLine size={17} /> : <ArrowUpFromLine size={17} />}</span><p>{t(form.type === "IN" ? "La cantidad se sumará a las existencias disponibles." : "La salida se rechazará si supera la cantidad disponible.")}</p></div>
        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p>}
        <footer className="flex justify-end gap-3 border-t border-slate-100 pt-5"><button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">{t("Cancelar")}</button><button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60">{saving && <LoaderCircle size={16} className="animate-spin" />}{t("Registrar movimiento")}</button></footer>
      </form>
    </section>
  </div>;
}
