/**
 * Normaliza um telefone brasileiro pro formato que a Evolution API espera
 * (DDI+DDD+número, só dígitos). Assume Brasil (55) quando o DDI não vier.
 */
export function normalizePhoneBR(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  if (digits.length >= 12 && digits.length <= 13) {
    return digits; // outro DDI, assume que já veio completo
  }
  return null;
}
