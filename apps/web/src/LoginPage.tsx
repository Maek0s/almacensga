import { useState, type FormEvent } from "react";
import { ArrowRight, BriefcaseBusiness, Code2, Crown, Eye, EyeOff, Factory, LockKeyhole, MapPin, ShieldCheck, UserRound, type LucideIcon } from "lucide-react";
import { login, sessionStorageKey, type AuthSession } from "./auth";
import { LanguageSelector, useI18n } from "./i18n";

type LoginPageProps = { onLogin: (session: AuthSession) => void };

const demoRoles: Array<{ key: string; label: string; description: string; username: string; password: string; icon: LucideIcon; iconClass: string }> = [
  { key: "warehouse-manager", label: "Gestor de almacén", description: "Operativa diaria", username: "jgarcia", password: "demo123", icon: BriefcaseBusiness, iconClass: "bg-blue-100 text-blue-700" },
  { key: "developer", label: "Developer", description: "Configuración y herramientas", username: "adev", password: "demo123", icon: Code2, iconClass: "bg-violet-100 text-violet-700" },
  { key: "product-owner", label: "Product Owner", description: "Producto y permisos", username: "powner", password: "demo123", icon: Crown, iconClass: "bg-amber-100 text-amber-700" },
];

export function LoginPage({ onLogin }: LoginPageProps) {
  const { t } = useI18n();
  const [username, setUsername] = useState("jgarcia");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedRole, setSelectedRole] = useState("");

  const selectDemoRole = (role: (typeof demoRoles)[number]) => {
    setUsername(role.username);
    setPassword(role.password);
    setSelectedRole(role.key);
    setError("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const session = await login(username.trim(), password);
      sessionStorage.setItem(sessionStorageKey, JSON.stringify(session));
      onLogin(session);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "No se pudo iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f4f7fb] text-ink">
      <header className="flex h-[72px] items-center justify-between border-b border-slate-200 bg-white px-8">
        <div className="flex items-center gap-4 text-lg font-bold tracking-tight">
          <img data-testid="login-header-logo" src="/nortelog-demo-logo.png" alt="NORTELOG" className="h-9 w-auto max-w-[190px] object-contain" />
          <span className="hidden border-l border-slate-200 pl-4 text-sm font-normal text-slate-500 md:inline">ALMACÉN SGA</span>
        </div>
        <div className="flex items-center gap-3"><LanguageSelector compact /><span data-testid="environment-badge" title={`${t("Entorno")} ${t("Producción")}`} aria-label={`${t("Entorno")} ${t("Producción")}`} className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700"><Factory size={14} aria-hidden="true" />{t("Producción")}</span></div>
      </header>

      <div className="relative flex min-h-[calc(100vh-72px)] items-center justify-center overflow-hidden px-4 py-8 sm:px-6 sm:py-12">
        <div className="pointer-events-none absolute inset-0 opacity-60" aria-hidden="true"><div className="absolute -left-24 top-20 h-96 w-96 rounded-full bg-blue-100/50 blur-3xl" /><div className="absolute -right-28 bottom-0 h-[28rem] w-[28rem] rounded-full bg-teal-100/50 blur-3xl" /><div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[size:48px_48px]" /></div>

        <section className="relative w-full max-w-[560px] rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_24px_70px_rgba(15,35,65,0.12)] sm:p-8" aria-labelledby="login-title">
          <div className="flex flex-col items-center text-center">
            <img data-testid="login-logo" src="/nortelog-demo-logo.png" alt="NORTELOG" className="mb-4 h-16 w-full max-w-[300px] object-contain" />
            <h1 id="login-title" className="mt-2 text-xl font-bold text-ink">{t("Acceso al sistema")}</h1>
            <p className="mt-1 text-sm text-slate-500">{t("Introduce tus credenciales para continuar")}</p>
          </div>

          <div className="mt-6 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600"><MapPin size={17} className="shrink-0 text-slate-400" /><div className="min-w-0 flex-1"><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t("Instalación activa")}</p><p className="truncate font-semibold">Valencia · Centro Logístico Mediterráneo</p></div><span className="text-xs font-medium text-slate-400">{t("Contexto")}</span></div>

          <form className="mx-auto mt-7 max-w-[470px] space-y-5" onSubmit={handleSubmit}>
            <div><label htmlFor="username" className="mb-2 block text-sm font-semibold text-slate-700">{t("Usuario")}</label><div className="relative"><UserRound size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" /><input data-testid="login-username" id="username" name="username" value={username} onChange={(event) => { setUsername(event.target.value); setSelectedRole(""); }} autoComplete="username" className="h-12 w-full rounded-xl border border-slate-300 bg-white pl-11 pr-4 text-sm text-ink outline-none transition focus:border-brand focus:ring-4 focus:ring-blue-100" placeholder={t("Introduce tu usuario")} required /></div></div>
            <div><label htmlFor="password" className="mb-2 block text-sm font-semibold text-slate-700">{t("Contraseña")}</label><div className="relative"><LockKeyhole size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" /><input data-testid="login-password" id="password" name="password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" className="h-12 w-full rounded-xl border border-slate-300 bg-white pl-11 pr-12 text-sm text-ink outline-none transition focus:border-brand focus:ring-4 focus:ring-blue-100" placeholder={t("Introduce tu contraseña")} required /><button data-testid="toggle-password" type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label={showPassword ? t("Ocultar contraseña") : t("Mostrar contraseña")}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div>
            {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700" role="alert">{error}</p>}
            <button data-testid="login-submit" type="submit" disabled={loading} className="flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-brand text-sm font-bold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-70">{loading ? t("Validando acceso…") : t("Iniciar sesión")}{!loading && <ArrowRight size={18} />}</button>
          </form>

          <section className="mx-auto mt-6 max-w-[470px] border-t border-slate-100 pt-5" aria-labelledby="demo-roles-title">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 id="demo-roles-title" className="text-sm font-bold text-ink">{t("Accesos rápidos por rol")}</h2>
                <p className="mt-1 text-xs text-slate-500">{t("Selecciona un perfil para rellenar las credenciales de demostración.")}</p>
              </div>
              <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">{t("3 perfiles demo")}</span>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-3" role="group" aria-label={t("Accesos rápidos por rol")}>
              {demoRoles.map((role) => {
                const Icon = role.icon;
                const isSelected = selectedRole === role.key;
                return <button key={role.key} type="button" data-testid={`select-role-${role.key}`} onClick={() => selectDemoRole(role)} aria-pressed={isSelected} className={`flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 ${isSelected ? "border-brand bg-blue-50 text-brand shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-slate-50"}`}>
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-md ${role.iconClass}`}><Icon size={15} aria-hidden="true" /></span>
                  <span className="truncate">{t(role.label)}</span>
                </button>;
              })}
            </div>
            <p className="mt-3 text-center text-[11px] text-slate-400">{t("Credenciales disponibles únicamente para la demostración local.")}</p>
          </section>

          <div className="mt-6 flex items-start gap-2 border-t border-slate-100 pt-5 text-xs leading-5 text-slate-400"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-teal-500" /><p>{t("Acceso protegido para el entorno de producción. La instalación se asigna al iniciar la sesión.")}</p></div>
          <p className="mt-5 text-center text-xs text-slate-400">{t("Versión 0.1.0 · Selecciona un perfil demo o introduce tus credenciales")}</p>
        </section>
      </div>
    </main>
  );
}
