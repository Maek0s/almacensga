import { Component, useEffect, useRef, useState, type ErrorInfo, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpRight,
  AlertTriangle,
  BarChart3,
  Bell,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Code2,
  Database,
  ExternalLink,
  FileCode2,
  House,
  LoaderCircle,
  LogOut,
  LifeBuoy,
  Menu,
  MapPin,
  PackageOpen,
  RotateCcw,
  Search,
  Settings,
  Truck,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { getCurrentSession, logout, sessionStorageKey, type AuthSession } from "./auth";
import { apiUrl } from "./api";
import { I18nProvider, LanguageSelector, localeForLanguage, useI18n } from "./i18n";
import { LoginPage } from "./LoginPage";
import { classifyError, type SupportIncident } from "./error-utils";
import { SupportReportPanel } from "./SupportReportPanel";
import { canManageConfiguration, executeLoopTool, executeSqlTool, importXmlTool, publishUpdater, type WorkspaceResource } from "./workspace";
import { WarehouseModule } from "./WarehouseModule";

type Health = "checking" | "connected" | "unavailable";
type DashboardMetrics = { stock: number; pendingReceipts: number; pickingTasks: number; shipmentsToday: number };
type View = "dashboard" | "stock" | "receipts" | "picking" | "shipments" | "installations" | "locations" | "movements" | "inventory" | "queries" | "users" | "products" | "replenishment" | "suppliers" | "customers" | "integrations" | "audit" | "roles" | "tools";

const navigation = [
  { label: "Inicio", icon: House, view: "dashboard" as View },
  { label: "Recepción", icon: ArrowDownToLine, view: "receipts" as View },
  { label: "Movimientos", icon: ArrowLeftRight, view: "movements" as View },
  { label: "Ubicaciones", icon: MapPin, view: "locations" as View },
  { label: "Picking", icon: PackageOpen, view: "picking" as View },
  { label: "Expediciones", icon: Truck, view: "shipments" as View },
  { label: "Stock", icon: Boxes, view: "stock" as View },
  { label: "Inventario físico", icon: ClipboardList, view: "inventory" as View },
  { label: "Maestro de artículos", icon: Boxes, view: "products" as View },
  { label: "Reposición", icon: ArrowUpRight, view: "replenishment" as View },
];

const viewTitles: Record<View, string> = {
  dashboard: "Dashboard",
  stock: "Stock y existencias",
  receipts: "Recepciones",
  picking: "Tareas de picking",
  shipments: "Expediciones",
  installations: "Instalaciones",
  locations: "Ubicaciones",
  movements: "Movimientos",
  inventory: "Inventario físico",
  queries: "Consultas",
  users: "Usuarios y roles",
  products: "Maestro de artículos",
  replenishment: "Reposición",
  suppliers: "Proveedores",
  customers: "Clientes",
  integrations: "Integraciones",
  audit: "Auditoría",
  roles: "Roles y permisos",
  tools: "Herramientas",
};

const viewFromLocation = (): View => {
  const candidate = window.location.hash.replace(/^#\/?/, "") as View;
  return candidate in viewTitles ? candidate : "dashboard";
};

const initialsFor = (displayName: string) => displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "SG";

const activities = [
  ["Recepción", "RC-10482", "Completado", "text-emerald-700 bg-emerald-50"],
  ["Movimiento", "MV-2081", "En curso", "text-blue-700 bg-blue-50"],
  ["Expedición", "EX-7754", "Completado", "text-emerald-700 bg-emerald-50"],
  ["Picking", "PK-3156", "Pendiente", "text-amber-700 bg-amber-50"],
];

export function App() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const storedSession = sessionStorage.getItem(sessionStorageKey);
    if (!storedSession) {
      setCheckingSession(false);
      return;
    }

    try {
      const parsed = JSON.parse(storedSession) as AuthSession;
      getCurrentSession(parsed.token)
        .then(setSession)
        .catch(() => sessionStorage.removeItem(sessionStorageKey))
        .finally(() => setCheckingSession(false));
    } catch {
      sessionStorage.removeItem(sessionStorageKey);
      setCheckingSession(false);
    }
  }, []);

  return <I18nProvider userKey={session?.user.username}>
    {checkingSession ? <div className="grid min-h-screen place-items-center bg-slate-50 text-sm text-slate-500">Comprobando sesión…</div> : !session ? <LoginPage onLogin={setSession} /> : <DashboardErrorBoundary><Dashboard session={session} onLogout={async () => { await logout(session.token); sessionStorage.removeItem(sessionStorageKey); setSession(null); }} /></DashboardErrorBoundary>}
  </I18nProvider>;
}

