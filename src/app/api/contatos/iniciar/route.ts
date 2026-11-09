import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/**
 * Atribui um Flow aos contatos ainda sem fluxo (currentFlowId null) que
 * baterem o filtro opcional de nicho/fonte/lote — sem filtro = todos.
 * Só aponta pro primeiro passo do fluxo; quem efetivamente manda a mensagem
 * (e respeita o limite diário de contatos novos) é o worker (tick()).
 */
export async function POST(req: NextRequest) {
  const { flowId, niche, leadSource, sourceBatch } = (await req.json().catch(() => ({}))) as {
    flowId?: string;
    niche?: string | null;
    leadSource?: string | null;
    sourceBatch?: string | null;
  };

  if (!flowId) {
    return NextResponse.json({ error: "Escolha um fluxo antes de iniciar o disparo." }, { status: 400 });
  }

  const firstStep = await prisma.flowStep.findFirst({
    where: { flowId },
    orderBy: { position: "asc" },
  });
  if (!firstStep) {
    return NextResponse.json({ error: "Esse fluxo ainda não tem nenhum passo." }, { status: 400 });
  }

  const where: Prisma.ContactWhereInput = {
    currentFlowId: null,
    ...(niche && { niche }),
    ...(leadSource && { leadSource }),
    ...(sourceBatch && { sourceBatch }),
  };

  const { count } = await prisma.contact.updateMany({
    where,
    data: { currentFlowId: flowId, currentStepId: firstStep.id, stepEnteredAt: new Date() },
  });

  return NextResponse.json({ iniciados: count });
}
