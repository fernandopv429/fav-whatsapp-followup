import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { sendText } from "@/lib/evolution";
import { computeWarmupProgress } from "@/lib/worker/warmup";
import type { WhatsappNumber } from "@prisma/client";

function randomInt(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

/** Aplica reset diário de contador e progresso de aquecimento; devolve o número atualizado. */
async function refreshNumber(
  number: WhatsappNumber,
  settings: Awaited<ReturnType<typeof getSettings>>,
  now: Date
): Promise<WhatsappNumber> {
  const data: Partial<WhatsappNumber> = {};

  if (!number.capResetAt || !isSameDay(number.capResetAt, now)) {
    data.sentToday = 0;
    data.capResetAt = now;
  }

  const warmup = computeWarmupProgress(number, settings, now);
  if (warmup) Object.assign(data, warmup);

  if (Object.keys(data).length === 0) return number;
  return prisma.whatsappNumber.update({ where: { id: number.id }, data });
}

export interface TickResult {
  sent: number;
  skippedForaDaJanela?: boolean;
  erros: number;
}

/**
 * Um ciclo do worker: pra cada número elegível, tenta despachar a próxima
 * mensagem `queued` da fila. Chamado a cada 1 min pelo cron em server.js.
 * Não roda em paralelo com si mesmo (ver guard em server.js).
 */
export async function tick(): Promise<TickResult> {
  const settings = await getSettings();
  const now = new Date();
  const hour = now.getHours();

  if (hour < settings.sendWindowStart || hour >= settings.sendWindowEnd) {
    return { sent: 0, skippedForaDaJanela: true, erros: 0 };
  }

  const numbers = await prisma.whatsappNumber.findMany({
    where: { status: { in: ["warming_up", "active"] } },
  });

  let sent = 0;
  let erros = 0;

  for (const raw of numbers) {
    const number = await refreshNumber(raw, settings, now);

    if (number.sentToday >= number.dailyCap) continue;
    if (number.nextEligibleAt && now < number.nextEligibleAt) continue;
    if (
      number.lastSentAt &&
      now.getTime() - number.lastSentAt.getTime() < settings.minDelaySeconds * 1000
    ) {
      continue;
    }

    const nextMessage = await prisma.messageLog.findFirst({
      where: { status: "queued", direction: "out" },
      orderBy: { createdAt: "asc" },
      include: { contact: true },
    });
    if (!nextMessage) continue;

    try {
      const result = await sendText(
        number.evolutionInstanceName,
        nextMessage.contact.phone,
        nextMessage.body,
        number.evolutionInstanceToken ?? undefined
      );

      const jitterSeconds = randomInt(settings.minDelaySeconds, settings.maxDelaySeconds);

      await prisma.$transaction([
        prisma.messageLog.update({
          where: { id: nextMessage.id },
          data: {
            status: "sent",
            sentAt: now,
            numberId: number.id,
            evolutionMessageId: result?.key?.id ?? null,
          },
        }),
        prisma.whatsappNumber.update({
          where: { id: number.id },
          data: {
            sentToday: { increment: 1 },
            lastSentAt: now,
            nextEligibleAt: new Date(now.getTime() + jitterSeconds * 1000),
          },
        }),
        prisma.contact.update({
          where: { id: nextMessage.contactId },
          data: {
            stage: "aguardando_resposta",
            initialSentAt: now,
            assignedNumberId: number.id,
          },
        }),
      ]);

      sent++;
    } catch (err) {
      erros++;
      console.error(`Falha ao enviar mensagem ${nextMessage.id} via ${number.evolutionInstanceName}:`, err);
      await prisma.messageLog.update({ where: { id: nextMessage.id }, data: { status: "failed" } });
    }
  }

  return { sent, erros };
}
