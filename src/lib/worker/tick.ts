import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { sendText, sendMedia } from "@/lib/evolution";
import { generatePersonalizedOffer } from "@/lib/ai";
import { renderTemplate } from "@/lib/templates";
import { computeWarmupProgress } from "@/lib/worker/warmup";
import type { Contact, Flow, FlowStep, Settings, WhatsappNumber } from "@prisma/client";

type ContactWithFlow = Contact & { currentFlow: Flow | null };

const MAX_HOPS_PER_CONTACT = 10;

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

async function loadAllSteps(): Promise<Map<string, FlowStep>> {
  const steps = await prisma.flowStep.findMany();
  return new Map(steps.map((s) => [s.id, s]));
}

let activeNumbersCache: WhatsappNumber[] | null = null;
async function getActiveNumbersOrdered(): Promise<WhatsappNumber[]> {
  if (activeNumbersCache) return activeNumbersCache;
  activeNumbersCache = await prisma.whatsappNumber.findMany({
    where: { status: { in: ["warming_up", "active"] } },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });
  return activeNumbersCache;
}

/**
 * Janela de envio efetiva pro passo atual: o passo pode sobrepor a janela do
 * fluxo (ex: a oferta final de um fluxo noturno rodar de manhã), o fluxo cai
 * pro padrão global de Settings quando não define a sua própria.
 */
function isWithinSendWindow(
  step: FlowStep,
  contact: ContactWithFlow,
  settings: Settings,
  now: Date
): boolean {
  const start = step.sendWindowStart ?? contact.currentFlow?.sendWindowStart ?? settings.sendWindowStart;
  const end = step.sendWindowEnd ?? contact.currentFlow?.sendWindowEnd ?? settings.sendWindowEnd;
  const hour = now.getHours();
  return hour >= start && hour < end;
}

async function resolveNumberId(step: FlowStep, contact: Contact): Promise<string | null> {
  if (step.numberStrategy === "specific") return step.numberId ?? null;
  if (step.numberStrategy === "rotate") {
    const active = await getActiveNumbersOrdered();
    if (active.length === 0) return null;
    return active[contact.rotateIndex % active.length].id;
  }
  return contact.assignedNumberId ?? null; // "same" (default)
}

/**
 * Marca "sem resposta" quem está parado num passo `delay_branch` há mais
 * tempo que o limiar configurado nesse passo, sem ninguém ter respondido
 * (o webhook já trata a resposta em si, fora daqui).
 */
async function advanceDelayBranchTimeouts(stepsById: Map<string, FlowStep>, now: Date): Promise<number> {
  const waiting = await prisma.contact.findMany({
    where: { currentStepId: { not: null }, stepEnteredAt: { not: null } },
  });

  let count = 0;
  for (const contact of waiting) {
    const step = stepsById.get(contact.currentStepId!);
    if (!step || step.type !== "delay_branch") continue;

    const thresholdMs = (step.thresholdMinutes ?? 0) * 60000;
    if (now.getTime() - contact.stepEnteredAt!.getTime() < thresholdMs) continue;
    if (!step.onTimeoutGotoStepId) continue; // passo mal configurado: não trava, só não avança

    await prisma.contact.update({
      where: { id: contact.id },
      data: { currentStepId: step.onTimeoutGotoStepId, stepEnteredAt: now },
    });
    count++;
  }
  return count;
}

/**
 * Processa contatos parados num passo `send` ou `ai_offer`: enfileira a
 * mensagem e avança pro próximo passo. Encadeia até MAX_HOPS_PER_CONTACT
 * passos seguidos no mesmo tick (só pra pelo caso de dois `send` seguidos
 * sem `delay_branch` entre eles) — pára sozinho ao chegar num `delay_branch`
 * ou `end`.
 */
