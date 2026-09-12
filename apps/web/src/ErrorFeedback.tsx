import { AlertTriangle, LifeBuoy, RefreshCw } from "lucide-react";
import type { SupportIncident } from "./error-utils";

type ErrorFeedbackProps = {
  incident: SupportIncident;
  onRetry?: () => void;
  onOpenSupport?: (incident: SupportIncident) => void;
  compact?: boolean;
};

export function ErrorFeedback({ incident, onRetry, onOpenSupport, compact = false }: ErrorFeedbackProps) {
  return <section role="alert" className={`rounded-xl border border-red-200 bg-red-50 text-red-950 ${compact ? "p-3" : "p-4"}`}>
    <div className="flex items-start gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-red-600 shadow-sm"><AlertTriangle size={18} /></span>
      <div className="min-w-0 flex-1">
        <h3 className="font-bold">{incident.title}</h3>
        <p className="mt-1 text-sm leading-5 text-red-800">{incident.message}</p>
        {!compact && <p className="mt-2 text-xs leading-5 text-red-700"><strong>Qué puedes hacer:</strong> {incident.hint}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {onRetry && <button type="button" onClick={onRetry} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-red-800 shadow-sm ring-1 ring-red-200 hover:bg-red-100"><RefreshCw size={15} />Reintentar</button>}
          {onOpenSupport && <button type="button" onClick={() => onOpenSupport(incident)} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-800 hover:bg-red-100"><LifeBuoy size={15} />Ayuda de soporte</button>}
        </div>
        {!compact && <p className="mt-3 text-[11px] font-semibold tracking-wide text-red-700">Código: <span className="font-mono">{incident.code}</span></p>}
      </div>
    </div>
  </section>;
}
