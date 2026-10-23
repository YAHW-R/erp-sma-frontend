import { useEffect, useState } from "react";
import { Form, Link, useActionData, useLoaderData } from "react-router";
import {
  accounts,
  bankAccounts,
  bankStatements,
  createBankAccount,
  reconcileStatement,
  uploadStatement,
} from "~/api/endpoints";
import { errorMessage } from "~/lib/api";
import { intent, text } from "~/lib/forms";
import { activeCompany, activeCompanyId, can } from "~/lib/session";
import { dateTime, shortDate, todayISO } from "~/lib/format";
import { ReconcileJob } from "~/components/reconcile-job";
import {
  Alert,
  Badge,
  Button,
  Dialog,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  SubmitButton,
  cn,
  tableClass,
  tableWrap,
  tdClass,
  tdNum,
  thClass,
} from "~/components/ui";

const BANKS = [
  ["BANESCO", "Banesco"],
  ["MERCANTIL", "Mercantil"],
  ["PROVINCIAL", "BBVA Provincial"],
  ["BANCO_DE_VENEZUELA", "Banco de Venezuela"],
] as const;

type ActionResult = { ok?: string; error?: string; jobId?: string; statementId?: string };

export async function clientLoader() {
  const companyId = activeCompanyId();
  const [bankList, statementPage] = await Promise.all([bankAccounts(companyId), bankStatements(companyId)]);
  const accountOptions = can("accounts:read")
    ? (await accounts(companyId)).items.filter((item) => item.is_active && item.is_postable && item.classification === "ACTIVO")
    : [];
  return { bankList, statements: statementPage.items, accountOptions, currency: activeCompany()?.currency_code ?? "VES" };
}

