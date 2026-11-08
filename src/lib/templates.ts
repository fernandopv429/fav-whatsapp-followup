/** Substitui placeholders {{chave}} pelo valor correspondente (vazio se não houver). */
export function renderTemplate(body: string, vars: Record<string, string | null | undefined>): string {
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: string) => vars[key] ?? "");
}
