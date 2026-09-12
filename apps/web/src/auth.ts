import { apiUrl } from "./api";

export type AuthSession = {
  sessionId: string;
  token: string;
  user: { id: string; username: string; displayName: string; email: string };
  client: { id: string; code: string; name: string; logoKey: string | null };
  installation: { id: string; code: string; name: string; environment: string; warehouseId: string | null };
  role: { key: "DEVELOPER" | "PRODUCT_OWNER" | "WAREHOUSE_MANAGER" | string; name: string; permissions?: string[] };
};

export const sessionStorageKey = "almacensga.session";

type ApiError = { message?: string };

const apiUnavailableMessage = "No se pudo conectar con la API. Comprueba que el servidor esté iniciado.";

const readJson = async <T>(response: Response): Promise<T | null> => {
  const text = await response.text();
  if (!text.trim()) return null;

  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
};

export const login = async (username: string, password: string): Promise<AuthSession> => {
  let response: Response;
  try {
    response = await fetch(apiUrl("/api/auth/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
  } catch {
    throw new Error(apiUnavailableMessage);
  }

  const body = await readJson<AuthSession & ApiError>(response);
  if (!response.ok) throw new Error(body?.message ?? (response.status >= 500 ? apiUnavailableMessage : "No se pudo iniciar sesión"));
  if (!body) throw new Error("La API devolvió una respuesta inválida.");
  return body;
};

export const getCurrentSession = async (token: string): Promise<AuthSession> => {
  const response = await fetch(apiUrl("/api/auth/me"), { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error("Sesión no válida");
  return response.json() as Promise<AuthSession>;
};

export const logout = async (token: string) => {
  await fetch(apiUrl("/api/auth/logout"), { method: "POST", headers: { Authorization: `Bearer ${token}` } });
};
