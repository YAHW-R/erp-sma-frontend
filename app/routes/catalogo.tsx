import { useEffect, useState, type ReactNode } from "react";
import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import type { Account, Classification, Nature } from "~/api/types";
import {
  accounts,
  createAccount,
  deleteAccount,
  exportAccounts,
  seedTemplate,
  updateAccount,
} from "~/api/endpoints";
import { errorMessage } from "~/lib/api";
import { intent, optionalText, text, type ActionResult } from "~/lib/forms";
import { activeCompanyId, can } from "~/lib/session";
import { CLASSIFICATIONS } from "~/lib/format";
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
  thClass,
} from "~/components/ui";

const CLASSIFICATION_LABEL: Record<string, string> = {
  ACTIVO: "Activo",
  PASIVO: "Pasivo",
  PATRIMONIO: "Patrimonio",
  INGRESO: "Ingreso",
  COSTO: "Costo",
  GASTO: "Gasto",
  ORDEN: "Orden",
};

type AccountNode = Account & { children: AccountNode[] };

function buildTree(list: Account[]): AccountNode[] {
  const byId = new Map<string, AccountNode>(list.map((account) => [account.id, { ...account, children: [] }]));
  const roots: AccountNode[] = [];
  for (const node of byId.values()) {
    const parent = node.parent_id ? byId.get(node.parent_id) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const sort = (nodes: AccountNode[]) => {
    nodes.sort((a, b) => a.code.localeCompare(b.code));
    nodes.forEach((node) => sort(node.children));
  };
  sort(roots);
  return roots;
}

export async function clientLoader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const companyId = activeCompanyId();
  const search = url.searchParams.get("search") ?? "";
  const classification = url.searchParams.get("classification") ?? "";
  // shortcut: la API tope sus listados en 200; si el catálogo crece, paginar.
  const result = await accounts(companyId, { search, classification });
  return { items: result.items, search, classification, truncated: Boolean(result.meta?.page?.has_more) };
}