export async function clientAction({ request }: { request: Request }): Promise<ActionResult> {
  const form = await request.formData();
  const companyId = activeCompanyId();
  const action = intent(form);

  try {
    if (action === "create-account") {
      await createBankAccount(companyId, {
        account_id: text(form, "account_id"),
        bank_name: text(form, "bank_name"),
        account_number: text(form, "account_number"),
        currency: text(form, "currency") || "VES",
      });
      return { ok: "Cuenta bancaria creada." };
    }

    if (action === "upload") {
      const file = form.get("file");
      if (!(file instanceof File) || file.size === 0) return { error: "Selecciona el archivo del extracto." };
      await uploadStatement(companyId, form);
      return { ok: "Extracto cargado y movimientos extraídos." };
    }

    if (action === "reconcile") {
      const statementId = text(form, "statement_id");
      const result = await reconcileStatement(companyId, statementId);
      return { jobId: result.job_id, statementId };
    }

    return { error: "Acción desconocida." };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}

export default function Banco() {
  const { bankList, statements, accountOptions, currency } = useLoaderData<typeof clientLoader>();
  const result = useActionData<typeof clientAction>();
  const [newAccount, setNewAccount] = useState(false);
  const [uploading, setUploading] = useState(false);
  const companyId = activeCompany()?.id ?? "";

  useEffect(() => {
    if (result) {
      setNewAccount(false);
      setUploading(false);
    }
  }, [result]);

  return (
    <div>
      <PageHeader
        title="Conciliación bancaria"
        subtitle="Sube el extracto del banco y cruza sus movimientos con los asientos."
        actions={
          can("bank:write") && (
            <>
              <Button variant="secondary" onClick={() => setNewAccount(true)} disabled={accountOptions.length === 0}>
                Nueva cuenta bancaria
              </Button>
              <Button onClick={() => setUploading(true)} disabled={bankList.length === 0}>
                Subir extracto
              </Button>
            </>
          )
        }
      />

      {result?.error && <div className="mb-4"><Alert>{result.error}</Alert></div>}
      {result?.ok && <div className="mb-4"><Alert tone="green">{result.ok}</Alert></div>}

      {result?.jobId && companyId && <div className="mb-4"><ReconcileJob companyId={companyId} jobId={result.jobId} /></div>}

      {bankList.length === 0 ? (
        <EmptyState
          title="Sin cuentas bancarias"
          hint={
            accountOptions.length === 0
              ? "Primero necesitas una cuenta contable de activo postable en el catálogo."
              : "Registra la cuenta del banco para poder cargar sus extractos."
          }
        >
          {can("bank:write") && accountOptions.length > 0 && (
            <Button onClick={() => setNewAccount(true)}>Crear cuenta bancaria</Button>
          )}
          {accountOptions.length === 0 && (
            <Link to="/catalogo" className="text-sm font-medium text-emerald-700 hover:underline">
              Ir al catálogo
            </Link>
          )}
        </EmptyState>
      ) : (
        <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {bankList.map((account) => (
            <div key={account.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">{account.bank_name}</p>
                  <p className="text-xs text-slate-500">{account.account_number}</p>
                </div>
                <Badge tone={account.is_active ? "green" : "slate"}>{account.is_active ? "Activa" : "Inactiva"}</Badge>
              </div>
              <p className="mt-2 text-xs text-slate-500">Cuenta contable {account.account_id.slice(0, 8)}… · {account.currency}</p>
            </div>
          ))}
        </div>
      )}

      {statements.length > 0 && (
        <>
          <h2 className="mb-2 text-sm font-semibold text-slate-800">Extractos cargados</h2>
          <div className={tableWrap}>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Fecha</th>
                  <th className={thClass}>Banco</th>
                  <th className={thClass}>Archivo</th>
                  <th className={cn(thClass, "text-right")}>Movimientos</th>
                  <th className={cn(thClass, "text-right")}>Pendientes</th>
                  <th className={cn(thClass, "text-right")}>Cruzados</th>
                  <th className={cn(thClass, "text-right")}>Discrepancias</th>
                  <th className={thClass}>Cargado</th>
                  <th className={thClass} />
                </tr>
              </thead>
              <tbody>
                {statements.map((statement) => (
                  <tr key={statement.id}>
                    <td className={cn(tdClass, "whitespace-nowrap")}>{shortDate(statement.statement_date)}</td>
                    <td className={tdClass}>
                      <p className="font-medium text-slate-800">{statement.bank_name}</p>
                      <p className="text-xs text-slate-500">{statement.account_number}</p>
                    </td>
                    <td className={tdClass}>{statement.file_name}</td>
                    <td className={tdNum}>{statement.transaction_count}</td>
                    <td className={tdNum}>{statement.pending_count}</td>
                    <td className={tdNum}>{statement.matched_count}</td>
                    <td className={tdNum}>{statement.discrepancy_count}</td>
                    <td className={cn(tdClass, "whitespace-nowrap text-xs")}>{dateTime(statement.uploaded_at)}</td>
                    <td className={cn(tdClass, "text-right")}>
                      <div className="flex items-center justify-end gap-3">
                        <Link to={`/banco/${statement.id}`} className="text-xs font-medium text-emerald-700 hover:underline">
                          Abrir
                        </Link>
                        {can("bank:reconcile") && (
                          <Form method="post">
                            <input type="hidden" name="intent" value="reconcile" />
                            <input type="hidden" name="statement_id" value={statement.id} />
                            <SubmitButton variant="secondary" size="sm" pendingLabel="Encolando…">
                              Conciliar
                            </SubmitButton>
                          </Form>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Dialog
        open={newAccount}
        onClose={() => setNewAccount(false)}
        title="Nueva cuenta bancaria"
        description="La cuenta contable debe ser de activo y admitir movimientos."
      >
        <Form method="post" className="space-y-3">
          <input type="hidden" name="intent" value="create-account" />
          <Field label="Cuenta contable" htmlFor="account_id">
            <Select id="account_id" name="account_id" required>
              <option value="">Elige la cuenta</option>
              {accountOptions.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code} · {account.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Banco" htmlFor="bank_name">
              <Select id="bank_name" name="bank_name" required>
                {BANKS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Moneda" htmlFor="currency">
              <Input id="currency" name="currency" defaultValue={currency} required maxLength={3} />
            </Field>
          </div>
          <Field label="Número de cuenta" htmlFor="account_number">
            <Input id="account_number" name="account_number" required placeholder="0000-0000-0000-0001" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setNewAccount(false)}>
              Cancelar
            </Button>
            <SubmitButton pendingLabel="Guardando…">Crear cuenta</SubmitButton>
          </div>
        </Form>
      </Dialog>

      <Dialog
        open={uploading}
        onClose={() => setUploading(false)}
        title="Subir extracto bancario"
        description="CSV o Excel exportado por el banco. Formatos: Banesco, Mercantil, Provincial y Banco de Venezuela."
      >
        <Form method="post" encType="multipart/form-data" className="space-y-3">
          <input type="hidden" name="intent" value="upload" />
          <Field label="Cuenta bancaria" htmlFor="bank_account_id">
            <Select id="bank_account_id" name="bank_account_id" required>
              {bankList.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.bank_name} · {account.account_number}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Fecha del extracto" htmlFor="statement_date">
            <Input id="statement_date" name="statement_date" type="date" defaultValue={todayISO()} />
          </Field>
          <Field label="Archivo" htmlFor="file">
            <Input id="file" name="file" type="file" accept=".csv,.xlsx,.xlsm" required />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setUploading(false)}>
              Cancelar
            </Button>
            <SubmitButton pendingLabel="Subiendo…">Cargar extracto</SubmitButton>
          </div>
        </Form>
      </Dialog>
    </div>
  );
}
