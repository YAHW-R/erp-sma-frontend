import { useEffect, useState } from "react";
import { Form, Link, redirect, useActionData, useLoaderData, useNavigation } from "react-router";
import { cancelEntry, duplicateEntry, entry, postEntry } from "~/api/endpoints";
import { errorMessage } from "~/lib/api";
import { intent, text, type ActionResult } from "~/lib/forms";
import { activeCompanyId, can } from "~/lib/session";
import { ENTRY_TYPES, dateTime, money, shortDate, todayISO } from "~/lib/format";
import {
  Alert,
  Badge,
  Button,
  Card,
  Dialog,
  EntryStatusBadge,
  Field,
  Input,
  PageHeader,
  SubmitButton,
  cn,
  tableClass,
  tableWrap,
  tdClass,
  tdNum,
  thClass,
} from "~/components/ui";

const TYPE_LABEL = Object.fromEntries(ENTRY_TYPES) as Record<string, string>;

export async function clientLoader({ params }: { params: { id: string } }) {
  const data = await entry(activeCompanyId(), params.id);
  return { entry: data };
}

export async function clientAction({ request, params }: { request: Request; params: { id: string } }): Promise<ActionResult> {
  const form = await request.formData();
  const action = intent(form);
  const companyId = activeCompanyId();

  try {
    if (action === "post") {
      await postEntry(companyId, params.id);
      return { ok: "Asiento publicado en el Libro Diario." };
    }

    if (action === "cancel") {
      const reason = text(form, "reason");
      if (reason.length < 3) return { error: "Escribe el motivo de la anulación." };
      await cancelEntry(companyId, params.id, reason);
      return { ok: "Asiento anulado." };
    }

    if (action === "duplicate") {
      const date = text(form, "entry_date");
      if (!date) return { error: "Elige la fecha del nuevo asiento." };
      const copy = await duplicateEntry(companyId, params.id, date);
      throw redirect(`/asientos/${copy.id}`);
    }

    return { error: "Acción desconocida." };
  } catch (error) {
    if (error instanceof Response) throw error;
    return { error: errorMessage(error) };
  }
}

export default function AsientoDetalle() {
  const { entry: data } = useLoaderData<typeof clientLoader>();
  const result = useActionData<typeof clientAction>();
  const navigation = useNavigation();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);

  useEffect(() => {
    if (result) {
      setCancelOpen(false);
      setDuplicateOpen(false);
    }
  }, [result]);

  const busy = navigation.state !== "idle";

  return (
    <div>
      <PageHeader
        title={`Asiento N° ${data.number}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {shortDate(data.entry_date)} · {TYPE_LABEL[data.entry_type] ?? data.entry_type}
            <EntryStatusBadge status={data.status} />
            {data.is_balanced ? <Badge tone="green">Cuadrado</Badge> : <Badge tone="red">Descuadrado</Badge>}
          </span>
        }
        actions={
          <>
            <Link to="/asientos" className="text-sm text-slate-500 hover:text-slate-800">
              Volver
            </Link>
            {data.status === "DRAFT" && can("entries:post") && (
              <Form method="post">
                <input type="hidden" name="intent" value="post" />
                <SubmitButton pendingLabel="Publicando…">Publicar</SubmitButton>
              </Form>
            )}
            {can("entries:write") && (
              <Button variant="secondary" onClick={() => setDuplicateOpen(true)}>
                Duplicar
              </Button>
            )}
            {data.status !== "CANCELLED" && can("entries:post") && (
              <Button variant="danger" onClick={() => setCancelOpen(true)}>
                Anular
              </Button>
            )}
          </>
        }
      />

      {result?.error && <div className="mb-4"><Alert>{result.error}</Alert></div>}
      {result?.ok && <div className="mb-4"><Alert tone="green">{result.ok}</Alert></div>}

      {data.status === "CANCELLED" && (
        <div className="mb-4">
          <Alert tone="amber">
            Anulado{data.cancelled_at ? ` el ${dateTime(data.cancelled_at)}` : ""}
            {data.cancel_reason ? `: ${data.cancel_reason}` : ""}
          </Alert>
        </div>
      )}

      <Card className="mb-4 p-4">
        <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Descripción</dt>
            <dd className="mt-0.5 text-slate-800">{data.description}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Referencia</dt>
            <dd className="mt-0.5 text-slate-800">{data.reference ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Creado</dt>
            <dd className="mt-0.5 text-slate-800">{dateTime(data.created_at)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Publicado</dt>
            <dd className="mt-0.5 text-slate-800">{data.posted_at ? dateTime(data.posted_at) : "—"}</dd>
          </div>
        </dl>
      </Card>

      <div className={tableWrap}>
        <table className={tableClass}>
          <thead>
            <tr>
              <th className={thClass}>#</th>
              <th className={thClass}>Código</th>
              <th className={thClass}>Cuenta</th>
              <th className={thClass}>Detalle</th>
              <th className={cn(thClass, "text-right")}>Debe</th>
              <th className={cn(thClass, "text-right")}>Haber</th>
            </tr>
          </thead>
          <tbody>
            {data.lines.map((line) => (
              <tr key={line.id}>
                <td className={tdClass}>{line.line_number}</td>
                <td className={cn(tdClass, "font-mono text-xs")}>{line.account_code}</td>
                <td className={tdClass}>{line.account_name}</td>
                <td className={tdClass}>{line.description ?? "—"}</td>
                <td className={tdNum}>{money(line.debit)}</td>
                <td className={tdNum}>{money(line.credit)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 font-semibold">
              <td className={tdClass} colSpan={4}>
                Totales
              </td>
              <td className={tdNum}>{money(data.total_debit)}</td>
              <td className={tdNum}>{money(data.total_credit)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <Dialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title={`Anular el asiento N° ${data.number}`}
        description="La anulación no borra el asiento: queda en el histórico con su motivo."
      >
        <Form method="post" className="space-y-4">
          <input type="hidden" name="intent" value="cancel" />
          <Field label="Motivo" htmlFor="reason">
            <Input id="reason" name="reason" required maxLength={500} placeholder="Error en el monto de la línea 2" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCancelOpen(false)}>
              Cancelar
            </Button>
            <SubmitButton variant="danger" pendingLabel="Anulando…" disabled={busy}>
              Anular asiento
            </SubmitButton>
          </div>
        </Form>
      </Dialog>

      <Dialog
        open={duplicateOpen}
        onClose={() => setDuplicateOpen(false)}
        title={`Duplicar el asiento N° ${data.number}`}
        description="Se crea un borrador nuevo con las mismas líneas y un número correlativo."
      >
        <Form method="post" className="space-y-4">
          <input type="hidden" name="intent" value="duplicate" />
          <Field label="Fecha del nuevo asiento" htmlFor="entry_date">
            <Input id="entry_date" name="entry_date" type="date" defaultValue={todayISO()} required />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDuplicateOpen(false)}>
              Cancelar
            </Button>
            <SubmitButton pendingLabel="Duplicando…" disabled={busy}>
              Crear copia
            </SubmitButton>
          </div>
        </Form>
      </Dialog>
    </div>
  );
}
