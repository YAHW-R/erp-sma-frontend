import type { Access, Company, LoginResponse } from "~/api/types";
import { ApiError, get, post } from "~/lib/api";
import { clearSession, getSession, saveSession, type StoredSession } from "~/lib/session";

const ADMIN_USERS = "/admin/users";

/** El layout no vuelve a pedir empresas y accesos en cada navegación. */
let cached: StoredSession | null | undefined;

export function resetBootstrap() {
  cached = undefined;
}

async function loadCompanies(): Promise<Company[]> {
  return get<Company[]>("/companies", { query: { limit: 200 } });
}

async function loadAccesses(userId: string, isAdmin: boolean): Promise<Access[]> {
  if (isAdmin) return [];
  try {
    return await get<Access[]>(`${ADMIN_USERS}/${userId}/access`);
  } catch {
    // shortcut: /admin exige is_admin en el middleware, así que un no-admin no
    // puede leer sus permisos. El menú se muestra completo y la API decide;
    // mover esa ruta fuera del grupo admin cuando se active la fase de usuarios.
    return [];
  }
}

function pickCompany(session: StoredSession, companies: Company[]): string | null {
  if (session.company_id && companies.some((company) => company.id === session.company_id)) {
    return session.company_id;
  }
  return companies[0]?.id ?? null;
}

function withCompany(session: StoredSession, companies: Company[], accesses: Access[]): StoredSession {
  return { ...session, companies, accesses, company_id: pickCompany(session, companies) };
}

/** Inicia sesión y deja lista la empresa activa y sus permisos. */
export async function login(email: string, password: string): Promise<StoredSession> {
  const result = await post<LoginResponse>("/auth/login", { email, password }, { auth: false });

  const base: StoredSession = {
    access_token: result.access_token,
    refresh_token: result.refresh_token,
    expires_at: result.expires_at,
    user: result.user,
    companies: [],
    accesses: [],
    company_id: null,
  };
  saveSession(base);

  const companies = await loadCompanies();
  const accesses = await loadAccesses(result.user.id, result.user.is_admin);
  const session = withCompany(base, companies, accesses);
  saveSession(session);
  cached = session;
  return session;
}

/** Refresca empresas y accesos al entrar o recargar. */
export async function bootstrap(): Promise<StoredSession | null> {
  if (cached !== undefined) return cached;

  const existing = getSession();
  if (!existing) {
    cached = null;
    return null;
  }

  try {
    const companies = await loadCompanies();
    const accesses = await loadAccesses(existing.user.id, existing.user.is_admin);
    const session = withCompany(existing, companies, accesses);
    saveSession(session);
    cached = session;
    return session;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      clearSession();
      cached = null;
      return null;
    }
    throw error;
  }
}

/** Cierra la sesión en el servidor y en el navegador. */
export async function logout() {
  const session = getSession();
  if (session) {
    try {
      await post("/auth/logout", { refresh_token: session.refresh_token });
    } catch {
      // El token local se borra igual: el servidor ya no puede hacer nada útil.
    }
  }
  clearSession();
  cached = null;
}

/** Cambia la empresa activa; recarga para no arrastrar datos de la anterior. */
export function switchCompany(companyId: string) {
  const session = getSession();
  if (!session) return;
  saveSession({ ...session, company_id: companyId });
  cached = undefined;
  window.location.assign("/");
}