type DashboardErrorBoundaryProps = { children: ReactNode };
type DashboardErrorBoundaryState = { hasError: boolean; message: string };

class DashboardErrorBoundary extends Component<DashboardErrorBoundaryProps, DashboardErrorBoundaryState> {
  state: DashboardErrorBoundaryState = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error): DashboardErrorBoundaryState {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Error al renderizar un módulo del SGA", error, errorInfo);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return <main className="grid min-h-screen place-items-center bg-slate-50 px-6"><section className="w-full max-w-lg rounded-2xl border border-red-200 bg-white p-8 text-center shadow-panel"><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-red-50 text-red-600"><AlertTriangle size={26} /></div><h1 className="mt-5 text-xl font-bold text-ink">No se pudo cargar esta sección</h1><p className="mt-2 text-sm leading-6 text-slate-500">La aplicación sigue abierta, pero este módulo encontró un problema de renderizado. Puedes reintentarlo sin cerrar el sistema.</p><p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-left text-xs text-slate-500">Código: <span className="font-mono">MODULO_NO_DISPONIBLE</span>. Si vuelve a ocurrir, avisa a soporte.</p><div className="mt-6 flex justify-center gap-3"><button type="button" onClick={() => this.setState({ hasError: false, message: "" })} className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">Reintentar módulo</button><button type="button" onClick={() => window.location.reload()} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Recargar aplicación</button></div></section></main>;
  }
}

