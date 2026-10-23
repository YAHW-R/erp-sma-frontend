import { Form, Link, useActionData, useLoaderData } from "react-router";
import { post } from "~/lib/api";
import { errorMessage } from "~/lib/api";
import { text, type ActionResult } from "~/lib/forms";
import { Alert, Card, Field, Input, SubmitButton } from "~/components/ui";

export async function clientLoader({ request }: { request: Request }) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  return { token };
}

export async function clientAction({ request }: { request: Request }): Promise<ActionResult> {
  const form = await request.formData();
  const token = text(form, "token");
  const password = text(form, "password");
  const confirmation = text(form, "confirmation");

  if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." };
  if (password !== confirmation) return { error: "Las contraseñas no coinciden." };

  try {
    await post("/auth/reset-password", { token, new_password: password }, { auth: false });
    return { ok: "Contraseña actualizada. Ya puedes iniciar sesión." };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}

export default function ResetPassword() {
  const { token } = useLoaderData<typeof clientLoader>();
  const result = useActionData<typeof clientAction>();

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-700">ERP-SMA</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Restablecer contraseña</h1>
        </div>

        <Card className="p-6">
          {result?.ok ? (
            <div className="space-y-4">
              <Alert tone="green">Contraseña actualizada. Ya puedes iniciar sesión.</Alert>
              <Link
                to="/login"
                className="inline-flex w-full justify-center rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
              >
                Ir a entrar
              </Link>
            </div>
          ) : (
            <Form method="post" className="space-y-4">
              {result?.error && <Alert>{result.error}</Alert>}

              <Field
                label="Token"
                htmlFor="token"
                hint={token ? undefined : "Pega el token de un solo uso que entregó el administrador."}
              >
                <Input id="token" name="token" defaultValue={token} required />
              </Field>

              <Field label="Nueva contraseña" htmlFor="password">
                <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
              </Field>

              <Field label="Repite la contraseña" htmlFor="confirmation">
                <Input id="confirmation" name="confirmation" type="password" autoComplete="new-password" minLength={8} required />
              </Field>

              <SubmitButton className="w-full" pendingLabel="Guardando…">
                Guardar contraseña
              </SubmitButton>
            </Form>
          )}
        </Card>

        <p className="mt-4 text-center text-xs text-slate-500">
          <Link to="/login" className="font-medium text-emerald-700 hover:underline">
            Volver a entrar
          </Link>
        </p>
      </div>
    </main>
  );
}
