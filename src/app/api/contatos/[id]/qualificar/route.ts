import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generatePersonalizedOffer } from "@/lib/ai";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [contact, promptTemplate] = await Promise.all([
    prisma.contact.findUnique({ where: { id } }),
    prisma.messageTemplate.findUnique({ where: { key: "oferta" } }),
  ]);

  if (!contact) {
    return NextResponse.json({ error: "Contato não encontrado." }, { status: 404 });
  }
  if (!promptTemplate || !promptTemplate.bodyText.trim()) {
    return NextResponse.json(
      { error: "Defina as instruções da mensagem de oferta antes de qualificar um contato." },
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

  const [, updatedContact] = await prisma.$transaction([
    prisma.messageLog.create({
      data: {
        contactId: contact.id,
        direction: "out",
        templateKey: "oferta",
        body,
        status: "queued",
      },
    }),
    prisma.contact.update({ where: { id: contact.id }, data: { stage: "oferta_enviada" } }),
  ]);

  return NextResponse.json({ body, contact: updatedContact });
}