function Dashboard({ session, onLogout }: { session: AuthSession; onLogout: () => Promise<void> }) {
  const { language, t } = useI18n();
  const [health, setHealth] = useState<Health>("checking");
  const [metrics, setMetrics] = useState<DashboardMetrics>({ stock: 0, pendingReceipts: 0, pickingTasks: 0, shipmentsToday: 0 });
  const [activeView, setActiveView] = useState<View>(viewFromLocation);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activityMode, setActivityMode] = useState<"entries" | "outbound" | "movements">("entries");
  const [dashboardMessage, setDashboardMessage] = useState("");
  const [supportIncident, setSupportIncident] = useState<SupportIncident | null>(null);
  const openSupport = (incident: SupportIncident) => setSupportIncident({ ...incident, resource: incident.resource ?? activeView, route: incident.route || window.location.hash || window.location.pathname });
  const openGenericSupport = () => openSupport({ ...classifyError(new Error("Necesito ayuda con una operación del almacén")), title: "Ayuda con una operación", message: "Se enviará el contexto de esta pantalla. Si quieres, añade una observación antes de enviar." });
  const navigate = (view: View) => {
    setActiveView(view);
    setSidebarOpen(false);
    const nextHash = `#/${view}`;
    if (window.location.hash !== nextHash) window.history.pushState({}, "", nextHash);
  };

  useEffect(() => {
    const syncViewFromLocation = () => setActiveView(viewFromLocation());
    window.addEventListener("popstate", syncViewFromLocation);
    window.addEventListener("hashchange", syncViewFromLocation);
    return () => {
      window.removeEventListener("popstate", syncViewFromLocation);
      window.removeEventListener("hashchange", syncViewFromLocation);
    };
  }, []);

  useEffect(() => {
    fetch(apiUrl("/api/dashboard"), { headers: { Authorization: `Bearer ${session.token}` } })
      .then((response) => response.ok ? response.json() as Promise<{ metrics: DashboardMetrics }> : Promise.reject(new Error("Dashboard unavailable")))
      .then((body) => setMetrics(body.metrics))
      .catch(() => setDashboardMessage("No se pudieron actualizar los indicadores del dashboard."));
  }, [session.token]);

  useEffect(() => {
    fetch(apiUrl("/api/health"))
      .then((response) => {
        if (!response.ok) throw new Error("API unavailable");
        setHealth("connected");
      })
      .catch(() => setHealth("unavailable"));
  }, []);

  useEffect(() => {
    if (!sidebarOpen) return;
    const previousBodyOverflow = document.body.style.overflow;
    const previousRootOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousRootOverflow;
    };
  }, [sidebarOpen]);

  return (
    <div className="min-h-screen bg-slate-50 text-ink">
      {sidebarOpen && <button type="button" aria-label="Cerrar navegación" onClick={() => setSidebarOpen(false)} className="fixed inset-0 z-20 bg-slate-950/40 lg:hidden" />}
      <aside className={`sidebar-shell fixed inset-y-0 left-0 z-30 flex flex-col bg-navy text-slate-200 transition-transform duration-200 lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="border-b border-white/10 px-6 py-5">
          <div className="flex items-center gap-3 text-lg font-bold tracking-tight text-white">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white" aria-hidden="true">
              <img src="/favicon.svg" alt="" className="h-6 w-6 object-contain" />
            </span>
            <span className="whitespace-nowrap">ALMACÉN <span className="text-sky-400">SGA</span></span>
          </div>
        </div>

        <div className="border-b border-white/10 px-4 py-4">
          <div className="flex items-center gap-3 rounded-xl bg-white/10 px-3 py-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white">
              <img src="/nortelog-icon.png?v=3" alt="NORTELOG" className="h-8 w-8 object-contain" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white">{session.client.name.toUpperCase()}</p>
              <p className="truncate text-xs text-slate-400">{session.installation.name}</p>
            </div>
          </div>
        </div>

        <SidebarScrollArea>
          <nav className="space-y-1 px-3 py-5" aria-label="Navegación principal">
          <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{t("Operaciones")}</p>
          {navigation.slice(0, 6).map((item) => (
            <NavItem key={item.label} {...item} label={t(item.label)} active={activeView === item.view} onClick={() => navigate(item.view)} />
          ))}
          <p className="px-3 pb-2 pt-6 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{t("Inventario")}</p>
          {navigation.slice(6).map((item) => <NavItem key={item.label} {...item} label={t(item.label)} active={activeView === item.view} onClick={() => navigate(item.view)} />)}
          <p className="px-3 pb-2 pt-6 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{t("Maestros")}</p>
          <NavItem label={t("Proveedores")} icon={Truck} view="suppliers" active={activeView === "suppliers"} onClick={() => navigate("suppliers")} />
          <NavItem label={t("Clientes")} icon={Users} view="customers" active={activeView === "customers"} onClick={() => navigate("customers")} />
          <p className="px-3 pb-2 pt-6 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{t("Sistema")}</p>
          <NavItem label={t("Consultas")} icon={Database} view="queries" active={activeView === "queries"} onClick={() => navigate("queries")} />
          <NavItem label={t("Auditoría")} icon={Database} view="audit" active={activeView === "audit"} onClick={() => navigate("audit")} />
          {canManageConfiguration(session.role.key) && <NavItem label={t("Instalaciones")} icon={Settings} view="installations" active={activeView === "installations"} onClick={() => navigate("installations")} />}
          {canManageConfiguration(session.role.key) && <NavItem label={t("Usuarios y roles")} icon={Users} view="users" active={activeView === "users"} onClick={() => navigate("users")} />}
          {canManageConfiguration(session.role.key) && <NavItem label={t("Roles y permisos")} icon={Users} view="roles" active={activeView === "roles"} onClick={() => navigate("roles")} />}
          {canManageConfiguration(session.role.key) && <NavItem label={t("Integraciones")} icon={Settings} view="integrations" active={activeView === "integrations"} onClick={() => navigate("integrations")} />}
          <NavItem label={t("Herramientas")} icon={Wrench} view="tools" active={activeView === "tools"} onClick={() => navigate("tools")} />
          </nav>
        </SidebarScrollArea>

        <div className="border-t border-white/10 p-4">
          <div className="mb-3 flex items-center gap-2 text-xs text-slate-300">
            <MapPin size={14} className="text-teal" />
            <span className="truncate">{session.installation.name}</span>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-white/5 p-2">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-sky-200 text-xs font-bold text-sky-900">{initialsFor(session.user.displayName)}</div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">{session.user.displayName}</p>
              <p className="truncate text-xs text-slate-400">{session.user.email}</p>
            </div>
          </div>
        </div>
      </aside>

      <main className="ml-0 min-h-screen lg:ml-[258px]">
        <header className="flex h-[70px] items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-8">
          <div className="flex items-center gap-3"><button type="button" onClick={() => setSidebarOpen(true)} className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 lg:hidden" aria-label={t("Abrir navegación")}><Menu size={19} /></button><div className="flex items-center gap-2 text-sm text-slate-400"><button type="button" onClick={() => navigate("dashboard")} className="font-semibold text-brand hover:text-blue-700">{t("Inicio")}</button><span>/</span><span>{t(viewTitles[activeView])}</span></div></div>
          <div className="flex items-center gap-5">
            <div className="hidden items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-400 md:flex"><Search size={16} /><span>{t("Buscar en todo el sistema...")}</span><kbd className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px]">Ctrl K</kbd></div>
             <LanguageSelector compact />
             <button type="button" onClick={openGenericSupport} className="flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-semibold text-brand hover:bg-blue-100" title={t("Ayuda de soporte")}><LifeBuoy size={16} /><span className="hidden sm:inline">{t("Soporte")}</span></button>
            <button type="button" onClick={() => setDashboardMessage(t("Las 4 notificaciones del demo están pendientes de conexión con el centro de actividad."))} className="relative grid h-10 w-10 place-items-center rounded-lg text-slate-500 hover:bg-slate-50" aria-label={t("Ver notificaciones")}><Bell size={19} /><span className="absolute right-1 top-1 grid h-4 w-4 place-items-center rounded-full bg-brand text-[10px] font-bold text-white">4</span></button>
            <button type="button" onClick={onLogout} className="flex items-center gap-2 rounded-lg border-l border-slate-200 pl-5 text-left hover:bg-slate-50" title={t("Cerrar sesión")}><div className="grid h-9 w-9 place-items-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">{initialsFor(session.user.displayName)}</div><span className="hidden text-sm font-semibold text-slate-700 lg:block">{session.user.displayName}</span><LogOut size={15} className="text-slate-400" /></button>
          </div>
        </header>

        <div className="mx-auto max-w-[1480px] space-y-6 p-4 sm:p-6 lg:p-8">
          {dashboardMessage && <div role="status" className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800"><span>{dashboardMessage}</span><button type="button" onClick={() => setDashboardMessage("")} className="rounded p-1 font-bold hover:bg-blue-100" aria-label={t("Cerrar mensaje")}>×</button></div>}
           {activeView !== "dashboard" ? activeView === "tools" ? <ToolsPanel key={activeView} session={session} onNavigate={navigate} onReportError={openSupport} /> : <WarehouseModule key={activeView} resource={activeView} session={session} onNavigate={navigate} onReportError={openSupport} /> : <>
          <section className="flex flex-wrap items-end justify-between gap-4">
            <div><h1 className="text-3xl font-bold tracking-tight text-ink">{t("Dashboard operativo")}</h1><p className="mt-1 text-sm text-slate-500">{t("Resumen del almacén en tiempo real")}</p></div>
            <div className="flex items-center gap-2"><div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-600"><MapPin size={16} className="text-slate-400" />{t("Instalación")}: <strong>{session.installation.name}</strong></div></div>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Metric title={t("Stock total")} value={new Intl.NumberFormat(localeForLanguage[language]).format(metrics.stock)} unit={t("uds")} icon={Boxes} color="blue" />
            <Metric title={t("Entradas pendientes")} value={String(metrics.pendingReceipts)} icon={ArrowDownToLine} color="teal" />
            <Metric title={t("Tareas de picking")} value={String(metrics.pickingTasks)} icon={PackageOpen} color="blue" />
            <Metric title={t("Expediciones activas")} value={String(metrics.shipmentsToday)} icon={Truck} color="teal" />
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
            <Panel title={t("Actividad del almacén")} action={<div className="flex flex-wrap gap-1 text-xs" role="group" aria-label={t("Tipo de actividad")}>{([["entries", "Entradas"], ["outbound", "Salidas"], ["movements", "Movimientos"]] as const).map(([mode, label]) => <button key={mode} type="button" aria-pressed={activityMode === mode} onClick={() => setActivityMode(mode)} className={`rounded-md px-3 py-1.5 font-semibold ${activityMode === mode ? "bg-blue-50 text-brand" : "text-slate-500 hover:bg-slate-50"}`}>{t(label)}</button>)}</div>}>
              <div className="mt-5 flex h-52 items-end gap-2 border-b border-l border-slate-200 px-3 pb-0 pt-5" aria-label={`Actividad de ${activityMode === "entries" ? "entradas" : activityMode === "outbound" ? "salidas" : "movimientos"}`}>{[18, 12, 24, 34, 42, 37, 58, 68, 50, 74, 61, 82, 96, 76, 110, 84, 92, 118, 105, 128, 99, 122, 133, 146].map((height, index) => <div key={index} className="group relative flex-1 rounded-t bg-brand/80 transition hover:bg-brand" style={{ height: `${(height * (activityMode === "outbound" ? 0.8 : activityMode === "movements" ? 1.15 : 1)) / 1.6}%` }} title={`${height} operaciones`} />)}</div>
              <div className="mt-3 flex justify-between text-[11px] text-slate-400"><span>00:00</span><span>04:00</span><span>08:00</span><span>12:00</span><span>16:00</span><span>20:00</span><span>23:59</span></div>
            </Panel>
            <Panel title={t("Estado de operaciones")} action={<ExternalLink size={15} className="text-slate-400" />}>
              <div className="mt-4 space-y-5"><Progress label={t("Recepción")} value="78%" amount={`78 ${t("de 100 tareas")}`} color="teal" icon={ArrowDownToLine} /><Progress label={t("Picking")} value="64%" amount={`64 ${t("de 100 tareas")}`} color="blue" icon={PackageOpen} /><Progress label={t("Expediciones")} value="91%" amount={`91 ${t("de 100 tareas")}`} color="teal" icon={Truck} /></div>
              <button type="button" onClick={() => navigate("movements")} className="mt-5 flex w-full items-center justify-center gap-2 border-t border-slate-100 pt-4 text-sm font-semibold text-brand hover:text-blue-700">{t("Ver detalle de operaciones")} <ArrowUpRight size={15} /></button>
            </Panel>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
            <Panel title={t("Actividad reciente")} action={<button type="button" onClick={() => navigate("audit")} className="text-sm font-semibold text-brand hover:text-blue-700">{t("Ver todas →")}</button>}>
              <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="border-b border-slate-100 text-xs text-slate-400"><tr><th className="pb-3 font-medium">{t("Tipo")}</th><th className="pb-3 font-medium">{t("Referencia")}</th><th className="pb-3 font-medium">{t("Descripción")}</th><th className="pb-3 font-medium">{t("Fecha y hora")}</th><th className="pb-3 text-right font-medium">{t("Estado")}</th></tr></thead><tbody>{activities.map(([type, reference, status, statusClass]) => <tr key={reference} className="border-b border-slate-50 last:border-0"><td className="py-3 text-slate-600">{t(type)}</td><td className="py-3 font-semibold text-ink">{reference}</td><td className="py-3 text-slate-500">{t("Operación de almacén")}</td><td className="py-3 text-slate-500">17/05/2025 09:42</td><td className="py-3 text-right"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass}`}>{t(status)}</span></td></tr>)}</tbody></table></div>
              <div className="mt-4 flex items-center justify-between text-xs text-slate-400"><span>{t("Mostrando 4 de 25 actividades")}</span><span className="rounded border border-slate-200 px-2 py-1">1 / 7</span></div>
            </Panel>
            <Panel title={t("Accesos rápidos")} action={<Wrench size={15} className="text-slate-400" />}>
              <div className="mt-4 grid grid-cols-2 gap-3"><QuickAction icon={Boxes} label={t("Consultar stock")} onClick={() => navigate("stock")} /><QuickAction icon={ArrowLeftRight} label={t("Crear movimiento")} onClick={() => navigate("movements")} /><QuickAction icon={ArrowDownToLine} label={t("Ver recepciones")} onClick={() => navigate("receipts")} /><QuickAction icon={Database} label={t("Abrir consulta")} onClick={() => navigate("queries")} /></div>
            </Panel>
          </section>

          <footer className="flex items-center gap-2 text-xs text-slate-400"><span className={`h-2 w-2 rounded-full ${health === "connected" ? "bg-emerald-500" : health === "unavailable" ? "bg-red-500" : "bg-amber-400"}`} />API {t(health === "connected" ? "conectada" : health === "unavailable" ? "no disponible" : "comprobando")} · Version 0.1.0</footer>
          </>}
        </div>
       </main>
       {supportIncident && <SupportReportPanel session={session} incident={supportIncident} onClose={() => setSupportIncident(null)} />}
    </div>
  );
}

