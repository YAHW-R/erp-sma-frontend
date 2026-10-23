import { Link, useLoaderData } from "react-router";
import type { SituationReport } from "~/api/types";
import { fiscalPeriods, fiscalYears, syncReport } from "~/api/endpoints";
import { activeCompany, activeCompanyId, can, getSession } from "~/lib/session";
import { currentPeriod, dateTime, money, shortDate } from "~/lib/format";
import { Badge, Card, EmptyState, PageHeader, Stat, tableClass, tableWrap, tdClass, tdNum, thClass } from "~/components/ui";

export async function clientLoader() {
  const companyId = activeCompanyId();
  const company = activeCompany() ?? null;
  const years = await fiscalYears(companyId);
  const year = years.length ? Math.max(...years.map((item) => item.year)) : new Date().getFullYear();
  const periods = years.length ? await fiscalPeriods(companyId, year) : [];
  const period = currentPeriod(periods) ?? null;

  let situation: SituationReport | null = null;
  if (period && can("reports:read")) {
    const report = await syncReport(companyId, "estado-situacion", period.id).catch(() => null);
    if (report?.kind === "estado-situacion") situation = report;
  }

  return { company, years, period, situation };
}

export default function Inicio() {
  const { company, years, period, situation } = useLoaderData<typeof clientLoader>();
  const session = getSession();
  const role = session?.user.is_admin
    ? "Administrador Único"
    : session?.accesses.find((item) => item.company_id === session.company_id)?.role ?? "Sin rol";

  return (
    <div>
      <PageHeader
        title="Inicio"
        subtitle={company ? `${company.legal_name} · ${company.rif_rut}` : "Resumen de la empresa activa"}
        actions={
          can("entries:write") && (
            <Link
              to="/asientos/nuevo"
              className="inline-flex items-center rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
            >
              Nuevo asiento
            </Link>
          )
        }
      />

      {!company ? (
        <EmptyState title="Sin empresa activa" hint="Selecciona una empresa para ver su contabilidad." />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Moneda" value={company.currency_code} hint={role} />
            <Stat
              label="Período actual"
              value={period ? period.label : "Sin período"}
              hint={
                period ? (
                  <span className="flex items-center gap-2">
                    {shortDate(period.start_date)} — {shortDate(period.end_date)}
                    <Badge tone={period.is_closed ? "red" : "green"}>{period.is_closed ? "Cerrado" : "Abierto"}</Badge>
                  </span>
                ) : (
                  "Crea el año fiscal en Períodos"
                )
              }
            />
            <Stat label="Años fiscales" value={years.length} hint={years.length ? `Último: ${Math.max(...years.map((y) => y.year))}` : "Ninguno"} />
            <Stat
              label="Libros y cierres"
              value={period?.is_closed ? "Congelado" : "Editable"}
              hint={period?.closed_at ? `Cerrado el ${dateTime(period.closed_at)}` : undefined}
            />
          </div>

          {situation ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Activo" value={money(situation.total_assets)} />
              <Stat label="Pasivo" value={money(situation.total_liabilities)} />
              <Stat label="Patrimonio" value={money(situation.total_equity)} />
              <Stat label="Resultado del ejercicio" value={money(situation.net_result)} />
            </div>
          ) : (
            <EmptyState
              title={period ? "Todavía no hay cifras" : "Aún no hay un año fiscal"}
              hint={
                period
                  ? "Registra y publica asientos para ver los totales del período."
                  : "Crea el año fiscal y registra los primeros asientos."
              }
            >
              <Link to={period ? "/asientos/nuevo" : "/periodos"} className="text-sm font-medium text-emerald-700 hover:underline">
                {period ? "Crear el primer asiento" : "Ir a Períodos"}
              </Link>
            </EmptyState>
          )}

          {situation && situation.assets.length > 0 && (
            <Card>
              <div className="border-b border-slate-100 px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-800">Estado de situación · {situation.period.label}</h2>
              </div>
              <div className={tableWrap}>
                <table className={tableClass}>
                  <thead>
                    <tr>
                      <th className={thClass}>Código</th>
                      <th className={thClass}>Cuenta</th>
                      <th className={thClass}>Grupo</th>
                      <th className={thClass}>Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...situation.assets, ...situation.liabilities, ...situation.equity].slice(0, 8).map((row) => (
                      <tr key={`${row.classification}-${row.code}`}>
                        <td className={tdClass}>{row.code}</td>
                        <td className={tdClass}>{row.name}</td>
                        <td className={tdClass}>{row.classification}</td>
                        <td className={tdNum}>{money(row.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="px-4 py-2 text-xs text-slate-500">
                <Link to="/reportes" className="font-medium text-emerald-700 hover:underline">
                  Ver todos los reportes
                </Link>
              </p>
            </Card>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { to: "/asientos", title: "Asientos", hint: "Registrar y publicar partidas dobles" },
              { to: "/catalogo", title: "Catálogo", hint: "Cuentas VEN-NIF de la empresa" },
              { to: "/reportes", title: "Reportes", hint: "Estados y libros en PDF o Excel" },
              { to: "/banco", title: "Banco", hint: "Extractos y conciliación" },
            ].map((item) => (
              <Link key={item.to} to={item.to} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-emerald-300 hover:shadow">
                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                <p className="mt-1 text-xs text-slate-500">{item.hint}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
