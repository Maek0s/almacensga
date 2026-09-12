const apiBase = process.env.SGA_API_URL ?? "http://localhost:3000";
const webBase = process.env.SGA_WEB_URL ?? "http://localhost:5173";

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const readJson = async (response, label) => {
  const body = await response.json();
  assert(response.ok, `${label}: HTTP ${response.status} ${JSON.stringify(body)}`);
  return body;
};

const web = await fetch(`${webBase}/`);
assert(web.ok, `web: HTTP ${web.status}`);
const html = await web.text();
assert(html.includes("Almacén SGA"), "web: no se encontró la aplicación en el HTML inicial");

const loginResponse = await fetch(`${apiBase}/api/auth/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ username: "adev", password: "demo123" }),
});
const login = await readJson(loginResponse, "login");
assert(typeof login.token === "string" && login.token.length > 20, "login: token inválido");
const headers = { authorization: `Bearer ${login.token}` };

const me = await readJson(await fetch(`${apiBase}/api/auth/me`, { headers }), "session");
assert(me.user?.username === "adev", "session: usuario inesperado");
const dashboard = await readJson(await fetch(`${apiBase}/api/dashboard`, { headers }), "dashboard");
assert(typeof dashboard.metrics?.stock === "number", "dashboard: métricas ausentes");

for (const resource of ["stock", "receipts", "picking", "movements", "queries", "users", "roles", "integrations"]) {
  const body = await readJson(await fetch(`${apiBase}/api/workspace/${resource}?pageSize=10`, { headers }), `workspace/${resource}`);
  assert(body.generatedRows > 0, `workspace/${resource}: sin datos`);
}

const metrics = await readJson(await fetch(`${apiBase}/api/metrics`, { headers }), "metrics");
assert(metrics.routes && Object.keys(metrics.routes).length > 0, "metrics: no hay rutas registradas");

const logout = await fetch(`${apiBase}/api/auth/logout`, { method: "POST", headers });
assert(logout.status === 204, `logout: HTTP ${logout.status}`);

console.log(JSON.stringify({ ok: true, resources: 8, routes: Object.keys(metrics.routes).length, installation: login.installation?.code }));
