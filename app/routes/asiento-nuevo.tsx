import { useState } from "react";
import { Form, Link, redirect, useActionData, useLoaderData } from "react-router";
import type { EntryType } from "~/api/types";
import { accounts, createEntry } from "~/api/endpoints";
import { errorMessage } from "~/lib/api";
import { optionalText, text } from "~/lib/forms";
import { activeCompanyId, can } from "~/lib/session";
import { ENTRY_TYPES, addMoney, money, moneyEqual, normalizeMoney, subMoney, todayISO } from "~/lib/format";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  SubmitButton,
} from "~/components/ui";

type Row = { account: string; description: string; debit: string; credit: string };

const EMPTY_ROW: Row = { account: "", description: "", debit: "", credit: "" };

export async function clientLoader() {
  const result = await accounts(activeCompanyId());
  return { items: result.items.filter((account) => account.is_postable && account.is_active) };
}

export async function clientAction({ request }: { request: Request }) {
  const form = await request.formData();
  const entryDate = text(form, "entry_date");
  const entryType = text(form, "entry_type") as EntryType;
  const description = text(form, "description");

  if (!entryDate) return { error: "La fecha es obligatoria." };
  if (!description) return { error: "La descripción es obligatoria." };
  if (!ENTRY_TYPES.some(([value]) => value === entryType)) return { error: "El tipo de asiento no es válido." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entryDate)) return { error: "La fecha debe tener el formato AAAA-MM-DD." };

  const accountIds = form.getAll("line_account").map(String);
  const lineDescriptions = form.getAll("line_description").map((value) => String(value).trim());
  const debits = form.getAll("line_debit").map(String);
  const credits = form.getAll("line_credit").map(String);

  const lines: { account_id: string; description?: string; debit: string; credit: string }[] = [];

  for (let index = 0; index < accountIds.length; index += 1) {
    const accountId = accountIds[index];
    const rawDebit = (debits[index] ?? "").trim();
    const rawCredit = (credits[index] ?? "").trim();
    if (!accountId && !rawDebit && !rawCredit) continue;
    if (!accountId) return { error: `Línea ${index + 1}: elige una cuenta.` };

    const debit = normalizeMoney(rawDebit || "0");
    const credit = normalizeMoney(rawCredit || "0");
    if (debit === null || credit === null) return { error: `Línea ${index + 1}: el monto no es válido.` };
    if (debit === "0.0000" && credit === "0.0000") continue;

    lines.push({
      account_id: accountId,
      description: lineDescriptions[index] || undefined,
      debit,
      credit,
    });
  }

  if (lines.length < 2) return { error: "Un asiento necesita al menos dos líneas con movimiento." };

  const totalDebit = addMoney(lines.map((line) => line.debit));
  const totalCredit = addMoney(lines.map((line) => line.credit));
  if (!moneyEqual(totalDebit, totalCredit)) {
    return { error: `El asiento no cuadra: debe ${money(totalDebit)} y haber ${money(totalCredit)}.` };
  }

  try {
    const created = await createEntry(activeCompanyId(), {
      entry_date: entryDate,
      entry_type: entryType,
      description,
      reference: optionalText(form, "reference"),
      lines,
    });
    throw redirect(`/asientos/${created.id}`);
  } catch (error) {
    if (error instanceof Response) throw error;
    return { error: errorMessage(error) };
  }
}

