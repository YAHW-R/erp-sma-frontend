import type { Config } from "@react-router/dev/config";

export default {
  // SPA: la app se sirve estática y habla con la API por /api/v1 (proxy).
  ssr: false,
} satisfies Config;