export async function clientAction({ request }: { request: Request }): Promise<ActionResult> {
  const form = await request.formData();
  const companyId = activeCompanyId();
  const action = intent(form);

  try {
    if (action === "create") {
      const code = text(form, "code");
      const name = text(form, "name");
      if (!code || !name) return { error: "El código y el nombre son obligatorios." };
      await createAccount(companyId, {
        code,
        name,
        classification: text(form, "classification") as Classification,
        nature: text(form, "nature") as Nature,
        parent_id: optionalText(form, "parent_id") ?? null,
      });
      return { ok: "Cuenta creada." };
    }

    if (action === "update") {
      await updateAccount(companyId, text(form, "account_id"), {
        name: text(form, "name"),
        classification: text(form, "classification") as Classification,
        nature: text(form, "nature") as Nature,
        is_active: form.get("is_active") === "true",
      });
      return { ok: "Cuenta actualizada." };
    }

    if (action === "delete") {
      await deleteAccount(companyId, text(form, "account_id"));
      return { ok: "Cuenta eliminada." };
    }

    if (action === "seed") {
      await seedTemplate(companyId);
      return { ok: "Plantilla VEN-NIF aplicada." };
    }

    return { error: "Acción desconocida." };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}

export default function Catalogo() {
  const { items, search, classification, truncated } = useLoaderData<typeof clientLoader>();
  const result = useActionData<typeof clientAction>();
  const navigation = useNavigation();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [editor, setEditor] = useState<Account | "new" | null>(null);
  const [deleting, setDeleting] = useState<Account | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    if (result) {
      setEditor(null);
      setDeleting(null);
    }
  }, [result]);

  const tree = buildTree(items);
  const busy = navigation.state !== "idle";

  function toggle(id: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function downloadCsv() {
    setExportError(null);
    try {
      const csv = await exportAccounts(activeCompanyId());
      const url = URL.createObjectURL(csv);
      const link = document.createElement("a");
      link.href = url;
      link.download = "catalogo-de-cuentas.csv";
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setExportError(errorMessage(error));
    }
  }

  function renderRows(nodes: AccountNode[], depth = 0): ReactNode[] {
    return nodes.flatMap((node) => {
      const isCollapsed = collapsed.has(node.id);
      const rows: ReactNode[] = [
        <tr key={node.id}>
          <td className={cn(tdClass, "whitespace-nowrap")}>
            <span style={{ paddingLeft: depth * 14 }} className="inline-flex items-center gap-1">
              {node.children.length > 0 ? (
                <button
                  type="button"
                  onClick={() => toggle(node.id)}
                  className="w-4 text-xs text-slate-400 hover:text-slate-700"
                  aria-label={isCollapsed ? "Expandir" : "Contraer"}
                >
                  {isCollapsed ? "▸" : "▾"}
                </button>
              ) : (
                <span className="w-4" />
              )}
              <span className="font-mono text-xs">{node.code}</span>
            </span>
          </td>
          <td className={tdClass}>{node.name}</td>
          <td className={tdClass}>{CLASSIFICATION_LABEL[node.classification] ?? node.classification}</td>
          <td className={tdClass}>{node.nature === "DEUDORA" ? "Deudora" : "Acreedora"}</td>
          <td className={tdClass}>{node.level}</td>
          <td className={tdClass}>{node.is_postable ? "Sí" : "No"}</td>
          <td className={tdClass}>
            <Badge tone={node.is_active ? "green" : "slate"}>{node.is_active ? "Activa" : "Inactiva"}</Badge>
          </td>
          <td className={cn(tdClass, "whitespace-nowrap text-right")}>
            {can("accounts:write") && (
              <button type="button" className="mr-3 text-xs font-medium text-emerald-700 hover:underline" onClick={() => setEditor(node)}>
                Editar
              </button>
            )}
            {can("accounts:delete") && (
              <button type="button" className="text-xs font-medium text-red-600 hover:underline" onClick={() => setDeleting(node)}>
                Eliminar
              </button>
            )}
          </td>
        </tr>,
      ];
      if (!isCollapsed) rows.push(...renderRows(node.children, depth + 1));
      return rows;
    });
  }

  const editing = editor !== null && editor !== "new" ? editor : null;

  return (
    <div>
      <PageHeader
        title="Catálogo de cuentas"
        subtitle="Plan de cuentas VEN-NIF de la empresa activa."
        actions={
          <>
            {items.length > 0 && (
              <Button variant="secondary" size="sm" onClick={downloadCsv} disabled={busy}>
                Exportar CSV
              </Button>
            )}
            {can("accounts:write") && items.length > 0 && (
              <Button size="sm" onClick={() => setEditor("new")}>
                Nueva cuenta
              </Button>
            )}
          </>
        }
      />

      {result?.error && <div className="mb-4"><Alert>{result.error}</Alert></div>}
      {result?.ok && <div className="mb-4"><Alert tone="green">{result.ok}</Alert></div>}
      {exportError && <div className="mb-4"><Alert>{exportError}</Alert></div>}

      <Form method="get" className="mb-4 flex flex-wrap items-end gap-2">
        <Field label="Buscar" htmlFor="search" className="min-w-56 flex-1">
          <Input id="search" name="search" defaultValue={search} placeholder="Código o nombre" />
        </Field>
        <Field label="Clasificación" htmlFor="classification">
          <Select id="classification" name="classification" defaultValue={classification} className="w-44">
            <option value="">Todas</option>
            {CLASSIFICATIONS.map((value) => (
              <option key={value} value={value}>
                {CLASSIFICATION_LABEL[value]}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
      </Form>

      {items.length === 0 ? (
        <EmptyState
          title={search || classification ? "Sin resultados" : "El catálogo está vacío"}
          hint={
            search || classification
              ? "Prueba con otro código, nombre o clasificación."
              : "Aplica la plantilla base para empezar con el plan VEN-NIF completo."
          }
        >
          {!search && !classification && can("accounts:write") && (
            <>
              <Form method="post">
                <input type="hidden" name="intent" value="seed" />
                <SubmitButton pendingLabel="Aplicando…">Aplicar plantilla VEN-NIF</SubmitButton>
              </Form>
              <Button variant="secondary" onClick={() => setEditor("new")}>
                Crear una cuenta
              </Button>
            </>
          )}
        </EmptyState>
      ) : (
        <div className={tableWrap}>
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={thClass}>Código</th>
                <th className={thClass}>Nombre</th>
                <th className={thClass}>Clasificación</th>
                <th className={thClass}>Naturaleza</th>
                <th className={thClass}>Nivel</th>
                <th className={thClass}>Postable</th>
                <th className={thClass}>Estado</th>
                <th className={cn(thClass, "text-right")}>Acciones</th>
              </tr>
            </thead>
            <tbody>{renderRows(tree)}</tbody>
          </table>
        </div>
      )}

      {truncated && (
        <p className="mt-2 text-xs text-amber-700">
          Se muestran las primeras 200 cuentas. Usa el buscador para acotar el catálogo.
        </p>
      )}

      <Dialog
        open={editor !== null}
        onClose={() => setEditor(null)}
        title={editing ? `Editar ${editing.code}` : "Nueva cuenta"}
        description={editing ? "El código no se puede cambiar." : "El nivel se calcula según la cuenta padre."}
      >
        <Form method="post" className="space-y-4">
          <input type="hidden" name="intent" value={editing ? "update" : "create"} />
          {editing && <input type="hidden" name="account_id" value={editing.id} />}

          {!editing && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Código" htmlFor="code">
                <Input id="code" name="code" required placeholder="1.1.01" />
              </Field>
              <Field label="Cuenta padre" htmlFor="parent_id">
                <Select id="parent_id" name="parent_id" defaultValue="">
                  <option value="">Sin padre (nivel 1)</option>
                  {items
                    .filter((account) => account.is_postable === false)
                    .map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.code} · {account.name}
                      </option>
                    ))}
                </Select>
              </Field>
            </div>
          )}

          <Field label="Nombre" htmlFor="name">
            <Input id="name" name="name" required defaultValue={editing?.name ?? ""} />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Clasificación" htmlFor="classification">
              <Select id="classification" name="classification" defaultValue={editing?.classification ?? "ACTIVO"}>
                {CLASSIFICATIONS.map((value) => (
                  <option key={value} value={value}>
                    {CLASSIFICATION_LABEL[value]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Naturaleza" htmlFor="nature">
              <Select id="nature" name="nature" defaultValue={editing?.nature ?? "DEUDORA"}>
                <option value="DEUDORA">Deudora</option>
                <option value="ACREEDORA">Acreedora</option>
              </Select>
            </Field>
          </div>

          {editing && (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="is_active" value="true" defaultChecked={editing.is_active} className="h-4 w-4" />
              Cuenta activa
            </label>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditor(null)}>
              Cancelar
            </Button>
            <SubmitButton pendingLabel="Guardando…">{editing ? "Guardar cambios" : "Crear cuenta"}</SubmitButton>
          </div>
        </Form>
      </Dialog>

      <Dialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={`Eliminar ${deleting?.code ?? ""}`}
        description="Solo se puede eliminar una cuenta sin subcuentas ni movimientos."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              Cancelar
            </Button>
            <Form method="post">
              <input type="hidden" name="intent" value="delete" />
              <input type="hidden" name="account_id" value={deleting?.id ?? ""} />
              <SubmitButton variant="danger" pendingLabel="Eliminando…">
                Eliminar
              </SubmitButton>
            </Form>
          </>
        }
      />
    </div>
  );
}
