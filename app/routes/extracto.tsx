import { useEffect, useState } from "react";
import { Form, Link, useActionData, useLoaderData } from "react-router";
import type { BankTransaction } from "~/api/types";
import {
  bankStatement,
  discardTransaction,
  entries,
  fiscalPeriods,
  matchTransaction,
  reconcileStatement,
  statementTransactions,
  unmatchTransaction,
} from "~/api/endpoints";
import { errorMessage } from "~/lib/api";
import { intent, text } from "~/lib/forms";
import { activeCompanyId, can } from "~/lib/session";
import { dateTime, money, moneyEqual, shortDate } from "~/lib/format";
import { ReconcileJob } from "~/components/reconcile-job";
import {
  Alert,
  Badge,
  Button,
  Dialog,
  EmptyState,
  PageHeader,
  Stat,
  SubmitButton,
  cn,
  tableClass,
  tableWrap,
  tdClass,
  tdNum,
  thClass,
} from "~/components/ui";

type ActionResult = { ok?: string; error?: string; jobId?: string };

const STATUS: Record<string, { label: string; tone: "amber" | "green" | "red" }> = {
  PENDING: { label: "Pendiente", tone: "amber" },
  MATCHED: { label: "Cruzado", tone: "green" },
  DISCREPANCY: { label: "Discrepancia", tone: "red" },
};

export async function clientLoader({ params }: { params: { id: string } }) {
  const companyId = activeCompanyId();
  const statement = await bankStatement(companyId, params.id);
  const year = Number(statement.statement_date.slice(0, 4));
  const periods = await fiscalPeriods(companyId, year);
  const day = statement.statement_date;
  const period = periods.find(
    (item) => item.start_date.slice(0, 10) <= day && day <= item.end_date.slice(0, 10),
  );
  const transactions = await statementTransactions(companyId, params.id);
  const candidates = period
    ? (await entries(companyId, { period_id: period.id, status: "POSTED", limit: 200 })).items
    : [];

  return {
    statement,
    transactions: transactions.items,
    truncated: Boolean(transactions.meta?.page?.has_more),
    candidates,
  };
}

