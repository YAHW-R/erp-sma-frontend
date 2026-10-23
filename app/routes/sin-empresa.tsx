import { useNavigate } from "react-router";
import { logout } from "~/lib/auth";
import { Button, Card } from "~/components/ui";

export default function NoCompany() {
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <Card className="w-full max-w-md p-6 text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-emerald-700">ERP-SMA</p>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">Sin empresas asignadas</h1>
        <p className="mt-2 text-sm text-slate-600">
          Tu usuario no tiene acceso a ninguna empresa todavía. Pide al administrador del despacho que te asigne
          una.
        </p>
        <Button className="mt-5" onClick={handleLogout}>
          Volver a entrar
        </Button>
      </Card>
    </main>
  );
}
