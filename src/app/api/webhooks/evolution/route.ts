import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizePhoneBR } from "@/lib/phone";

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

  if (!contact.firstReplyAt) {
    await prisma.contact.update({ where: { id: contact.id }, data: { firstReplyAt: now } });
  }

  if (!contact.currentStepId) return NextResponse.json({ ok: true }); // fluxo já encerrado, só loga

  const step = await prisma.flowStep.findUnique({ where: { id: contact.currentStepId } });
  if (!step || step.type !== "delay_branch") return NextResponse.json({ ok: true }); // não está esperando resposta agora

  const sendTemplate = step.onReplySendTemplateKey
    ? await prisma.messageTemplate.findUnique({ where: { key: step.onReplySendTemplateKey } })
    : null;

  // Condição no where evita processar duas vezes a mesma transição se duas
  // mensagens do mesmo contato chegarem quase juntas (updateMany só afeta
  // quem ainda estiver nesse passo exato).
  const { count } = await prisma.contact.updateMany({
    where: { id: contact.id, currentStepId: step.id },
    data: step.onReplyGotoStepId
      ? { currentStepId: step.onReplyGotoStepId, stepEnteredAt: now }
      : {},
  });

  if (count > 0 && sendTemplate?.bodyText.trim()) {
    await prisma.messageLog.create({
      data: {
        contactId: contact.id,
        numberId: contact.assignedNumberId,
        direction: "out",
        templateKey: step.onReplySendTemplateKey,
        body: sendTemplate.bodyText,
        status: "queued",
      },
    });
  }

  return NextResponse.json({ ok: true });
}
