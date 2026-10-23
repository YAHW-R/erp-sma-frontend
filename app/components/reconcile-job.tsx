import { useEffect } from "react";
import { useRevalidator } from "react-router";
import { useJob } from "~/lib/use-job";
import { Alert, Badge, Card, Spinner } from "~/components/ui";

/** Progreso de una conciliación en segundo plano; al terminar refresca la página. */
export function ReconcileJob({ companyId, jobId }: { companyId: string; jobId: string }) {
  const job = useJob(companyId, jobId);
  const revalidator = useRevalidator();
  const completed = job?.status === "COMPLETED";

  useEffect(() => {
    if (completed) revalidator.revalidate();
    // El trabajo termina una sola vez; revalidar refresca los contadores.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completed]);

  const tone = completed ? "green" : job?.status === "FAILED" ? "red" : "amber";
  const label = completed
    ? "Terminada"
    : job?.status === "FAILED"
      ? "Falló"
      : job
        ? "Procesando…"
        : "En cola";

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-slate-800">Conciliación automática</h2>
        <Badge tone={tone}>{label}</Badge>
      </div>

      {!job && (
        <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Encolando…
        </p>
      )}

      {job && !completed && job.status !== "FAILED" && (
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full bg-emerald-600 transition-all"
            style={{ width: `${Math.min(100, Math.max(4, job.progress))}%` }}
          />
        </div>
      )}

      {job?.status === "FAILED" && (
        <div className="mt-2">
          <Alert>{job.error ?? "La conciliación falló."}</Alert>
        </div>
      )}

      {completed && <p className="mt-2 text-xs text-slate-500">Los contadores del extracto ya están actualizados.</p>}
    </Card>
  );
}
