const baseUrl = process.env.SGA_BASE_URL ?? "http://localhost:3000";
const iterations = Number(process.env.SGA_PERF_ITERATIONS ?? 20);

const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ username: "jgarcia", password: "demo123" }),
});
if (!loginResponse.ok) throw new Error(`Login failed: ${loginResponse.status}`);
const session = await loginResponse.json();
const headers = { authorization: `Bearer ${session.token}` };
const durations = [];
let successful = 0;

await Promise.all(Array.from({ length: iterations }, async (_, index) => {
  const started = performance.now();
  const response = await fetch(`${baseUrl}/api/workspace/${index % 2 === 0 ? "receipts" : "picking"}?page=1&pageSize=50&search=`, { headers });
  durations.push(performance.now() - started);
  if (response.ok) successful += 1;
}));

durations.sort((a, b) => a - b);
const percentile = (value) => durations[Math.min(durations.length - 1, Math.ceil(durations.length * value) - 1)];
const report = { iterations, successful, minMs: Math.round(durations[0]), p50Ms: Math.round(percentile(0.5)), p95Ms: Math.round(percentile(0.95)), maxMs: Math.round(durations.at(-1)) };
console.log(JSON.stringify(report));
if (successful !== iterations || report.p95Ms > 1500) process.exitCode = 1;
