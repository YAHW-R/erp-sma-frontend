import { redirect, useLoaderData } from "react-router";
import { Shell } from "~/components/shell";
import { bootstrap } from "~/lib/auth";

export async function clientLoader() {
  const session = await bootstrap();
  if (!session) throw redirect("/login");
  if (!session.company_id) throw redirect("/sin-empresa");
  return { session };
}

export default function AppLayout() {
  const { session } = useLoaderData<typeof clientLoader>();
  return <Shell session={session} />;
}
