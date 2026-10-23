import type { Envelope, Meta, Page } from "~/api/types";
import { clearSession, getSession, saveSession } from "~/lib/session";

const BASE = "/api/v1";

/** Error de la API con el código de negocio (`error.code`) y el status HTTP. */
export class ApiError extends Error {
  code: string;
  status: number;
  details?: Record<string, unknown>;

  constructor(message: string, code: string, status: number, details?: Record<string, unknown>) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

type Query = Record<string, string | number | boolean | null | undefined>;

export type RequestOptions = {
  method?: string;
  body?: unknown;
  form?: FormData;
  query?: Query;
  auth?: boolean;
  signal?: AbortSignal;
};

function buildUrl(path: string, query?: Query): string {
  const url = `${BASE}${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

/** El refresh rota el token: dos renovaciones simultáneas revocan la sesión. */
let renewal: Promise<boolean> | null = null;

function renewAccess(): Promise<boolean> {
  if (renewal) return renewal;
  renewal = (async () => {
    const session = getSession();
    if (!session) return false;
    try {
      const response = await fetch(`${BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: session.refresh_token }),
        credentials: "omit",
      });
      const payload = (await response.json().catch(() => null)) as Envelope<{
        access_token: string;
        refresh_token: string;
        expires_at: string;
      }> | null;

      if (!response.ok || !payload?.data?.access_token) return false;

      const current = getSession();
      if (!current) return false;
      saveSession({
        ...current,
        access_token: payload.data.access_token,
        refresh_token: payload.data.refresh_token,
        expires_at: payload.data.expires_at,
      });
      return true;
    } catch {
      return false;
    }
  })().finally(() => {
    renewal = null;
  });

  renewal.then((ok) => {
    if (!ok) {
      clearSession();
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.location.assign("/login");
      }
    }
  });

  return renewal;
}

async function send(path: string, options: RequestOptions = {}, retried = false): Promise<Response> {
  const headers = new Headers();
  const session = getSession();

  if (options.auth !== false && session) headers.set("Authorization", `Bearer ${session.access_token}`);
  if (session?.company_id) headers.set("X-Company-ID", session.company_id);

  let body: BodyInit | undefined;
  if (options.form) {
    body = options.form;
  } else if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.body);
  }

  const response = await fetch(buildUrl(path, options.query), {
    method: options.method ?? (body ? "POST" : "GET"),
    headers,
    body,
    signal: options.signal,
    credentials: "omit",
  });

  // Un 401 en cualquier llamada autenticada se reintenta una vez con el
  // token renovado. El propio refresh no pasa por aquí.
  if (response.status === 401 && !retried && options.auth !== false && !path.startsWith("/auth/")) {
    if (await renewAccess()) return send(path, options, true);
  }

  return response;
}

async function unwrap<T>(response: Response): Promise<{ data: T; meta?: Meta }> {
  const text = await response.text();
  let payload: Envelope<T> | null = null;
  try {
    payload = text ? (JSON.parse(text) as Envelope<T>) : null;
  } catch {
    payload = null;
  }

  if (!response.ok || payload?.error) {
    const error = payload?.error;
    throw new ApiError(
      error?.message ?? `El servidor respondió ${response.status}`,
      error?.code ?? "http_error",
      response.status,
      error?.details,
    );
  }

  if (!payload) {
    throw new ApiError("La respuesta del servidor no es válida", "invalid_response", response.status);
  }

  return { data: payload.data, meta: payload.meta };
}

export async function get<T>(path: string, options?: RequestOptions): Promise<T> {
  const { data } = await unwrap<T>(await send(path, { ...options, method: "GET" }));
  return data;
}

/** Listado paginado: `data` + `meta.page`. */
export async function page<T>(path: string, options?: RequestOptions): Promise<Page<T>> {
  const { data, meta } = await unwrap<T[] | null>(await send(path, { ...options, method: "GET" }));
  return { items: data ?? [], meta };
}

export async function post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
  const { data } = await unwrap<T>(await send(path, { ...options, method: "POST", body }));
  return data;
}

export async function patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
  const { data } = await unwrap<T>(await send(path, { ...options, method: "PATCH", body }));
  return data;
}

export async function put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
  const { data } = await unwrap<T>(await send(path, { ...options, method: "PUT", body }));
  return data;
}

export async function del<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
  const { data } = await unwrap<T>(await send(path, { ...options, method: "DELETE", body }));
  return data;
}

/** Subida multipart (extractos, importaciones). */
export async function upload<T>(path: string, form: FormData): Promise<T> {
  const { data } = await unwrap<T>(await send(path, { method: "POST", form }));
  return data;
}

/** Descarga autenticada de un archivo crudo (CSV del catálogo). */
export async function blob(path: string): Promise<Blob> {
  const response = await send(path, { method: "GET" });
  if (!response.ok) {
    const { error } = (await response.json().catch(() => ({}))) as Envelope<unknown>;
    throw new ApiError(
      error?.message ?? `El servidor respondió ${response.status}`,
      error?.code ?? "http_error",
      response.status,
    );
  }
  return response.blob();
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Ocurrió un error inesperado.";
}
