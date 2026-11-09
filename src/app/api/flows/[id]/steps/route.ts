import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { FlowStepType, NumberStrategy } from "@prisma/client";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: flowId } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    type?: FlowStepType;
    templateKey?: string | null;
    numberStrategy?: NumberStrategy | null;
    numberId?: string | null;
    nextStepId?: string | null;
    thresholdMinutes?: number | null;
    onReplyGotoStepId?: string | null;
    onReplySendTemplateKey?: string | null;
    onTimeoutGotoStepId?: string | null;
    endLabel?: string | null;
  };

  if (!body.type) {
    return NextResponse.json({ error: "Tipo do passo é obrigatório." }, { status: 400 });
  }

  const flow = await prisma.flow.findUnique({ where: { id: flowId } });
  if (!flow) return NextResponse.json({ error: "Fluxo não encontrado." }, { status: 404 });

  const last = await prisma.flowStep.findFirst({ where: { flowId }, orderBy: { position: "desc" } });
  const position = (last?.position ?? -1) + 1;

  const step = await prisma.flowStep.create({
    data: {
      flowId,
      type: body.type,
      position,
      templateKey: body.templateKey || null,
      numberStrategy: body.numberStrategy || null,
      numberId: body.numberId || null,
      nextStepId: body.nextStepId || null,
      thresholdMinutes: body.thresholdMinutes ?? null,
      onReplyGotoStepId: body.onReplyGotoStepId || null,
      onReplySendTemplateKey: body.onReplySendTemplateKey || null,
      onTimeoutGotoStepId: body.onTimeoutGotoStepId || null,
      endLabel: body.endLabel || null,
    },
  });

  return NextResponse.json(step);
}
