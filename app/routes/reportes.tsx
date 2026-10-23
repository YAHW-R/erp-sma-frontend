import { useState } from "react";
import { Form, Link, useActionData, useLoaderData } from "react-router";
import type { ReportKind, StatementLine, SyncReport } from "~/api/types";
import {
  accounts,
  bankAccounts,
  fiscalPeriods,
  fiscalYears,
  jobDownload,
  requestReport,
  syncReport,
} from "~/api/endpoints";
import { errorMessage } from "~/lib/api";
import { intent, optionalText, text } from "~/lib/forms";
import { activeCompanyId, activeCompany, can } from "~/lib/session";
import { REPORT_KINDS, SYNC_REPORT_KINDS, currentPeriod, money, shortDate } from "~/lib/format";
import { useJob } from "~/lib/use-job";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  PageHeader,
  Select,
  Spinner,
  Stat,
  cn,
  tableClass,
  tableWrap,
  tdClass,
  tdNum,
  thClass,
} from "~/components/ui";

const JOB_STATUS: Record<string, { label: string; tone: "slate" | "green" | "amber" | "red" }> = {
  PENDING: { label: "En cola", tone: "slate" },
  RUNNING: { label: "Generando", tone: "amber" },
  RETRYING: { label: "Reintentando", tone: "amber" },
  COMPLETED: { label: "Listo", tone: "green" },
  FAILED: { label: "Falló", tone: "red" },
};

export async function clientLoader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const companyId = activeCompanyId();
  const years = await fiscalYears(companyId);
  const periodGroups = await Promise.all(years.map((year) => fiscalPeriods(companyId, year.year)));
  const periods = periodGroups.flat().sort((a, b) => a.start_date.localeCompare(b.start_date));

  const requested = url.searchParams.get("period");
  const period = periods.find((item) => item.id === requested) ?? currentPeriod(periods) ?? periods[0] ?? null;
  const kindParam = url.searchParams.get("kind") ?? "balance";
  const kind = (SYNC_REPORT_KINDS as readonly string[]).includes(kindParam)
    ? (kindParam as ReportKind)
    : "balance";

  let report: SyncReport | null = null;
  if (period && can("reports:read")) {
    report = await syncReport(companyId, kind, period.id).catch(() => null);
  }

  const accountOptions = can("accounts:read") ? (await accounts(companyId)).items.filter((item) => item.is_postable) : [];
  const bankOptions = can("bank:read") ? await bankAccounts(companyId) : [];

  return {
    company: activeCompany() ?? null,
    years,
    periods,
    periodId: period?.id ?? null,
    kind,
    report,
    accountOptions,
    bankOptions,
  };
}

type ReportActionResult = { error?: string; jobId?: string; jobKind?: string };

