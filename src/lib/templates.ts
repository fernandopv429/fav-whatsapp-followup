/** Substitui placeholders {{chave}} pelo valor correspondente (vazio se não houver). */
export function renderTemplate(body: string, vars: Record<string, string | null | undefined>): string {
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: string) => vars[key] ?? "");
}

/**
 * Quebra um texto em várias mensagens separadas por linha em branco (duas
 * quebras de linha) — mesmo critério já usado nas respostas da IA, aplicado
 * aqui a qualquer corpo de template, pra simular alguém mandando várias
 * mensagens seguidas em vez de um bloco único de texto.
 */
export function splitMessageChunks(body: string): string[] {
  const chunks = body
    .split(/\n\s*\n/)
    .map((c) => c.trim())
    .filter(Boolean);
  return chunks.length > 0 ? chunks : [body.trim()];
}
