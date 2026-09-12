import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Clock3, Cpu, Database, Gauge, RefreshCw, Server, XCircle } from "lucide-react";
import type { AuthSession } from "./auth";
import { useI18n } from "./i18n";
import { classifyError, type SupportIncident } from "./error-utils";
import { fetchDeveloperMetrics, type ServerMetrics } from "./workspace";

type DeveloperObservabilityPanelProps = { session: AuthSession; onReportError?: (incident: SupportIncident) => void };

const formatBytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const formatDuration = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`;
};
const formatDate = (value: string) => new Intl.DateTimeFormat("es-ES", { dateStyle: "short", timeStyle: "medium" }).format(new Date(value));

export function DeveloperObservabilityPanel({ session, onReportError }: DeveloperObservabilityPanelProps) {
  const { t } = useI18n();
  const [metrics, setMetrics] = useState<ServerMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadMetrics = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setMetrics(await fetchDeveloperMetrics(session.token));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar las métricas del servidor");
    } finally {
      setLoading(false);
    }
  }, [session.token]);

  useEffect(() => { void loadMetrics(); }, [loadMetrics]);

  const routes = useMemo(() => Object.entries(metrics?.routes ?? {}).sort(([, left], [, right]) => right.averageMs - left.averageMs), [metrics]);
  const reportError = () => onReportError?.({ ...classifyError(new Error(error), "No se pudieron cargar las métricas del servidor"), title: "No se puede cargar el monitor del servidor", message: "El panel técnico no ha podido consultar el estado actual del servidor." });

  return <section className="space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-brand"><Activity size={15} />Developer</div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink">{t("Monitor del servidor")}</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">{t("Estado real de la API, la base de datos y las peticiones para detectar cuellos de botella.")}</p>
      </div>
      <button type="button" onClick={() => void loadMetrics()} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"><RefreshCw size={16} className={loading ? "animate-spin" : ""} />{loading ? t("Actualizando…") : t("Actualizar métricas")}</button>
    </header>

    {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><div className="flex items-start gap-3"><AlertTriangle size={19} className="mt-0.5 shrink-0" /><div><p className="font-semibold">{t("No se pudo consultar el monitor")}</p><p className="mt-1">{error}</p></div></div><div className="flex gap-2"><button type="button" onClick={() => void loadMetrics()} className="rounded-lg border border-red-200 bg-white px-3 py-2 font-semibold hover:bg-red-100">{t("Reintentar")}</button><button type="button" onClick={reportError} className="rounded-lg bg-red-700 px-3 py-2 font-semibold text-white hover:bg-red-800">{t("Enviar a soporte")}</button></div></div>}

    {metrics && <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatusCard icon={Server} label={t("API") } value={t("Conectada")} detail={`${t("Tiempo activo")}: ${formatDuration(metrics.uptimeSeconds)}`} healthy />
        <StatusCard icon={Database} label={t("Base de datos") } value={metrics.database.status === "connected" ? t("Conectada") : t("No disponible")} detail={metrics.database.latencyMs === null ? t("Sin respuesta") : `${t("Latencia")}: ${metrics.database.latencyMs} ms`} healthy={metrics.database.status === "connected"} />
        <StatusCard icon={Gauge} label={t("Consulta más lenta") } value={`${Math.max(0, ...Object.values(metrics.routes).map((route) => route.maxMs))} ms`} detail={`${t("Umbral")}: ${metrics.slowRequestThresholdMs} ms`} healthy={true} />
        <StatusCard icon={Cpu} label={t("Memoria del proceso") } value={formatBytes(metrics.memory.heapUsed)} detail={`${t("Reservado")}: ${formatBytes(metrics.memory.heapTotal)}`} healthy={true} />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-panel">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4"><div><h2 className="font-bold text-ink">{t("Rutas y tiempos")}</h2><p className="mt-1 text-sm text-slate-500">{t("Ordenadas por tiempo medio para localizar las consultas que conviene optimizar.")}</p></div><span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-brand">{Object.keys(metrics.routes).length} {t("rutas")}</span></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3 font-bold">{t("Ruta")}</th><th className="px-5 py-3 font-bold">{t("Peticiones")}</th><th className="px-5 py-3 font-bold">{t("Errores")}</th><th className="px-5 py-3 font-bold">{t("Media")}</th><th className="px-5 py-3 font-bold">{t("Máximo")}</th></tr></thead><tbody className="divide-y divide-slate-100">{routes.map(([route, metric]) => <tr key={route} className="hover:bg-slate-50"><td className="px-5 py-3 font-mono text-xs text-slate-700">{route}</td><td className="px-5 py-3 text-slate-600">{metric.count}</td><td className={`px-5 py-3 font-semibold ${metric.errors > 0 ? "text-red-600" : "text-slate-600"}`}>{metric.errors}</td><td className="px-5 py-3 font-semibold text-slate-700">{metric.averageMs} ms</td><td className="px-5 py-3 text-slate-600">{metric.maxMs} ms</td></tr>)}{routes.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-500">{t("Todavía no hay peticiones registradas")}</td></tr>}</tbody></table></div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-panel">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4"><div><h2 className="font-bold text-ink">{t("Peticiones lentas recientes")}</h2><p className="mt-1 text-sm text-slate-500">{t("Solo se guardan temporalmente en memoria del servidor para ayudar a investigar el problema.")}</p></div><span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800"><Clock3 size={13} />≥ {metrics.slowRequestThresholdMs} ms</span></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3 font-bold">{t("Momento")}</th><th className="px-5 py-3 font-bold">{t("Ruta")}</th><th className="px-5 py-3 font-bold">{t("Estado")}</th><th className="px-5 py-3 font-bold">{t("Duración")}</th><th className="px-5 py-3 font-bold">{t("Referencia")}</th></tr></thead><tbody className="divide-y divide-slate-100">{metrics.slowRequests.map((request) => <tr key={`${request.requestId}-${request.completedAt}`} className="hover:bg-slate-50"><td className="px-5 py-3 whitespace-nowrap text-slate-600">{formatDate(request.completedAt)}</td><td className="px-5 py-3 font-mono text-xs text-slate-700">{request.method} {request.path}</td><td className="px-5 py-3"><span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${request.statusCode >= 500 ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}>{request.statusCode >= 500 ? <XCircle size={13} /> : <AlertTriangle size={13} />}{request.statusCode}</span></td><td className="px-5 py-3 font-semibold text-slate-700">{request.durationMs} ms</td><td className="px-5 py-3 font-mono text-xs text-slate-500">{request.requestId}</td></tr>)}{metrics.slowRequests.length === 0 && <tr><td colSpan={5} className="px-5 py-10 text-center"><CheckCircle2 size={24} className="mx-auto text-emerald-500" /><p className="mt-2 text-sm font-semibold text-slate-700">{t("No se han detectado peticiones lentas en este arranque")}</p><p className="mt-1 text-xs text-slate-500">{t("El registro se reinicia cuando Render reinicia el servicio.")}</p></td></tr>}</tbody></table></div>
      </section>

      <p className="text-xs text-slate-400">{t("Última actualización")}: {formatDate(metrics.generatedAt)} · {t("Las métricas se calculan en el servidor conectado a la base de datos.")}</p>
    </>}
  </section>;
}

function StatusCard({ icon: Icon, label, value, detail, healthy }: { icon: typeof Activity; label: string; value: string; detail: string; healthy: boolean }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel"><div className="flex items-center justify-between"><div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-brand"><Icon size={19} /></div><span className={`inline-flex items-center gap-1 text-xs font-semibold ${healthy ? "text-emerald-700" : "text-red-700"}`}>{healthy ? <CheckCircle2 size={14} /> : <XCircle size={14} />}{healthy ? "OK" : "Error"}</span></div><p className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 text-xl font-bold text-ink">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></article>;
}