function SidebarScrollArea({ children }: { children: ReactNode }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scrollbar, setScrollbar] = useState({ visible: false, top: 0, height: 0 });

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const updateScrollbar = () => {
      const trackHeight = Math.max(viewport.clientHeight - 24, 1);
      const overflowing = viewport.scrollHeight > viewport.clientHeight;
      const thumbHeight = overflowing ? Math.max((viewport.clientHeight / viewport.scrollHeight) * trackHeight, 28) : trackHeight;
      const maxTop = Math.max(trackHeight - thumbHeight, 0);
      const top = overflowing && viewport.scrollHeight > viewport.clientHeight ? (viewport.scrollTop / (viewport.scrollHeight - viewport.clientHeight)) * maxTop : 0;
      setScrollbar({ visible: overflowing, top, height: thumbHeight });
    };

    updateScrollbar();
    viewport.addEventListener("scroll", updateScrollbar, { passive: true });
    window.addEventListener("resize", updateScrollbar);
    const observer = new ResizeObserver(updateScrollbar);
    observer.observe(viewport);
    if (viewport.firstElementChild) observer.observe(viewport.firstElementChild);
    return () => {
      viewport.removeEventListener("scroll", updateScrollbar);
      window.removeEventListener("resize", updateScrollbar);
      observer.disconnect();
    };
  }, []);

  return <div className="sidebar-scroll-area"><div ref={viewportRef} className="sidebar-scroll-viewport">{children}</div>{scrollbar.visible && <div className="sidebar-scroll-track" aria-hidden="true"><div className="sidebar-scroll-thumb" style={{ height: `${scrollbar.height}px`, transform: `translateY(${scrollbar.top}px)` }} /></div>}</div>;
}

