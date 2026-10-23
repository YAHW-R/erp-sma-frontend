import { useEffect, useState } from "react";
import { Form, Link, useFetcher, useLoaderData } from "react-router";
import { entries, fiscalPeriods, fiscalYears } from "~/api/endpoints";
import type { Entry } from "~/api/types";
import { ENTRY_STATUS_OPTIONS } from "~/api/endpoints";
import { activeCompanyId, can } from "~/lib/session";
import { ENTRY_TYPES, shortDate } from "~/lib/format";
import {
  Button,
  EmptyState,
  EntryStatusBadge,
  Field,
  Input,
  PageHeader,
  Select,
  Spinner,
  cn,
  tableClass,
  tableWrap,
  tdClass,
  thClass,
} from "~/components/ui";

const TYPE_LABEL = Object.fromEntries(ENTRY_TYPES) as Record<string, string>;

export async function clientLoader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const companyId = activeCompanyId();
  const filters = {
    search: url.searchParams.get("search") ?? "",
    period_id: url.searchParams.get("period_id") ?? "",
    status: url.searchParams.get("status") ?? "",
    type: url.searchParams.get("type") ?? "",
    cursor: url.searchParams.get("cursor") ?? "",
    limit: 30,
  };

  const [result, years] = await Promise.all([entries(companyId, filters), fiscalYears(companyId)]);
  const year = years.length ? Math.max(...years.map((item) => item.year)) : new Date().getFullYear();
  const periods = years.length ? await fiscalPeriods(companyId, year) : [];

  return {
    items: result.items,
    next: result.meta?.page?.next_cursor ?? null,
    total: result.meta?.page?.total ?? null,
    periods,
    filters,
    query: url.search,
  };
}

export default function Asientos() {
  const { items, next, total, periods, filters, query } = useLoaderData<typeof clientLoader>();
  const [more, setMore] = useState<Entry[]>([]);
  const [cursor, setCursor] = useState<string | null>(next);
  const fetcher = useFetcher<typeof clientLoader>();

  useEffect(() => {
    setMore([]);
    setCursor(next);
  }, [query, next]);

  useEffect(() => {
    const data = fetcher.data;
    if (fetcher.state !== "idle" || !data) return;
    // La API puede devolver la última página con has_more=true: se corta con
    // una página vacía o sin cursor.
    if (data.items.length === 0) {
      setCursor(null);
      return;
    }
    setMore((current) => [...current, ...data.items]);
    setCursor(data.next);
  }, [fetcher.state, fetcher.data]);

  const rows = [...items, ...more];

  function loadMore() {
    if (!cursor) return;
    const params = new URLSearchParams(query);
    params.set("cursor", cursor);
    fetcher.load(`?${params.toString()}`);
  }

  return (
    <div>
      <PageHeader
        title="Asientos"
        subtitle="Partida doble: cada asiento debe cuadrar entre debe y haber."
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

      <Form method="get" className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="Buscar" htmlFor="search">
          <Input id="search" name="search" defaultValue={filters.search} placeholder="Descripción o referencia" />
        </Field>
        <Field label="Período" htmlFor="period_id">
          <Select id="period_id" name="period_id" defaultValue={filters.period_id}>
            <option value="">Todos</option>
            {periods.map((period) => (
              <option key={period.id} value={period.id}>
                {period.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Estado" htmlFor="status">
          <Select id="status" name="status" defaultValue={filters.status}>
            <option value="">Todos</option>
            {ENTRY_STATUS_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tipo" htmlFor="type">
          <Select id="type" name="type" defaultValue={filters.type}>
            <option value="">Todos</option>
            {ENTRY_TYPES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex items-end gap-2">
          <Button type="submit" variant="secondary">
            Filtrar
          </Button>
          <Link to="/asientos" className="px-2 py-2 text-sm text-slate-500 hover:text-slate-800">
            Limpiar
          </Link>
        </div>
      </Form>

      {rows.length === 0 ? (
        <EmptyState
          title="Sin asientos"
          hint="Registra el primero: dos o más líneas con el mismo total en debe y haber."
        >
          {can("entries:write") && (
            <Link to="/asientos/nuevo" className="text-sm font-medium text-emerald-700 hover:underline">
              Crear un asiento
            </Link>
          )}
        </EmptyState>
      ) : (
        <>
          <div className={tableWrap}>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>N°</th>
                  <th className={thClass}>Fecha</th>
                  <th className={thClass}>Tipo</th>
                  <th className={thClass}>Descripción</th>
                  <th className={thClass}>Referencia</th>
                  <th className={thClass}>Estado</th>
                  <th className={thClass} />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className={tdClass}>{row.number}</td>
                    <td className={cn(tdClass, "whitespace-nowrap")}>{shortDate(row.entry_date)}</td>
                    <td className={tdClass}>{TYPE_LABEL[row.entry_type] ?? row.entry_type}</td>
                    <td className={tdClass}>{row.description}</td>
                    <td className={tdClass}>{row.reference ?? "—"}</td>
                    <td className={tdClass}>
                      <EntryStatusBadge status={row.status} />
                    </td>
                    <td className={cn(tdClass, "text-right")}>
                      <Link to={`/asientos/${row.id}`} className="text-xs font-medium text-emerald-700 hover:underline">
                        Ver
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
            <p>
              {rows.length} asiento{rows.length === 1 ? "" : "s"}
              {total !== null ? ` de ${total}` : ""}
            </p>
            {cursor && (
              <Button variant="secondary" size="sm" onClick={loadMore} disabled={fetcher.state !== "idle"}>
                {fetcher.state !== "idle" ? (
                  <>
                    <Spinner /> Cargando…
                  </>
                ) : (
                  "Cargar más"
                )}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