export async function clientAction({ request }: { request: Request }): Promise<ReportActionResult> {
  const form = await request.formData();
  const companyId = activeCompanyId();

  if (intent(form) !== "generate") return { error: "Acción desconocida." };

  const kind = text(form, "kind");
  const periodId = text(form, "period_id");
  const format = text(form, "format") === "xlsx" ? "xlsx" : "pdf";

  if (!periodId) return { error: "No hay un período seleccionado." };
  if (!REPORT_KINDS.some(([value]) => value === kind)) return { error: "El reporte no es válido." };

  const accountId = optionalText(form, "account_id");
  const bankAccountId = optionalText(form, "bank_account_id");
  if (kind === "libro-mayor" && !accountId) return { error: "Elige la cuenta para el Libro Mayor." };
  if (kind === "conciliacion-bancaria" && !bankAccountId) {
    return { error: "Elige la cuenta bancaria para el reporte de conciliación." };
  }

  try {
    const result = await requestReport(companyId, kind, {
      period_id: periodId,
      format,
      account_id: accountId,
      bank_account_id: bankAccountId,
    });
    return { jobId: result.job_id, jobKind: kind };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}

function Section({ title, rows, total }: { title: string; rows: StatementLine[]; total: string }) {
  if (rows.length === 0) return null;
  return (
    <div>
      <h3 className="mb-2 mt-4 text-sm font-semibold text-slate-800">{title}</h3>
      <div className={tableWrap}>
        <table className={tableClass}>
          <thead>
            <tr>
              <th className={thClass}>Código</th>
              <th className={thClass}>Cuenta</th>
              <th className={cn(thClass, "text-right")}>Monto</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.code}-${row.name}`}>
                <td className={cn(tdClass, "font-mono text-xs")}>{row.code}</td>
                <td className={tdClass}>{row.name}</td>
                <td className={tdNum}>{money(row.amount)}</td>
              </tr>
            ))}
            <tr className="bg-slate-50 font-semibold">
              <td className={tdClass} colSpan={2}>
                Total {title.toLowerCase()}
              </td>
              <td className={tdNum}>{money(total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReportView({ report }: { report: SyncReport }) {
  if (report.kind === "balance") {
    return (
      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-800">Balance de comprobación · {report.period.label}</h2>
          <Badge tone={report.is_balanced ? "green" : "red"}>{report.is_balanced ? "Cuadrado" : "Descuadrado"}</Badge>
        </div>
        <div className={tableWrap}>
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={thClass}>Código</th>
                <th className={thClass}>Cuenta</th>
                <th className={cn(thClass, "text-right")}>Debe</th>
                <th className={cn(thClass, "text-right")}>Haber</th>
                <th className={cn(thClass, "text-right")}>Saldo</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row) => (
                <tr key={`${row.code}-${row.name}`}>
                  <td className={cn(tdClass, "font-mono text-xs")}>{row.code}</td>
                  <td className={tdClass}>{row.name}</td>
                  <td className={tdNum}>{money(row.debit)}</td>
                  <td className={tdNum}>{money(row.credit)}</td>
                  <td className={tdNum}>{money(row.balance)}</td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-semibold">
                <td className={tdClass} colSpan={2}>
                  Totales
                </td>
                <td className={tdNum}>{money(report.total_debit)}</td>
                <td className={tdNum}>{money(report.total_credit)}</td>
                <td className={tdNum}>—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    );
  }

  if (report.kind === "estado-resultados") {
    return (
      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Estado de resultados · {report.period.label}</h2>
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <Stat label="Ingresos" value={money(report.total_income)} />
          <Stat label="Gastos" value={money(report.total_expenses)} />
          <Stat label="Resultado neto" value={money(report.net_result)} />
        </div>
        <Section title="Ingresos" rows={report.income} total={report.total_income} />
        <Section title="Gastos" rows={report.expenses} total={report.total_expenses} />
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-800">Estado de situación financiera · {report.period.label}</h2>
        <Badge tone={report.is_balanced ? "green" : "red"}>{report.is_balanced ? "Cuadrado" : "Descuadrado"}</Badge>
      </div>
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <Stat label="Activo" value={money(report.total_assets)} />
        <Stat label="Pasivo" value={money(report.total_liabilities)} />
        <Stat label="Patrimonio" value={money(report.total_equity)} />
        <Stat label="Resultado" value={money(report.net_result)} />
      </div>
      <Section title="Activo" rows={report.assets} total={report.total_assets} />
      <Section title="Pasivo" rows={report.liabilities} total={report.total_liabilities} />
      <Section title="Patrimonio" rows={report.equity} total={report.total_equity} />
    </Card>
  );
}

function JobPanel({ companyId, jobId, label }: { companyId: string; jobId: string; label: string }) {
  const job = useJob(companyId, jobId);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const status = job ? JOB_STATUS[job.status] ?? { label: job.status, tone: "slate" as const } : null;

  async function download() {
    setDownloadError(null);
    try {
      const link = await jobDownload(companyId, jobId);
      window.open(link.url, "_blank", "noopener");
    } catch (error) {
      setDownloadError(errorMessage(error));
    }
  }

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-slate-800">{label}</h2>
        {status ? <Badge tone={status.tone}>{status.label}</Badge> : <Badge tone="slate">Consultando…</Badge>}
      </div>

      {!job && (
        <p className="mt-3 flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Encolando el trabajo…
        </p>
      )}

      {job && job.status !== "COMPLETED" && job.status !== "FAILED" && (
        <div className="mt-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full bg-emerald-600 transition-all" style={{ width: `${Math.min(100, Math.max(4, job.progress))}%` }} />
          </div>
          <p className="mt-1 text-xs text-slate-500">El archivo se genera en segundo plano. Puedes seguir en la app.</p>
        </div>
      )}

      {job?.status === "COMPLETED" && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button onClick={download}>Descargar archivo</Button>
          <span className="text-xs text-slate-500">El enlace se firma al momento de descargar.</span>
        </div>
      )}

      {job?.status === "FAILED" && <div className="mt-3"><Alert>{job.error ?? "El trabajo falló sin detalle."}</Alert></div>}
      {downloadError && <div className="mt-3"><Alert>{downloadError}</Alert></div>}
    </Card>
  );
}

export default function Reportes() {
  const { company, years, periods, periodId, kind, report, accountOptions, bankOptions } = useLoaderData<typeof clientLoader>();
  const result = useActionData<typeof clientAction>();
  const [fileKind, setFileKind] = useState("libro-diario");
  const companyId = company?.id ?? null;

  return (
    <div>
      <PageHeader
        title="Reportes"
        subtitle="Estados financieros al momento y libros generados en segundo plano."
        actions={
          <Form method="get" className="flex items-end gap-2">
            <input type="hidden" name="kind" value={kind} />
            <Select name="period" defaultValue={periodId ?? ""} className="w-48" aria-label="Período">
              {periods.map((period) => (
                <option key={period.id} value={period.id}>
                  {period.label}
                </option>
              ))}
            </Select>
            <Button type="submit" variant="secondary" size="sm">
              Ver período
            </Button>
          </Form>
        }
      />

      {years.length === 0 || periods.length === 0 ? (
        <EmptyState title="Sin períodos fiscales" hint="Crea el año fiscal y registra asientos para poder generar reportes.">
          <Link to="/periodos" className="text-sm font-medium text-emerald-700 hover:underline">
            Ir a Períodos
          </Link>
        </EmptyState>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {SYNC_REPORT_KINDS.map((value) => (
              <Link
                key={value}
                to={`?period=${periodId ?? ""}&kind=${value}`}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium",
                  value === kind
                    ? "bg-emerald-700 text-white"
                    : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
                )}
              >
                {REPORT_KINDS.find(([item]) => item === value)?.[1] ?? value}
              </Link>
            ))}
          </div>

          {report ? (
            <ReportView report={report} />
          ) : (
            <EmptyState
              title="No se pudo calcular el reporte"
              hint="Puede que no tengas permiso de lectura o que el período no tenga asientos publicados."
            />
          )}

          <Card className="p-4">
            <h2 className="text-sm font-semibold text-slate-800">Descargar libro o documento</h2>
            <p className="mt-1 text-xs text-slate-500">
              Se genera en PDF o Excel. El progreso aparece aquí mientras el servidor prepara el archivo.
            </p>

            {result?.error && <div className="mt-3"><Alert>{result.error}</Alert></div>}

            <Form method="post" className="mt-4 space-y-3">
              <input type="hidden" name="intent" value="generate" />
              <input type="hidden" name="period_id" value={periodId ?? ""} />

              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Documento" htmlFor="kind">
                  <Select id="kind" name="kind" value={fileKind} onChange={(event) => setFileKind(event.target.value)}>
                    {REPORT_KINDS.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Formato" htmlFor="format">
                  <Select id="format" name="format" defaultValue="pdf">
                    <option value="pdf">PDF</option>
                    <option value="xlsx">Excel (.xlsx)</option>
                  </Select>
                </Field>

                {fileKind === "libro-mayor" && (
                  <Field label="Cuenta" htmlFor="account_id">
                    <Select id="account_id" name="account_id" required>
                      <option value="">Elige la cuenta</option>
                      {accountOptions.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.code} · {account.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}

                {fileKind === "conciliacion-bancaria" && (
                  <Field label="Cuenta bancaria" htmlFor="bank_account_id">
                    <Select id="bank_account_id" name="bank_account_id" required>
                      <option value="">Elige la cuenta</option>
                      {bankOptions.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.bank_name} · {account.account_number}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}
              </div>

              <Button type="submit" disabled={!can("reports:generate") || !periodId}>
                Generar archivo
              </Button>
              {!can("reports:generate") && (
                <p className="text-xs text-slate-500">Tu rol solo permite consultar los estados en pantalla.</p>
              )}
            </Form>
          </Card>

          {result?.jobId && companyId && (
            <JobPanel
              companyId={companyId}
              jobId={result.jobId}
              label={REPORT_KINDS.find(([value]) => value === result.jobKind)?.[1] ?? "Documento"}
            />
          )}

          {periods.length > 0 && (
            <p className="text-xs text-slate-500">
              Período seleccionado: {periods.find((period) => period.id === periodId)?.label}
              {periodId && periods.find((period) => period.id === periodId)?.is_closed ? " (cerrado)" : ""} ·{" "}
              {shortDate(periods.find((period) => period.id === periodId)?.start_date ?? "")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