type ToolKey = "sql" | "loop" | "updater" | "xml";

function ToolsPanel({ session, onNavigate, onReportError }: { session: AuthSession; onNavigate: (view: View) => void; onReportError: (incident: SupportIncident) => void }) {
  const [activeTool, setActiveTool] = useState<ToolKey | null>(null);
  const tools = [
    { title: "SQL Helper", description: "Construye consultas parametrizadas y revisa sus límites antes de ejecutarlas.", icon: Database, status: "Disponible", tool: "sql" as ToolKey },
    { title: "Loop Helper", description: "Prepara procesos repetitivos sobre una selección de referencias o movimientos.", icon: ArrowLeftRight, status: "Disponible", tool: "loop" as ToolKey },
    { title: "Updater", description: "Gestiona actualizaciones de configuración y versión por instalación.", icon: Wrench, status: "Checklist", tool: "updater" as ToolKey },
    { title: "Importador XML", description: "Valida documentos de proveedores antes de convertirlos en recepciones.", icon: ClipboardList, status: "Disponible", tool: "xml" as ToolKey },
    { title: "Monitor de integraciones", description: "Consulta colas, servicios SOAP/REST y últimos intercambios.", icon: ExternalLink, status: "Módulo", view: "integrations" as View },
    { title: "Auditoría y logs", description: "Revisa quién ejecutó una acción, sobre qué instalación y con qué resultado.", icon: Search, status: "Módulo", view: "audit" as View },
  ];
  return <div className="space-y-6"><section><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">Herramientas</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-ink">Centro de herramientas</h1><p className="mt-1 max-w-3xl text-sm text-slate-500">Accesos para consultas avanzadas, integraciones, automatizaciones y mantenimiento de la plataforma.</p></section><section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{tools.map((tool) => <article key={tool.title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-panel transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg"><div className="flex items-start justify-between gap-4"><div className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-brand"><tool.icon size={21} /></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">{tool.status}</span></div><h2 className="mt-5 font-semibold text-ink">{tool.title}</h2><p className="mt-2 min-h-12 text-sm leading-6 text-slate-500">{tool.description}</p><button type="button" onClick={() => { if ("tool" in tool && tool.tool) setActiveTool(tool.tool); else if ("view" in tool && tool.view) onNavigate(tool.view); }} className="mt-5 flex items-center gap-2 text-sm font-semibold text-brand hover:text-blue-700">Abrir herramienta <ExternalLink size={15} /></button></article>)}</section><div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm text-blue-900"><strong>Control de seguridad:</strong> las ejecuciones pasan por API, permisos, consulta de solo lectura, límite de filas, timeout y auditoría.</div>{activeTool && <ToolDialog tool={activeTool} session={session} onClose={() => setActiveTool(null)} onReportError={onReportError} />}</div>;
}

function ToolDialog({ tool, session, onClose, onReportError }: { tool: ToolKey; session: AuthSession; onClose: () => void; onReportError: (incident: SupportIncident) => void }) {
  const [sql, setSql] = useState("SELECT sku, description, available\nFROM stock\nWHERE installation_id = :installationId\nORDER BY available DESC");
  const [sqlStatus, setSqlStatus] = useState<"idle" | "safe" | "unsafe">("idle");
  const [xml, setXml] = useState("<recepcion referencia=\"RC-10482\"><linea sku=\"SKU-10001\" cantidad=\"10\" /></recepcion>");
  const [xmlResult, setXmlResult] = useState("");
  const [loopItems, setLoopItems] = useState("SKU-10001\nSKU-10002\nSKU-10003");
  const [checklist, setChecklist] = useState([false, false, false]);
  const [loopResource, setLoopResource] = useState<WorkspaceResource>("receipts");
  const [updaterVersion, setUpdaterVersion] = useState("0.2.0");
  const [updaterEnvironment, setUpdaterEnvironment] = useState(session.installation.environment);
  const [toolMessage, setToolMessage] = useState("");
  const [toolError, setToolError] = useState("");
  const [toolBusy, setToolBusy] = useState(false);
  const toolInfo = { sql: { title: "SQL Helper", eyebrow: "Consultas seguras", icon: Code2 }, loop: { title: "Loop Helper", eyebrow: "Procesos repetitivos", icon: RotateCcw }, updater: { title: "Updater", eyebrow: "Mantenimiento", icon: Wrench }, xml: { title: "Importador XML", eyebrow: "Integración de recepciones", icon: FileCode2 } }[tool];
  const Icon = toolInfo.icon;
  const validateSql = () => { const normalized = sql.replace(/--.*$/gm, "").trim().replace(/;+$/, "").trim().toLowerCase(); const unsafe = !/^(select|with)\b/.test(normalized) || normalized.includes(";") || /\b(insert|update|delete|drop|alter|truncate|create|grant|revoke|copy|execute)\b/.test(normalized); setSqlStatus(unsafe ? "unsafe" : "safe"); };
  const validateXml = () => { try { const document = new DOMParser().parseFromString(xml, "application/xml"); const parserError = document.querySelector("parsererror"); if (parserError) throw new Error("XML no válido"); setXmlResult(`XML válido · raíz <${document.documentElement.tagName}> · ${document.querySelectorAll("*").length} elementos detectados`); } catch (error) { setXmlResult(error instanceof Error ? error.message : "XML no válido"); } };
  const runTool = async (action: () => Promise<string>) => { setToolBusy(true); setToolError(""); setToolMessage(""); try { setToolMessage(await action()); } catch (error) { const incident = classifyError(error, "No se pudo completar la herramienta"); setToolError(incident.message); onReportError({ ...incident, resource: tool, action: toolInfo.title }); } finally { setToolBusy(false); } };
  const executeSql = () => runTool(async () => { const result = await executeSqlTool(session.token, "stock", sql); setSqlStatus("safe"); return `Consulta ejecutada · ${result.rowCount ?? 0} filas · ${result.durationMs ?? 0} ms`; });
  const executeLoop = () => runTool(async () => { const ids = loopItems.split("\n").map((item) => item.trim()).filter(Boolean); const result = await executeLoopTool(session.token, loopResource, ids, "En curso"); return `Loop completado · ${result.updated ?? 0} registros actualizados`; });
  const publishUpdate = () => runTool(async () => { const result = await publishUpdater(session.token, updaterVersion, updaterEnvironment); return `Versión ${result.version ?? updaterVersion} publicada`; });
  const importXml = () => runTool(async () => { const result = await importXmlTool(session.token, xml); setXmlResult(`XML importado · recepción creada · ${result.lineCount ?? 0} líneas`); return "Importación registrada y auditada"; });
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="tool-dialog-title"><header className="flex items-start justify-between border-b border-slate-100 px-6 py-5"><div className="flex items-start gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-brand"><Icon size={20} /></div><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">{toolInfo.eyebrow}</p><h2 id="tool-dialog-title" className="mt-1 text-xl font-bold text-ink">{toolInfo.title}</h2></div></div><button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Cerrar"><X size={19} /></button></header><div className="space-y-5 px-6 py-5">{tool === "sql" && <><label className="block text-sm font-semibold text-slate-700">Consulta parametrizada<textarea value={sql} onChange={(event) => { setSql(event.target.value); setSqlStatus("idle"); }} className="mt-2 min-h-40 w-full rounded-lg border border-slate-200 bg-slate-950 p-4 font-mono text-sm text-slate-100 outline-none focus:border-brand focus:ring-4 focus:ring-blue-100" spellCheck={false} /></label><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-500">La API aplica permisos, vista permitida, timeout y límite de filas.</p><div className="flex gap-2"><button type="button" onClick={validateSql} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700">Validar consulta</button><button type="button" onClick={executeSql} disabled={toolBusy} className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">Ejecutar consulta</button></div></div>{sqlStatus !== "idle" && <p className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm ${sqlStatus === "safe" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>{sqlStatus === "safe" ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}{sqlStatus === "safe" ? "Consulta de lectura válida" : "Consulta bloqueada"}</p>}</>}{tool === "loop" && <><label className="block text-sm font-semibold text-slate-700">IDs de registros, uno por línea<textarea value={loopItems} onChange={(event) => setLoopItems(event.target.value)} className="mt-2 min-h-36 w-full rounded-lg border border-slate-200 p-3 font-mono text-sm outline-none focus:border-brand focus:ring-4 focus:ring-blue-100" /></label><label className="block text-sm font-semibold text-slate-700">Módulo<select value={loopResource} onChange={(event) => setLoopResource(event.target.value as WorkspaceResource)} className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 font-normal"><option value="receipts">Recepciones</option><option value="picking">Picking</option><option value="shipments">Expediciones</option><option value="replenishment">Reposición</option></select></label><div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">Se actualizarán <strong>{loopItems.split("\n").map((item) => item.trim()).filter(Boolean).length}</strong> registros a estado “En curso”, con confirmación y auditoría.</div><button type="button" onClick={executeLoop} disabled={toolBusy} className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">Ejecutar proceso</button></>}{tool === "updater" && <><p className="text-sm text-slate-500">Checklist previo a publicar cambios en una instalación:</p>{["Validar migración y copia de seguridad", "Probar configuración en preproducción", "Publicar y registrar versión"].map((item, index) => <label key={item} className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-3 text-sm text-slate-700"><input type="checkbox" checked={checklist[index]} onChange={() => setChecklist((current) => current.map((value, itemIndex) => itemIndex === index ? !value : value))} />{item}</label>)}<div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold text-slate-700">Versión<input value={updaterVersion} onChange={(event) => setUpdaterVersion(event.target.value)} className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 font-normal" /></label><label className="text-sm font-semibold text-slate-700">Entorno<select value={updaterEnvironment} onChange={(event) => setUpdaterEnvironment(event.target.value)} className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 font-normal"><option>Preproducción</option><option>Producción</option></select></label></div><button type="button" disabled={toolBusy || !checklist.every(Boolean)} onClick={publishUpdate} className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Publicar actualización</button></>}{tool === "xml" && <><label className="block text-sm font-semibold text-slate-700">Documento XML<textarea value={xml} onChange={(event) => { setXml(event.target.value); setXmlResult(""); }} className="mt-2 min-h-40 w-full rounded-lg border border-slate-200 bg-slate-50 p-4 font-mono text-sm text-slate-700 outline-none focus:border-brand focus:ring-4 focus:ring-blue-100" spellCheck={false} /></label><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-500">Se valida y crea una recepción trazable en PostgreSQL.</p><div className="flex gap-2"><button type="button" onClick={validateXml} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700">Validar XML</button><button type="button" onClick={importXml} disabled={toolBusy} className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">Importar XML</button></div></div>{xmlResult && <p className={`rounded-lg px-3 py-2.5 text-sm ${xmlResult.startsWith("XML válido") || xmlResult.startsWith("XML importado") ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>{xmlResult}</p>}</>}{toolError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{toolError}</p>}{toolMessage && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">{toolMessage}</p>}</div><footer className="flex justify-end border-t border-slate-100 px-6 py-4"><button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cerrar</button></footer></section></div>;
}

function NavItem({ label, icon: Icon, active = false, onClick }: { label: string; icon: LucideIcon; view: View; active?: boolean; onClick?: () => void }) {
  return <button type="button" onClick={onClick} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${active ? "bg-brand font-semibold text-white shadow-lg shadow-blue-950/20" : "text-slate-300 hover:bg-white/10 hover:text-white"}`}><Icon size={17} strokeWidth={active ? 2.4 : 1.8} /><span>{label}</span></button>;
}

function Metric({ title, value, unit, icon: Icon, color }: { title: string; value: string; unit?: string; icon: LucideIcon; color: "blue" | "teal" }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-panel"><div className="flex items-start justify-between"><div className={`grid h-10 w-10 place-items-center rounded-lg ${color === "blue" ? "bg-blue-50 text-brand" : "bg-teal-50 text-teal"}`}><Icon size={20} /></div><span className="text-slate-300">⋮</span></div><p className="mt-4 text-sm text-slate-500">{title}</p><div className="mt-1 flex items-baseline gap-2"><strong className="text-3xl tracking-tight text-ink">{value}</strong>{unit && <span className="text-sm text-slate-400">{unit}</span>}</div></div>;
}

function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-panel"><div className="flex min-w-0 items-center justify-between"><h2 className="truncate font-semibold text-ink">{title}</h2>{action}</div>{children}</article>;
}

function Progress({ label, value, amount, color, icon: Icon }: { label: string; value: string; amount: string; color: "blue" | "teal"; icon: LucideIcon }) {
  return <div><div className="flex items-center gap-3"><div className={`grid h-9 w-9 place-items-center rounded-lg ${color === "blue" ? "bg-blue-50 text-brand" : "bg-teal-50 text-teal"}`}><Icon size={17} /></div><div className="flex-1"><div className="flex items-center justify-between"><span className="text-sm font-semibold text-slate-700">{label}</span><span className="font-bold text-ink">{value}</span></div><div className="mt-2 h-2 rounded-full bg-slate-100"><div className={`h-2 rounded-full ${color === "blue" ? "bg-brand" : "bg-teal"}`} style={{ width: value }} /></div><p className="mt-1 text-xs text-slate-400">{amount} · En progreso</p></div></div></div>;
}

function QuickAction({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="flex min-h-24 flex-col items-start justify-between rounded-lg border border-slate-200 p-3 text-left transition hover:border-blue-200 hover:bg-blue-50"><div className="grid h-8 w-8 place-items-center rounded-lg bg-blue-50 text-brand"><Icon size={17} /></div><span className="text-sm font-semibold text-slate-700">{label}</span></button>;
}
