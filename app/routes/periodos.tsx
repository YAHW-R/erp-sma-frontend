import { useEffect, useState } from "react";
import { Form, Link, redirect, useActionData, useLoaderData, useNavigation } from "react-router";
import type { FiscalPeriod } from "~/api/types";
import { closePeriod, createFiscalYear, fiscalPeriods, fiscalYears, reopenPeriod } from "~/api/endpoints";
import { errorMessage } from "~/lib/api";
import { intent, number, text, type ActionResult } from "~/lib/forms";
import { activeCompanyId, can } from "~/lib/session";
import { dateTime, shortDate } from "~/lib/format";
import {
  Alert,
  Badge,
  Button,
  Dialog,
  EmptyState,
  Field,
  Input,
  PageHeader,
  SubmitButton,
  Textarea,
  cn,
} from "~/components/ui";

export async function clientLoader({ request }: { request: Request }) {
  const companyId = activeCompanyId();
  const years = await fiscalYears(companyId);
  const requested = Number(new URL(request.url).searchParams.get("year")) || null;
  const year = requested ?? (years.length ? Math.max(...years.map((item) => item.year)) : new Date().getFullYear());
  const periods = years.some((item) => item.year === year) ? await fiscalPeriods(companyId, year) : [];
  return { years, year, periods };
}

export async function clientAction({ request }: { request: Request }): Promise<ActionResult> {
  const form = await request.formData();
  const companyId = activeCompanyId();
  const action = intent(form);

  try {
    if (action === "create-year") {
      const year = number(form, "year");
      if (year < 2000 || year > 2100) return { error: "El año debe estar entre 2000 y 2100." };
      await createFiscalYear(companyId, year);
      throw redirect(`?year=${year}`);
    }

    if (action === "close") {
      await closePeriod(text(form, "period_id"));
      return { ok: "Período cerrado. El mes queda congelado." };
    }

    if (action === "reopen") {
      const reason = text(form, "reason");
      if (reason.length < 3) return { error: "Escribe el motivo de la reapertura." };
      await reopenPeriod(text(form, "period_id"), reason);
      return { ok: "Período reabierto." };
    }

    return { error: "Acción desconocida." };
  } catch (error) {
    if (error instanceof Response) throw error;
    return { error: errorMessage(error) };
  }
}

export default function Periodos() {
  const { years, year, periods } = useLoaderData<typeof clientLoader>();
  const result = useActionData<typeof clientAction>();
  const navigation = useNavigation();
  const [closeTarget, setCloseTarget] = useState<FiscalPeriod | null>(null);
  const [reopenTarget, setReopenTarget] = useState<FiscalPeriod | null>(null);

  useEffect(() => {
    if (result) {
      setCloseTarget(null);
      setReopenTarget(null);
    }
  }, [result]);

  const busy = navigation.state !== "idle";

  return (
    <div>
      <PageHeader
        title="Períodos fiscales"
        subtitle="Cada año crea sus doce meses. Cerrar un mes congela sus asientos y guarda el acta de cifras."
      />

      {result?.error && <div className="mb-4"><Alert>{result.error}</Alert></div>}
      {result?.ok && <div className="mb-4"><Alert tone="green">{result.ok}</Alert></div>}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {years.map((item) => (
          <Link
            key={item.id}
            to={`?year=${item.year}`}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium",
              item.year === year ? "bg-emerald-700 text-white" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
            )}
          >
            {item.year}
          </Link>
        ))}

        {can("periods:read") && (
          <Form method="post" className="flex items-center gap-2">
            <input type="hidden" name="intent" value="create-year" />
            <Input name="year" type="number" min={2000} max={2100} defaultValue={year} className="w-28" aria-label="Año fiscal" />
            <Button type="submit" variant="secondary" size="sm" disabled={busy}>
              Crear año
            </Button>
          </Form>
        )}
      </div>

      {periods.length === 0 ? (
        <EmptyState
          title={`Sin períodos en ${year}`}
          hint="Crea el año fiscal para que puedas registrar asientos con fecha dentro de él."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {periods.map((period) => (
            <div key={period.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">{period.label}</p>
                  <p className="text-xs text-slate-500">
                    {shortDate(period.start_date)} — {shortDate(period.end_date)}
                  </p>
                </div>
                <Badge tone={period.is_closed ? "red" : "green"}>{period.is_closed ? "Cerrado" : "Abierto"}</Badge>
              </div>

              {period.closed_at && (
                <p className="mt-2 text-xs text-slate-500">Cerrado el {dateTime(period.closed_at)}</p>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Link
                  to={`/asientos?period_id=${period.id}`}
                  className="text-xs font-medium text-emerald-700 hover:underline"
                >
                  Ver asientos
                </Link>

                {!period.is_closed && can("periods:close") && (
                  <Button variant="secondary" size="sm" className="ml-auto" onClick={() => setCloseTarget(period)}>
                    Cerrar mes
                  </Button>
                )}

                {period.is_closed && can("periods:reopen") && (
                  <Button variant="secondary" size="sm" className="ml-auto" onClick={() => setReopenTarget(period)}>
                    Reabrir
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={closeTarget !== null}
        onClose={() => setCloseTarget(null)}
        title={`Cerrar ${closeTarget?.label ?? ""}`}
        description="El cierre congela el período: no se podrán registrar, publicar ni anular asientos con fecha dentro de él."
        footer={
          <>
            <Button variant="secondary" onClick={() => setCloseTarget(null)}>
              Cancelar
            </Button>
            <Form method="post">
              <input type="hidden" name="intent" value="close" />
              <input type="hidden" name="period_id" value={closeTarget?.id ?? ""} />
              <SubmitButton variant="danger" pendingLabel="Cerrando…">
                Cerrar el mes
              </SubmitButton>
            </Form>
          </>
        }
      />

      <Dialog
        open={reopenTarget !== null}
        onClose={() => setReopenTarget(null)}
        title={`Reabrir ${reopenTarget?.label ?? ""}`}
        description="La reapertura queda registrada en la auditoría. Explica por qué es necesaria."
      >
        <Form method="post" className="space-y-4">
          <input type="hidden" name="intent" value="reopen" />
          <input type="hidden" name="period_id" value={reopenTarget?.id ?? ""} />
          <Field label="Motivo" htmlFor="reason">
            <Textarea id="reason" name="reason" required maxLength={500} placeholder="Corrección de un asiento mal registrado" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setReopenTarget(null)}>
              Cancelar
            </Button>
            <SubmitButton variant="danger" pendingLabel="Reabriendo…">
              Reabrir el mes
            </SubmitButton>
          </div>
        </Form>
      </Dialog>
    </div>
  );
}
