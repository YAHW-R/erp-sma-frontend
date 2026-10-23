import { Form, Link, redirect, useActionData } from "react-router";
import { login } from "~/lib/auth";
import { getSession } from "~/lib/session";
import { errorMessage } from "~/lib/api";
import { text } from "~/lib/forms";
import { Alert, Card, Field, Input, SubmitButton } from "~/components/ui";

export async function clientLoader() {
  const session = getSession();
  if (session) throw redirect(session.company_id ? "/" : "/sin-empresa");
  return null;
}

export async function clientAction({ request }: { request: Request }) {
  const form = await request.formData();
  let companyId: string | null = null;

  try {
    const session = await login(text(form, "email"), text(form, "password"));
    companyId = session.company_id;
  } catch (error) {
    return { error: errorMessage(error) };
  }

  throw redirect(companyId ? "/" : "/sin-empresa");
}

export default function Login() {
  const result = useActionData<typeof clientAction>();

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-700">ERP-SMA</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Contabilidad multiempresa</h1>
          <p className="mt-1 text-sm text-slate-500">Ingresa con el usuario que te asignó el despacho.</p>
        </div>

        <Card className="p-6">
          <Form method="post" className="space-y-4">
            {result?.error && <Alert>{result.error}</Alert>}

            <Field label="Correo" htmlFor="email">
              <Input id="email" name="email" type="email" autoComplete="username" required autoFocus />
            </Field>

            <Field label="Contraseña" htmlFor="password">
              <Input id="password" name="password" type="password" autoComplete="current-password" required />
            </Field>

            <SubmitButton className="w-full" pendingLabel="Entrando…">
              Entrar
            </SubmitButton>
          </Form>

          <p className="mt-4 text-center text-xs text-slate-500">
            ¿Olvidaste tu contraseña?{" "}
            <Link to="/reset-password" className="font-medium text-emerald-700 hover:underline">
              Usa el enlace del administrador
            </Link>
          </p>
        </Card>

        <p className="mt-4 text-center text-xs text-slate-500">
          El administrador del despacho crea los usuarios y asigna cada empresa.
        </p>
      </div>
    </main>
  );
}
