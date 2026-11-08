import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { renderTemplate } from "@/lib/templates";
import type { Prisma } from "@prisma/client";

/**
 * Enfileira a mensagem inicial pros contatos `novo` que ainda não foram
 * iniciados (sem nenhum MessageLog com templateKey "inicial"), filtrando
 * opcionalmente por nicho/fonte/lote. Sem filtro = todos os não iniciados.
 */
export async function POST(req: NextRequest) {
  const { niche, leadSource, sourceBatch } = (await req.json().catch(() => ({}))) as {
    niche?: string | null;
    leadSource?: string | null;
    sourceBatch?: string | null;
  };

  const template = await prisma.messageTemplate.findUnique({ where: { key: "inicial" } });
  if (!template || !template.bodyText.trim()) {
    return NextResponse.json(
      { error: "Defina a mensagem inicial em Mensagens antes de iniciar o disparo." },
      { status: 400 }
    );
  }

  const where: Prisma.ContactWhereInput = {
    stage: "novo",
    messageLogs: { none: { templateKey: "inicial" } },
    ...(niche && { niche }),
    ...(leadSource && { leadSource }),
    ...(sourceBatch && { sourceBatch }),
  };

  const candidates = await prisma.contact.findMany({ where });

  for (const contact of candidates) {
    await prisma.messageLog.create({
      data: {
        contactId: contact.id,
        direction: "out",
        templateKey: "inicial",
        body: renderTemplate(template.bodyText, { nome: contact.name }),
        status: "queued",
      },
    });
  }

  return NextResponse.json({ iniciados: candidates.length });
}