export default function NuevoAsiento() {
  const { items } = useLoaderData<typeof clientLoader>();
  const result = useActionData<typeof clientAction>();
  const [rows, setRows] = useState<Row[]>([{ ...EMPTY_ROW }, { ...EMPTY_ROW }]);

  if (!can("entries:write")) {
    return <EmptyState title="Sin permiso para registrar asientos" hint="Tu rol en esta empresa es de solo lectura." />;
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title="No hay cuentas postables"
        hint="Antes de registrar asientos necesitas un catálogo con cuentas activas que admitan movimientos."
      >
        <Link to="/catalogo" className="text-sm font-medium text-emerald-700 hover:underline">
          Ir al catálogo
        </Link>
      </EmptyState>
    );
  }

  function update(index: number, patch: Partial<Row>) {
    setRows((current) => current.map((row, position) => (position === index ? { ...row, ...patch } : row)));
  }

  function addRow() {
    setRows((current) => [...current, { ...EMPTY_ROW }]);
  }

  function removeRow(index: number) {
    setRows((current) => current.filter((_, position) => position !== index));
  }

  const totals = {
    debit: addMoney(rows.map((row) => normalizeMoney(row.debit || "0") ?? "0")),
    credit: addMoney(rows.map((row) => normalizeMoney(row.credit || "0") ?? "0")),
  };
  const filled = rows.filter(
    (row) => row.account && (normalizeMoney(row.debit || "0") !== "0.0000" || normalizeMoney(row.credit || "0") !== "0.0000"),
  ).length;
  const balanced = filled >= 2 && moneyEqual(totals.debit, totals.credit) && totals.debit !== "0.0000";

  return (
    <div>
      <PageHeader
        title="Nuevo asiento"
        subtitle="Se guarda como borrador. Publícalo después para que entre al Libro Diario."
        actions={
          <Link to="/asientos" className="text-sm text-slate-500 hover:text-slate-800">
            Volver
          </Link>
        }
      />

      <Form method="post" className="space-y-4">
        {result?.error && <Alert>{result.error}</Alert>}

        <Card className="p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Fecha" htmlFor="entry_date">
              <Input id="entry_date" name="entry_date" type="date" defaultValue={todayISO()} required />
            </Field>
            <Field label="Tipo" htmlFor="entry_type">
              <Select id="entry_type" name="entry_type" defaultValue="DIARIO">
                {ENTRY_TYPES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Descripción" htmlFor="description" className="sm:col-span-2 lg:col-span-2">
              <Input id="description" name="description" required placeholder="Venta de mercancía de contado" />
            </Field>
            <Field label="Referencia" htmlFor="reference" className="sm:col-span-2 lg:col-span-2">
              <Input id="reference" name="reference" placeholder="Factura, comprobante o nota" />
            </Field>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-800">Líneas</h2>
            <Button variant="secondary" size="sm" onClick={addRow}>
              Añadir línea
            </Button>
          </div>

          <div className="hidden gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:grid sm:grid-cols-[minmax(0,2fr)_minmax(0,1.6fr)_8.5rem_8.5rem_2rem]">
            <span>Cuenta</span>
            <span>Descripción</span>
            <span className="text-right">Debe</span>
            <span className="text-right">Haber</span>
            <span />
          </div>

          <div className="divide-y divide-slate-100">
            {rows.map((row, index) => (
              <div
                key={index}
                className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.6fr)_8.5rem_8.5rem_2rem] sm:items-start"
              >
                <Select
                  name="line_account"
                  value={row.account}
                  onChange={(event) => update(index, { account: event.target.value })}
                  aria-label={`Cuenta de la línea ${index + 1}`}
                >
                  <option value="">Elige una cuenta</option>
                  {items.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.code} · {account.name}
                    </option>
                  ))}
                </Select>

                <Input
                  name="line_description"
                  value={row.description}
                  onChange={(event) => update(index, { description: event.target.value })}
                  placeholder="Detalle (opcional)"
                  aria-label={`Descripción de la línea ${index + 1}`}
                />

                <Input
                  name="line_debit"
                  value={row.debit}
                  onChange={(event) =>
                    update(index, { debit: event.target.value, ...(event.target.value ? { credit: "" } : {}) })
                  }
                  placeholder="0,00"
                  inputMode="decimal"
                  className="text-right tabular-nums"
                  aria-label={`Debe de la línea ${index + 1}`}
                />

                <Input
                  name="line_credit"
                  value={row.credit}
                  onChange={(event) =>
                    update(index, { credit: event.target.value, ...(event.target.value ? { debit: "" } : {}) })
                  }
                  placeholder="0,00"
                  inputMode="decimal"
                  className="text-right tabular-nums"
                  aria-label={`Haber de la línea ${index + 1}`}
                />

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeRow(index)}
                  disabled={rows.length <= 2}
                  aria-label={`Quitar línea ${index + 1}`}
                  className="justify-self-end"
                >
                  ✕
                </Button>
              </div>
            ))}
          </div>

          <div className="grid gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm sm:grid-cols-[minmax(0,2fr)_minmax(0,1.6fr)_8.5rem_8.5rem_2rem]">
            <p className="font-semibold text-slate-700 sm:col-span-2">Totales</p>
            <p className="text-right font-semibold tabular-nums">{money(totals.debit)}</p>
            <p className="text-right font-semibold tabular-nums">{money(totals.credit)}</p>
            <span />
          </div>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            {balanced ? (
              <Badge tone="green">El asiento cuadra</Badge>
            ) : filled >= 2 ? (
              <Badge tone="amber">Diferencia: {money(subMoney(totals.debit, totals.credit))}</Badge>
            ) : (
              <span className="text-xs text-slate-500">Añade al menos dos líneas con movimiento.</span>
            )}
          </div>

          <SubmitButton disabled={!balanced} pendingLabel="Guardando…">
            Guardar borrador
          </SubmitButton>
        </div>
      </Form>
    </div>
  );
}