async function advanceSendableSteps(
  stepsById: Map<string, FlowStep>,
  settings: Settings,
  now: Date
): Promise<number> {
  const pending = await prisma.contact.findMany({
    where: { currentStepId: { not: null } },
    include: { currentFlow: true },
  });

  let novosContatosHoje = await prisma.contact.count({
    where: { flowStartedAt: { gte: startOfDay(now) } },
  });

  let advanced = 0;

  for (let contact of pending) {
    for (let hop = 0; hop < MAX_HOPS_PER_CONTACT; hop++) {
      if (!contact.currentStepId) break;
      const step = stepsById.get(contact.currentStepId);
      if (!step) break;

      if (step.type === "delay_branch") break; // espera resposta/timeout
      if (step.type === "ai_reply") break; // passivo: só reage a mensagens recebidas, via webhook

      if (step.type === "end") {
        const updated = await prisma.contact.update({
          where: { id: contact.id },
          data: { stageLabel: step.endLabel ?? null, currentStepId: null, currentFlowId: null },
        });
        contact = { ...updated, currentFlow: null };
        advanced++;
        break;
      }

      if (step.type === "send") {
        const isEntryStep = step.position === 0 && !contact.flowStartedAt;
        if (isEntryStep && novosContatosHoje >= settings.newContactsDailyCap) break; // cap do dia batido
        if (!isWithinSendWindow(step, contact, settings, now)) break; // fora da janela de envio do fluxo

        const template = step.templateKey
          ? await prisma.messageTemplate.findUnique({ where: { key: step.templateKey } })
          : null;
        if (template?.bodyText.trim()) {
          const numberId = await resolveNumberId(step, contact);
          await prisma.messageLog.create({
            data: {
              contactId: contact.id,
              numberId: numberId ?? undefined,
              direction: "out",
              templateKey: step.templateKey,
              body: renderTemplate(template.bodyText, { nome: contact.name }),
              mediaUrl: step.mediaUrl ?? undefined,
              mediaType: step.mediaType ?? undefined,
              status: "queued",
            },
          });
        }

        const updatedSend = await prisma.contact.update({
          where: { id: contact.id },
          data: {
            currentStepId: step.nextStepId ?? null,
            stepEnteredAt: now,
            stageLabel: step.templateKey ?? "send",
            ...(step.numberStrategy === "rotate" && { rotateIndex: { increment: 1 } }),
            ...(isEntryStep && { flowStartedAt: now }),
          },
        });
        contact = { ...updatedSend, currentFlow: contact.currentFlow };
        if (isEntryStep) novosContatosHoje++;
        advanced++;
        continue;
      }

      if (step.type === "ai_offer") {
        if (!isWithinSendWindow(step, contact, settings, now)) break; // fora da janela de envio do fluxo

        const promptTemplate = step.templateKey
          ? await prisma.messageTemplate.findUnique({ where: { key: step.templateKey } })
          : null;
        if (!promptTemplate?.bodyText.trim()) {
          const updatedSkip = await prisma.contact.update({
            where: { id: contact.id },
            data: { currentStepId: step.nextStepId ?? null, stepEnteredAt: now },
          });
          contact = { ...updatedSkip, currentFlow: contact.currentFlow };
          advanced++;
          continue;
        }

        try {
          const body = await generatePersonalizedOffer({
            promptInstructions: promptTemplate.bodyText,
            contactName: contact.name,
            niche: contact.niche,
            companyData: (contact.companyData as Record<string, unknown> | null) ?? null,
          });
          const numberId = await resolveNumberId(step, contact);

          const updatedOffer = await prisma.contact.update({
            where: { id: contact.id },
            data: {
              currentStepId: step.nextStepId ?? null,
              stepEnteredAt: now,
              stageLabel: "oferta_enviada",
              ...(step.numberStrategy === "rotate" && { rotateIndex: { increment: 1 } }),
            },
          });
          contact = { ...updatedOffer, currentFlow: contact.currentFlow };
          await prisma.messageLog.create({
            data: {
              contactId: contact.id,
              numberId: numberId ?? undefined,
              direction: "out",
              templateKey: step.templateKey,
              body,
              mediaUrl: step.mediaUrl ?? undefined,
              mediaType: step.mediaType ?? undefined,
              status: "queued",
            },
          });
          advanced++;
          continue;
        } catch (err) {
          console.error(`Falha ao gerar oferta (passo ${step.id}) pro contato ${contact.id}:`, err);
          break; // tenta de novo no próximo tick
        }
      }

      break; // tipo desconhecido: não trava o worker
    }
  }

  return advanced;
}

export interface TickResult {
  sent: number;
  timeouts: number;
  stepsAdvanced: number;
  erros: number;
}

/**
 * Um ciclo do worker, chamado a cada 1 min pelo cron em scripts/worker.mjs.
 * Não roda em paralelo com si mesmo (guard em scripts/worker.mjs).
 */
export async function tick(): Promise<TickResult> {
  const settings = await getSettings();
  const now = new Date();
  activeNumbersCache = null; // um fetch por tick, não por contato

  const stepsById = await loadAllSteps();
  const timeouts = await advanceDelayBranchTimeouts(stepsById, now);
  const stepsAdvanced = await advanceSendableSteps(stepsById, settings, now);

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
      where: {
        status: "queued",
        direction: "out",
        OR: [{ numberId: null }, { numberId: number.id }],
      },
      orderBy: { createdAt: "asc" },
      include: { contact: true },
    });
    if (!nextMessage) continue;

    try {
      const result = nextMessage.mediaUrl
        ? await sendMedia(
            number.evolutionInstanceName,
            nextMessage.contact.phone,
            nextMessage.mediaUrl,
            (nextMessage.mediaType as "image" | "video" | "document") ?? "image",
            nextMessage.body,
            number.evolutionInstanceToken ?? undefined
          )
        : await sendText(
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
          data: { assignedNumberId: number.id },
        }),
      ]);

      sent++;
    } catch (err) {
      erros++;
      console.error(`Falha ao enviar mensagem ${nextMessage.id} via ${number.evolutionInstanceName}:`, err);
      await prisma.messageLog.update({ where: { id: nextMessage.id }, data: { status: "failed" } });
    }
  }

  return { sent, timeouts, stepsAdvanced, erros };
}
