import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generatePersonalizedOffer } from "@/lib/ai";
import { resolveNumberId } from "@/lib/worker/tick";

/**
 * Atalho manual: força o envio imediato da oferta por IA do passo `ai_offer`
 * em que o contato está agora, sem esperar a janela de envio nem o cap do
 * motor — útil pra "puxar" um lead específico na mão. Só funciona quando o
 * contato está parado exatamente num passo `ai_offer`.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const contact = await prisma.contact.findUnique({ where: { id }, include: { currentStep: true } });
  if (!contact) {
    return NextResponse.json({ error: "Contato não encontrado." }, { status: 404 });
  }

  const step = contact.currentStep;
  if (!step || step.type !== "ai_offer") {
    return NextResponse.json(
      { error: "Esse contato não está parado num passo de oferta por IA agora." },
      { status: 400 }
    );
  }

  const promptTemplate = step.templateKey
    ? await prisma.messageTemplate.findUnique({ where: { key: step.templateKey } })
    : null;
  if (!promptTemplate || !promptTemplate.bodyText.trim()) {
    return NextResponse.json(
      { error: `Template "${step.templateKey ?? "?"}" desse passo está vazio.` },
      { status: 400 }
    );
  }

  let body: string;
  try {
    body = await generatePersonalizedOffer({
      promptInstructions: promptTemplate.bodyText,
      contactName: contact.name,
      niche: contact.niche,
      companyData: (contact.companyData as Record<string, unknown> | null) ?? null,
    });
  } catch (err) {
    console.error("Falha ao gerar oferta personalizada via IA", err);
    return NextResponse.json({ error: "Falha ao gerar a mensagem com a IA. Tente de novo." }, { status: 502 });
  }

  const numberId = await resolveNumberId(step, contact);

  const [, updatedContact] = await prisma.$transaction([
    prisma.messageLog.create({
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
    }),
    prisma.contact.update({
      where: { id: contact.id },
      data: {
        currentStepId: step.nextStepId ?? null,
        stepEnteredAt: new Date(),
        stageLabel: "oferta_enviada",
        ...(step.numberStrategy === "rotate" && { rotateIndex: { increment: 1 } }),
      },
    }),
  ]);

  return NextResponse.json({ body, contact: updatedContact });
}
