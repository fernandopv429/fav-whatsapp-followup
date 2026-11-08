import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { sendText } from "@/lib/evolution";
import { generatePersonalizedOffer } from "@/lib/ai";
import { computeWarmupProgress } from "@/lib/worker/warmup";
import type { Contact, Settings, WhatsappNumber } from "@prisma/client";

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

function startOfDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Aplica reset diário de contador e progresso de aquecimento; devolve o número atualizado. */
async function refreshNumber(number: WhatsappNumber, settings: Settings, now: Date): Promise<WhatsappNumber> {
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

/** Campos do Contact a atualizar depois de um envio bem-sucedido, conforme o template. */
function postSendContactData(templateKey: string | null, now: Date) {
  if (templateKey === "inicial") {
    return { stage: "aguardando_msg1" as const, initialSentAt: now };
  }
  if (templateKey === "verificacao") {
    return { stage: "aguardando_msg2" as const, msg2SentAt: now };
  }
  // drip_dia_N, drip_resposta_ocupado, oferta: quem enfileirou já ajustou o stage.
  return {};
}

/** Marca "não tem IA" quem nunca respondeu dentro do limiar de msg1/msg2. */
async function advanceTimeouts(settings: Settings, now: Date): Promise<number> {
  const msg1Deadline = new Date(now.getTime() - settings.msg1ThresholdMinutes * 60000);
  const msg2Deadline = new Date(now.getTime() - settings.msg2ThresholdMinutes * 60000);

  const expired = await prisma.contact.findMany({
    where: {
      OR: [
        { stage: "aguardando_msg1", initialSentAt: { lte: msg1Deadline } },
        { stage: "aguardando_msg2", msg2SentAt: { lte: msg2Deadline } },
      ],
    },
  });

  for (const contact of expired) {
    await prisma.$transaction([
      prisma.contact.update({ where: { id: contact.id }, data: { stage: "em_drip" } }),
      prisma.dripState.upsert({
        where: { contactId: contact.id },
        create: { contactId: contact.id, currentDay: 0, status: "ativo", nextDueAt: now },
        update: { status: "ativo", nextDueAt: now },
      }),
    ]);
  }

  return expired.length;
}

/**
 * Envia a próxima mensagem do drip, ou dispara a oferta final quando a sequência
 * termina. Cada "dia" da simulação usa um número diferente (reforça a ilusão de
 * vários leads distintos) — a quantidade de dias é dinâmica: igual à quantidade
 * de números ativos no momento, na ordem que o usuário definiu em Números.
 */
async function advanceDrip(now: Date): Promise<number> {
  const activeNumbers = await prisma.whatsappNumber.findMany({
    where: { status: { in: ["warming_up", "active"] } },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });
  const totalDays = activeNumbers.length;

  const due = await prisma.dripState.findMany({
    where: { status: "ativo", nextDueAt: { lte: now } },
    include: { contact: true },
  });

  let advanced = 0;

  for (const drip of due) {
    if (totalDays === 0) continue; // nenhum número conectado ainda: tenta de novo no próximo tick

    if (drip.currentDay >= totalDays) {
      await finalizarComOferta(drip.contact);
      advanced++;
      continue;
    }

    const nextDay = drip.currentDay + 1;
    const numberForDay = activeNumbers[drip.currentDay]; // dia 1 = índice 0
    const template = await prisma.messageTemplate.findUnique({ where: { key: `drip_dia_${nextDay}` } });
    if (!template?.bodyText.trim()) {
      // sem template pra esse dia: pula o envio mas avança o dia mesmo assim,
      // pra não travar a sequência indefinidamente.
      await prisma.dripState.update({
        where: { id: drip.id },
        data: { currentDay: nextDay, lastSentAt: now, nextDueAt: new Date(now.getTime() + 86400000) },
      });
      advanced++;
      continue;
    }

    await prisma.$transaction([
      prisma.messageLog.create({
        data: {
          contactId: drip.contactId,
          numberId: numberForDay.id,
          direction: "out",
          templateKey: `drip_dia_${nextDay}`,
          body: template.bodyText,
          status: "queued",
        },
      }),
      prisma.dripState.update({
        where: { id: drip.id },
        data: { currentDay: nextDay, lastSentAt: now, nextDueAt: new Date(now.getTime() + 86400000) },
      }),
    ]);
    advanced++;
  }

  return advanced;
}

async function finalizarComOferta(contact: Contact) {
  const promptTemplate = await prisma.messageTemplate.findUnique({ where: { key: "oferta" } });
  if (!promptTemplate?.bodyText.trim()) {
    // sem prompt de oferta configurado: só fecha a sequência, sem travar o contato.
    await prisma.dripState.update({ where: { contactId: contact.id }, data: { status: "concluido" } });
    return;
  }

  try {
    const body = await generatePersonalizedOffer({
      promptInstructions: promptTemplate.bodyText,
      contactName: contact.name,
      niche: contact.niche,
      companyData: (contact.companyData as Record<string, unknown> | null) ?? null,
    });

    await prisma.$transaction([
      prisma.messageLog.create({
        data: { contactId: contact.id, direction: "out", templateKey: "oferta", body, status: "queued" },
      }),
      prisma.dripState.update({ where: { contactId: contact.id }, data: { status: "concluido" } }),
      prisma.contact.update({ where: { id: contact.id }, data: { stage: "oferta_enviada" } }),
    ]);
  } catch (err) {
    console.error(`Falha ao gerar oferta automática pro contato ${contact.id}:`, err);
    // não marca concluido: tenta de novo no próximo tick (nextDueAt já passou).
  }
}

export interface TickResult {
  sent: number;
  timeouts: number;
  dripAdvances: number;
  skippedForaDaJanela?: boolean;
  erros: number;
}

/**
 * Um ciclo do worker, chamado a cada 1 min pelo cron em scripts/worker.mjs.
 * Não roda em paralelo com si mesmo (guard em scripts/worker.mjs).
 */
export async function tick(): Promise<TickResult> {
  const settings = await getSettings();
  const now = new Date();

  const timeouts = await advanceTimeouts(settings, now);
  const dripAdvances = await advanceDrip(now);

  const hour = now.getHours();
  if (hour < settings.sendWindowStart || hour >= settings.sendWindowEnd) {
    return { sent: 0, timeouts, dripAdvances, skippedForaDaJanela: true, erros: 0 };
  }

  const numbers = await prisma.whatsappNumber.findMany({
    where: { status: { in: ["warming_up", "active"] } },
  });

  let sent = 0;
  let erros = 0;

  let inicialEnviadosHoje = await prisma.messageLog.count({
    where: { templateKey: "inicial", status: "sent", sentAt: { gte: startOfDay(now) } },
  });

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

    // Olha um pouco além do primeiro da fila: se os próximos forem 'inicial' e o
    // limite diário de contatos novos já bateu, pula pra verificação/drip/oferta
    // (essas não contam no limite — são follow-up de gente que já respondeu).
    const candidates = await prisma.messageLog.findMany({
      where: {
        status: "queued",
        direction: "out",
        OR: [{ numberId: null }, { numberId: number.id }],
      },
      orderBy: { createdAt: "asc" },
      take: 20,
      include: { contact: true },
    });
    const inicialCapAtingido = inicialEnviadosHoje >= settings.newContactsDailyCap;
    const nextMessage = candidates.find((m) => m.templateKey !== "inicial" || !inicialCapAtingido);
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
          data: { assignedNumberId: number.id, ...postSendContactData(nextMessage.templateKey, now) },
        }),
      ]);

      sent++;
      if (nextMessage.templateKey === "inicial") inicialEnviadosHoje++;
    } catch (err) {
      erros++;
      console.error(`Falha ao enviar mensagem ${nextMessage.id} via ${number.evolutionInstanceName}:`, err);
      await prisma.messageLog.update({ where: { id: nextMessage.id }, data: { status: "failed" } });
    }
  }

  return { sent, timeouts, dripAdvances, erros };
}