export async function clientAction({ request }: { request: Request }): Promise<ActionResult> {
  const form = await request.formData();
  const companyId = activeCompanyId();
  const action = intent(form);

  try {
    if (action === "match") {
      await matchTransaction(companyId, text(form, "transaction_id"), text(form, "line_id"));
      return { ok: "Movimiento cruzado con el asiento." };
    }

    if (action === "unmatch") {
      await unmatchTransaction(companyId, text(form, "transaction_id"));
      return { ok: "Cruce deshecho." };
    }

    if (action === "discard") {
      await discardTransaction(companyId, text(form, "transaction_id"));
      return { ok: "Movimiento descartado." };
    }

    if (action === "reconcile") {
      const result = await reconcileStatement(companyId, text(form, "statement_id"));
      return { jobId: result.job_id };
    }

    return { error: "Acción desconocida." };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}

function amountOf(transaction: BankTransaction): string {
  return transaction.amount.startsWith("-") ? transaction.amount.slice(1) : transaction.amount;
}

function amountLabel(transaction: BankTransaction): string {
  return money(transaction.amount);
}

export default function Extracto() {
  const { statement, transactions, truncated, candidates } = useLoaderData<typeof clientLoader>();
  const result = useActionData<typeof clientAction>();
  const [matchTarget, setMatchTarget] = useState<BankTransaction | null>(null);
  const companyId = activeCompanyId();

  useEffect(() => {
    if (result) setMatchTarget(null);
  }, [result]);

  const amountAbs = matchTarget ? amountOf(matchTarget) : null;
  const matches = amountAbs
    ? candidates.flatMap((entry) =>
        entry.lines
          .filter((line) => line.debit !== "0.0000" || line.credit !== "0.0000")
          .filter((line) => moneyEqual(amountAbs, line.debit) || moneyEqual(amountAbs, line.credit))
          .map((line) => ({ entry, line })),
      )
    : [];

  return (
    <div>
      <PageHeader
        title={`Extracto ${statement.bank_name}`}
        subtitle={
          <span>
            {statement.account_number} · {shortDate(statement.statement_date)} · {statement.file_name}
          </span>
        }
        actions={
          <>
            <Link to="/banco" className="text-sm text-slate-500 hover:text-slate-800">
              Volver
            </Link>
            {can("bank:reconcile") && (
              <Form method="post">
                <input type="hidden" name="intent" value="reconcile" />
                <input type="hidden" name="statement_id" value={statement.id} />
                <SubmitButton pendingLabel="Encolando…">Conciliar automático</SubmitButton>
              </Form>
            )}
          </>
        }
      />

      {result?.error && <div className="mb-4"><Alert>{result.error}</Alert></div>}
      {result?.ok && <div className="mb-4"><Alert tone="green">{result.ok}</Alert></div>}
      {result?.jobId && <div className="mb-4"><ReconcileJob companyId={companyId} jobId={result.jobId} /></div>}

      <div className="mb-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Movimientos" value={statement.transaction_count} />
        <Stat label="Pendientes" value={statement.pending_count} />
        <Stat label="Cruzados" value={statement.matched_count} />
        <Stat label="Discrepancias" value={statement.discrepancy_count} />
        <Stat label="Saldo inicial" value={money(statement.initial_balance)} />
        <Stat label="Saldo final" value={money(statement.final_balance)} />
      </div>

      {transactions.length === 0 ? (
        <EmptyState title="El extracto no tiene movimientos" hint="Vuelve a cargar el archivo del banco." />
      ) : (
        <div className={tableWrap}>
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={thClass}>Fecha</th>
                <th className={thClass}>Referencia</th>
                <th className={thClass}>Descripción</th>
                <th className={cn(thClass, "text-right")}>Monto</th>
                <th className={thClass}>Estado</th>
                <th className={thClass}>Sugerencia</th>
                <th className={thClass} />
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => {
                const status = STATUS[transaction.status] ?? { label: transaction.status, tone: "amber" as const };
                const suggestion = transaction.suggestion;
                return (
                  <tr key={transaction.id}>
                    <td className={cn(tdClass, "whitespace-nowrap")}>{shortDate(transaction.transaction_date)}</td>
                    <td className={tdClass}>{transaction.reference ?? "—"}</td>
                    <td className={tdClass}>{transaction.description ?? "—"}</td>
                    <td className={tdNum}>{amountLabel(transaction)}</td>
                    <td className={tdClass}>
                      <Badge tone={status.tone}>{status.label}</Badge>
                      {transaction.match_source && (
                        <p className="mt-1 text-xs text-slate-500">
                          {transaction.match_source === "AUTO" ? "Automático" : "Manual"}
                          {transaction.reconciled_at ? ` · ${dateTime(transaction.reconciled_at)}` : ""}
                        </p>
                      )}
                    </td>
                    <td className={tdClass}>
                      {suggestion ? (
                        <div className="text-xs">
                          <p className="font-medium text-slate-800">
                            Asiento #{suggestion.entry_number}
                            {suggestion.ambiguous ? " · varias coincidencias" : ""}
                          </p>
                          <p className="text-slate-500">{suggestion.entry_description}</p>
                          <p className="text-slate-500">
                            {shortDate(suggestion.entry_date)} · {suggestion.days_apart} día(s)
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">Sin sugerencia</span>
                      )}
                    </td>
                    <td className={cn(tdClass, "text-right")}>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {can("bank:reconcile") && transaction.status !== "MATCHED" && (
                          <>
                            {suggestion && !suggestion.ambiguous && (
                              <Form method="post">
                                <input type="hidden" name="intent" value="match" />
                                <input type="hidden" name="transaction_id" value={transaction.id} />
                                <input type="hidden" name="line_id" value={suggestion.line_id} />
                                <SubmitButton variant="secondary" size="sm" pendingLabel="Cruzando…">
                                  Cruzar
                                </SubmitButton>
                              </Form>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => setMatchTarget(transaction)}>
                              Elegir línea
                            </Button>
                            <Form method="post">
                              <input type="hidden" name="intent" value="discard" />
                              <input type="hidden" name="transaction_id" value={transaction.id} />
                              <SubmitButton variant="ghost" size="sm" pendingLabel="Descartando…">
                                Descartar
                              </SubmitButton>
                            </Form>
                          </>
                        )}
                        {can("bank:reconcile") && transaction.status === "MATCHED" && (
                          <Form method="post">
                            <input type="hidden" name="intent" value="unmatch" />
                            <input type="hidden" name="transaction_id" value={transaction.id} />
                            <SubmitButton variant="ghost" size="sm" pendingLabel="Deshaciendo…">
                              Deshacer
                            </SubmitButton>
                          </Form>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {truncated && (
        <p className="mt-2 text-xs text-amber-700">Se muestran los primeros 200 movimientos del extracto.</p>
      )}

      <Dialog
        open={matchTarget !== null}
        onClose={() => setMatchTarget(null)}
        title="Elegir la línea del asiento"
        description={
          matchTarget
            ? `Movimiento del ${shortDate(matchTarget.transaction_date)} por ${amountLabel(matchTarget)}. Se muestran las líneas publicadas del período con el mismo monto.`
            : undefined
        }
      >
        {matches.length === 0 ? (
          <Alert tone="amber">
            No hay líneas publicadas con ese monto en el período del extracto. Revisa el asiento o registra uno nuevo.
          </Alert>
        ) : (
          <div className="max-h-80 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
            {matches.map(({ entry, line }) => (
              <div key={line.id} className="flex items-start justify-between gap-3 p-3">
                <div className="min-w-0 text-sm">
                  <p className="font-medium text-slate-800">
                    Asiento #{entry.number} · {shortDate(entry.entry_date)}
                  </p>
                  <p className="truncate text-xs text-slate-500">{entry.description}</p>
                  <p className="text-xs text-slate-500">
                    {line.account_code} · {line.account_name} ·{" "}
                    {line.debit !== "0.0000" ? `Debe ${money(line.debit)}` : `Haber ${money(line.credit)}`}
                  </p>
                </div>
                <Form method="post">
                  <input type="hidden" name="intent" value="match" />
                  <input type="hidden" name="transaction_id" value={matchTarget?.id ?? ""} />
                  <input type="hidden" name="line_id" value={line.id} />
                  <SubmitButton variant="secondary" size="sm" pendingLabel="Cruzando…">
                    Cruzar
                  </SubmitButton>
                </Form>
              </div>
            ))}
          </div>
        )}
      </Dialog>
    </div>
  );
}
