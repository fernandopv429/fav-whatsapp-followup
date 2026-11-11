import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sourceFlowId } = await params;

  const source = await prisma.flow.findUnique({
    where: { id: sourceFlowId },
    include: { steps: { orderBy: { position: "asc" } } },
  });
  if (!source) return NextResponse.json({ error: "Fluxo não encontrado." }, { status: 404 });

  const newFlow = await prisma.$transaction(async (tx) => {
    const flow = await tx.flow.create({
      data: {
        name: `${source.name} (cópia)`,
        sendWindowStart: source.sendWindowStart,
        sendWindowEnd: source.sendWindowEnd,
      },
    });

    const idMap = new Map<string, string>();
    const created: { id: string; sourceId: string }[] = [];

    for (const step of source.steps) {
      const copy = await tx.flowStep.create({
        data: {
          flowId: flow.id,
          type: step.type,
          position: step.position,
          label: step.label,
          templateKey: step.templateKey,
          numberStrategy: step.numberStrategy,
          numberId: step.numberId,
          thresholdMinutes: step.thresholdMinutes,
          onReplySendTemplateKey: step.onReplySendTemplateKey,
          endLabel: step.endLabel,
          mediaUrl: step.mediaUrl,
          mediaType: step.mediaType,
          sendWindowStart: step.sendWindowStart,
          sendWindowEnd: step.sendWindowEnd,
        },
      });
      idMap.set(step.id, copy.id);
      created.push({ id: copy.id, sourceId: step.id });
    }

    for (const { id, sourceId } of created) {
      const original = source.steps.find((s) => s.id === sourceId)!;
      const patch: {
        nextStepId?: string | null;
        onReplyGotoStepId?: string | null;
        onTimeoutGotoStepId?: string | null;
      } = {};
      if (original.nextStepId) patch.nextStepId = idMap.get(original.nextStepId) ?? null;
      if (original.onReplyGotoStepId) patch.onReplyGotoStepId = idMap.get(original.onReplyGotoStepId) ?? null;
      if (original.onTimeoutGotoStepId) patch.onTimeoutGotoStepId = idMap.get(original.onTimeoutGotoStepId) ?? null;
      if (Object.keys(patch).length > 0) {
        await tx.flowStep.update({ where: { id }, data: patch });
      }
    }

    return flow;
  });

  return NextResponse.json(newFlow);
}
