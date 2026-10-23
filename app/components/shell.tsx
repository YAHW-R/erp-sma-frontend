import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import type { StoredSession } from "~/lib/session";
import { can, roleName } from "~/lib/session";
import { logout, switchCompany } from "~/lib/auth";
import { ROLE_NAMES } from "~/lib/format";
import { Button, cn } from "~/components/ui";

const NAV = [
  { to: "/", label: "Inicio", permission: null },
  { to: "/periodos", label: "Períodos", permission: "periods:read" },
  { to: "/catalogo", label: "Catálogo", permission: "accounts:read" },
  { to: "/asientos", label: "Asientos", permission: "entries:read" },
  { to: "/reportes", label: "Reportes", permission: "reports:read" },
  { to: "/banco", label: "Banco", permission: "bank:read" },
] as const;

export function Shell({ session }: { session: StoredSession }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const company = session.companies.find((item) => item.id === session.company_id);

  useEffect(() => setOpen(false), [location.pathname]);

  const role = session.user.is_admin
    ? "Administrador Único"
    : ROLE_NAMES[roleName()] ?? roleName();

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  const nav = NAV.filter((item) => !item.permission || can(item.permission));

  return (
    <div className="min-h-screen bg-slate-100 lg:grid lg:grid-cols-[16rem_1fr]">
      {open && (
        <button
          type="button"
          aria-label="Cerrar menú"
          className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-700 text-sm font-bold text-white">
            ES
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-900">ERP-SMA</p>
            <p className="text-xs text-slate-500">Contabilidad</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-emerald-50 text-emerald-900"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-100 p-3">
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <p className="truncate text-sm font-medium text-slate-800">{session.user.full_name}</p>
            <p className="truncate text-xs text-slate-500">{role}</p>
          </div>
          <Button variant="ghost" size="sm" className="mt-2 w-full justify-start" onClick={handleLogout}>
            Salir
          </Button>
        </div>
      </aside>

      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:px-6">
          <Button
            variant="secondary"
            size="sm"
            className="lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Abrir menú"
          >
            Menú
          </Button>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">
              {company?.legal_name ?? "Sin empresa activa"}
            </p>
            <p className="truncate text-xs text-slate-500">{company?.rif_rut ?? ""}</p>
          </div>

          {session.companies.length > 1 && (
            <label className="flex items-center gap-2 text-xs text-slate-500">
              Empresa
              <select
                className="max-w-56 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 focus:border-emerald-600 focus:outline-none"
                value={session.company_id ?? ""}
                onChange={(event) => switchCompany(event.target.value)}
              >
                {session.companies.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.legal_name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
