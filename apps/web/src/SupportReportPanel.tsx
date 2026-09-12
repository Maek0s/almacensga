import { useMemo, useState } from "react";
import { CheckCircle2, Copy, FileImage, LifeBuoy, Send, X } from "lucide-react";
import type { AuthSession } from "./auth";
import type { SupportIncident } from "./error-utils";
import { reportSupportIncident } from "./workspace";

type SupportReportPanelProps = { session: AuthSession; incident: SupportIncident; onClose: () => void };

const readFileAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(new Error("No se pudo leer la captura"));
  reader.readAsDataURL(file);
});

export function SupportReportPanel({ session, incident, onClose }: SupportReportPanelProps) {
  const [observations, setObservations] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [screenshotDataUrl, setScreenshotDataUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [reference, setReference] = useState("");
  const automaticDescription = `Fallo detectado automáticamente en ${incident.resource ?? "la pantalla actual"}. Ruta: ${incident.route}.`;
  const reportText = useMemo(() => [`Incidencia SGA`, `Código: ${incident.code}`, `Módulo: ${incident.resource ?? "No indicado"}`, `Ruta: ${incident.route}`, `Mensaje: ${incident.message}`, `Detalle técnico: ${incident.technicalMessage ?? "No disponible"}`, `Contexto automático: ${automaticDescription}`, `Observaciones: ${observations || "Ninguna"}`].join("\n"), [automaticDescription, incident, observations]);

  const copyReport = async () => {
    await navigator.clipboard?.writeText(reportText);
    setFeedback("Informe copiado. Puedes pegarlo en el canal habitual de soporte.");
  };

  const selectScreenshot = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 750_000) {
      setFeedback("La captura supera 750 KB. Reduce su tamaño y vuelve a adjuntarla.");
      return;
    }
    try {
      setScreenshot(file);
      setScreenshotDataUrl(await readFileAsDataUrl(file));
      setFeedback("Captura preparada para soporte.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "No se pudo preparar la captura");
    }
  };

  const sendReport = async () => {
    setBusy(true);
    setFeedback("");
    try {
      const result = await reportSupportIncident(session.token, { ...incident, userDescription: `${automaticDescription}${observations.trim() ? ` Observaciones adicionales: ${observations.trim()}` : ""}`, screenshotDataUrl: screenshotDataUrl || undefined, screenshotName: screenshot?.name });
      setReference(result.reference);
      setFeedback(result.message ?? "Incidencia registrada");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "No se pudo enviar la incidencia");
    } finally {
      setBusy(false);
    }
  };

  return <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/40 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="support-report-title">
      <header className="flex items-start justify-between border-b border-slate-100 px-6 py-5"><div className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-brand"><LifeBuoy size={20} /></span><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">Soporte del almacén</p><h2 id="support-report-title" className="mt-1 text-xl font-bold text-ink">Ayuda con una incidencia</h2></div></div><button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-lg text-slate-400 hover:bg-slate-100" aria-label="Cerrar ayuda"><X size={18} /></button></header>
      <div className="space-y-5 px-6 py-5">
        {reference ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><div className="flex items-center gap-2 font-bold"><CheckCircle2 size={18} />Incidencia registrada</div><p className="mt-2">Indica esta referencia a soporte: <strong className="font-mono">{reference}</strong></p>{feedback && <p className="mt-2 text-emerald-800">{feedback}</p>}</div> : <><div className="rounded-xl border border-red-100 bg-red-50 p-4"><p className="font-bold text-red-950">{incident.title}</p><p className="mt-1 text-sm text-red-800">{incident.message}</p><p className="mt-2 text-xs text-red-700">Código técnico: <span className="font-mono">{incident.code}</span></p></div><section className="rounded-xl border border-slate-200 bg-slate-50 p-4" aria-labelledby="support-data-title"><h3 id="support-data-title" className="text-sm font-bold text-slate-800">Datos que se enviarán</h3><dl className="mt-3 space-y-2 text-sm"><div className="flex gap-2"><dt className="w-20 shrink-0 text-slate-500">Módulo</dt><dd className="font-medium text-slate-700">{incident.resource ?? "Pantalla actual"}</dd></div><div className="flex gap-2"><dt className="w-20 shrink-0 text-slate-500">Mensaje</dt><dd className="font-medium text-slate-700">{incident.message}</dd></div><div className="flex gap-2"><dt className="w-20 shrink-0 text-slate-500">Ruta</dt><dd className="break-all font-mono text-xs text-slate-600">{incident.route}</dd></div></dl><p className="mt-3 text-xs leading-5 text-slate-500">El contexto técnico se adjunta automáticamente para soporte y no se puede borrar.</p></section><label className="block text-sm font-semibold text-slate-700">Observaciones adicionales <span className="font-normal text-slate-400">(opcional)</span><textarea value={observations} onChange={(event) => setObservations(event.target.value)} className="mt-2 min-h-20 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-4 focus:ring-blue-100" placeholder="Añade algún detalle útil para soporte…" /></label><div><p className="text-sm font-semibold text-slate-700">Captura de pantalla <span className="font-normal text-slate-400">(opcional)</span></p><label className="mt-2 flex min-h-16 cursor-pointer items-center gap-3 rounded-lg border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-600 hover:border-brand hover:bg-blue-50"><FileImage size={19} className="text-brand" /><span>{screenshot ? screenshot.name : "Adjuntar captura (máx. 750 KB)"}</span><input type="file" accept="image/*" className="sr-only" onChange={(event) => void selectScreenshot(event.target.files?.[0])} /></label><p className="mt-1 text-xs text-slate-400">Evita incluir datos personales si no son necesarios.</p></div></>}
        {feedback && !reference && <p role="status" className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm text-blue-800">{feedback}</p>}
        {!reference && <div className="flex flex-wrap justify-between gap-2"><button type="button" onClick={() => void copyReport()} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Copy size={15} />Copiar informe</button><button type="button" disabled={busy} onClick={() => void sendReport()} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"><Send size={15} />{busy ? "Enviando…" : "Enviar a soporte"}</button></div>}
      </div>
      <footer className="flex justify-end border-t border-slate-100 px-6 py-4"><button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">{reference ? "Cerrar" : "Cancelar"}</button></footer>
    </section>
  </div>;
}
