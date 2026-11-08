import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizePhoneBR } from "@/lib/phone";
import { getSettings } from "@/lib/settings";

interface EvolutionWebhookBody {
  event?: string;
  instance?: string;
  data?: {
    key?: { remoteJid?: string; fromMe?: boolean; id?: string };
    message?: {
      conversation?: string;
      extendedTextMessage?: { text?: string };
    };
  };
}

function extractText(data: EvolutionWebhookBody["data"]): string {
  return (
    data?.message?.conversation ?? data?.message?.extendedTextMessage?.text ?? "[mensagem sem texto]"
  );
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as EvolutionWebhookBody | null;
  if (!body) return NextResponse.json({ ok: true });

  const event = (body.event ?? "").toUpperCase().replace(/\./g, "_");
  if (event !== "MESSAGES_UPSERT") {
    return NextResponse.json({ ok: true });
  }

  const remoteJid = body.data?.key?.remoteJid ?? "";
  const fromMe = body.data?.key?.fromMe ?? true;
  if (fromMe || remoteJid.endsWith("@g.us") || !remoteJid.includes("@")) {
    return NextResponse.json({ ok: true });
  }

  const phone = normalizePhoneBR(remoteJid.split("@")[0]);
  if (!phone) return NextResponse.json({ ok: true });

  const contact = await prisma.contact.findUnique({ where: { phone } });
  if (!contact) return NextResponse.json({ ok: true });

  const text = extractText(body.data);
  const now = new Date();

  await prisma.messageLog.create({
    data: { contactId: contact.id, direction: "in", body: text, status: "delivered" },
  });

  const settings = await getSettings();

  if (contact.stage === "aguardando_msg1" && contact.initialSentAt) {
    const elapsedMin = (now.getTime() - contact.initialSentAt.getTime()) / 60000;

    if (elapsedMin <= settings.msg1ThresholdMinutes) {
      const verificacao = await prisma.messageTemplate.findUnique({ where: { key: "verificacao" } });
      await prisma.$transaction([
        prisma.contact.update({
          where: { id: contact.id },
          data: { stage: "aguardando_msg2", firstReplyAt: contact.firstReplyAt ?? now },
        }),
        ...(verificacao?.bodyText.trim()
          ? [
              prisma.messageLog.create({
                data: {
                  contactId: contact.id,
                  direction: "out",
                  templateKey: "verificacao",
                  body: verificacao.bodyText,
                  status: "queued",
                },
              }),
            ]
          : []),
      ]);
    } else {
      await enterDrip(contact.id);
    }
    return NextResponse.json({ ok: true });
  }

  if (contact.stage === "aguardando_msg2" && contact.msg2SentAt) {
    const elapsedMin = (now.getTime() - contact.msg2SentAt.getTime()) / 60000;

    if (elapsedMin <= settings.msg2ThresholdMinutes) {
      await prisma.contact.update({ where: { id: contact.id }, data: { stage: "tem_ia" } });
    } else {
      await enterDrip(contact.id);
    }
    return NextResponse.json({ ok: true });
  }

  if (contact.stage === "em_drip") {
    const dripState = await prisma.dripState.findUnique({ where: { contactId: contact.id } });
    const dayKey = `drip_dia_${dripState?.currentDay ?? 0}_resposta`;
    const specific = await prisma.messageTemplate.findUnique({ where: { key: dayKey } });
    const fallback = specific ?? (await prisma.messageTemplate.findUnique({ where: { key: "drip_resposta_ocupado" } }));

    if (fallback?.bodyText.trim()) {
      await prisma.messageLog.create({
        data: {
          contactId: contact.id,
          direction: "out",
          templateKey: specific ? dayKey : "drip_resposta_ocupado",
          body: fallback.bodyText,
          status: "queued",
        },
      });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}

/** Marca o contato como "não tem IA" e inicia a sequência de cliente perdido. */
async function enterDrip(contactId: string) {
  const now = new Date();
  await prisma.$transaction([
    prisma.contact.update({ where: { id: contactId }, data: { stage: "em_drip" } }),
    prisma.dripState.upsert({
      where: { contactId },
      create: { contactId, currentDay: 0, status: "ativo", nextDueAt: now },
      update: { status: "ativo", nextDueAt: now },
    }),
  ]);
}
