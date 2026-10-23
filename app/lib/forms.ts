/** Lectura de FormData con los valores que el backend espera. */

export function text(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

export function optionalText(form: FormData, key: string): string | undefined {
  const value = text(form, key);
  return value === "" ? undefined : value;
}

export function number(form: FormData, key: string): number {
  return Number(text(form, key));
}

export function intent(form: FormData): string {
  return text(form, "intent");
}

export function file(form: FormData, key: string): File | null {
  const value = form.get(key);
  return value instanceof File && value.size > 0 ? value : null;
}

/** Resultado estándar de un clientAction: aviso de éxito o mensaje de error. */
export type ActionResult = { ok?: string; error?: string };
