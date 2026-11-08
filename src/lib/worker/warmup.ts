import type { Settings, WhatsappNumber } from "@prisma/client";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Calcula o cap diário e status atuais de um número que está em aquecimento,
 * com base em quantos dias se passaram desde que começou a esquentar.
 * Retorna só os campos que mudaram (ou null se nada mudou).
 */
export function computeWarmupProgress(
  number: WhatsappNumber,
  settings: Settings,
  now: Date
): { dailyCap?: number; status?: "active" } | null {
  if (number.status !== "warming_up") return null;

  const daysElapsed = (now.getTime() - number.warmupStartedAt.getTime()) / MS_PER_DAY;
  const ramp = settings.warmupRampDays > 0 ? Math.min(daysElapsed / settings.warmupRampDays, 1) : 1;
  const targetCap = Math.round(
    settings.warmupDailyCapStart + (settings.warmupDailyCapMax - settings.warmupDailyCapStart) * ramp
  );

  const changes: { dailyCap?: number; status?: "active" } = {};
  if (targetCap !== number.dailyCap) changes.dailyCap = targetCap;
  if (daysElapsed >= settings.warmupRampDays) changes.status = "active";

  return Object.keys(changes).length > 0 ? changes : null;
}
