import { useEffect, useState } from "react";
import type { Job } from "~/api/types";
import { job as fetchJob } from "~/api/endpoints";

const ACTIVE: Job["status"][] = ["PENDING", "RUNNING", "RETRYING"];

/** Sondea el trabajo mientras esté en curso. Sin WebSocket: menos piezas. */
export function useJob(companyId: string | null, jobId: string | null | undefined) {
  const [state, setState] = useState<Job | null>(null);

  useEffect(() => {
    setState(null);
    if (!companyId || !jobId) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      try {
        const data = await fetchJob(companyId, jobId);
        if (cancelled) return;
        setState(data);
        if (ACTIVE.includes(data.status)) timer = setTimeout(tick, 1500);
      } catch {
        if (!cancelled) timer = setTimeout(tick, 3000);
      }
    };

    tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [companyId, jobId]);

  return state;
}
