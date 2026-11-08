import { prisma } from "@/lib/prisma";
import type { Settings } from "@prisma/client";

/** Garante que a linha única de Settings existe e devolve ela. */
export async function getSettings(): Promise<Settings> {
  const existing = await prisma.settings.findUnique({ where: { id: 1 } });
  if (existing) return existing;
  return prisma.settings.create({ data: { id: 1 } });
}

export async function updateSettings(
  data: Partial<Omit<Settings, "id" | "updatedAt">>
): Promise<Settings> {
  await getSettings();
  return prisma.settings.update({ where: { id: 1 }, data });
}
