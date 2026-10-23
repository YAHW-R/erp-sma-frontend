import type { Access, Company, User } from "~/api/types";

/** Sesión persistida en localStorage. El backend usa Bearer, no cookies. */
export type StoredSession = {
  access_token: string;
  refresh_token: string;
  expires_at: string;
  user: User;
  companies: Company[];
  accesses: Access[];
  company_id: string | null;
};

const SESSION_KEY = "erp-sma.session";

export function getSession(): StoredSession | null {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function saveSession(session: StoredSession) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function activeCompany(): Company | undefined {
  const session = getSession();
  return session?.companies.find((company) => company.id === session.company_id);
}

/** Empresa activa para los clientLoader. El layout ya garantiza que exista. */
export function activeCompanyId(): string {
  const session = getSession();
  if (!session?.company_id) throw new Error("No hay una empresa activa en la sesión");
  return session.company_id;
}

export function activeAccess(): Access | undefined {
  const session = getSession();
  if (!session?.company_id) return undefined;
  return session.accesses.find((access) => access.company_id === session.company_id);
}

/** Permisos vigentes en la empresa activa. El Administrador Único puede todo. */
export function can(permission: string): boolean {
  const session = getSession();
  if (!session) return false;
  if (session.user.is_admin) return true;
  const access = activeAccess();
  // Sin filas de acceso no se puede saber el rol: se muestra todo y la API
  // sigue siendo la que autoriza (ver shortcut en lib/auth.ts).
  if (!access) return session.accesses.length === 0;
  return access.permissions.includes(permission);
}

export function roleName(): string {
  const session = getSession();
  if (!session) return "";
  if (session.user.is_admin) return "Administrador Único";
  return activeAccess()?.role ?? "Sin rol";
}
