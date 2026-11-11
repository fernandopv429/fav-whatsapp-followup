import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { NumberStrategy } from "@prisma/client";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  const { stepId } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    label?: string | null;
    position?: number;
    templateKey?: string | null;
    numberStrategy?: NumberStrategy | null;
    numberId?: string | null;
    nextStepId?: string | null;
    thresholdMinutes?: number | null;
    onReplyGotoStepId?: string | null;
    onReplySendTemplateKey?: string | null;
    onTimeoutGotoStepId?: string | null;
    endLabel?: string | null;
    mediaUrl?: string | null;
    mediaType?: string | null;
    sendWindowStart?: number | null;
    sendWindowEnd?: number | null;
  };

  const step = await prisma.flowStep.update({
    where: { id: stepId },
    data: {
      ...(body.label !== undefined && { label: body.label || null }),
      ...(body.position !== undefined && { position: body.position }),
      ...(body.templateKey !== undefined && { templateKey: body.templateKey || null }),
      ...(body.numberStrategy !== undefined && { numberStrategy: body.numberStrategy || null }),
      ...(body.numberId !== undefined && { numberId: body.numberId || null }),
      ...(body.nextStepId !== undefined && { nextStepId: body.nextStepId || null }),
      ...(body.thresholdMinutes !== undefined && { thresholdMinutes: body.thresholdMinutes }),
      ...(body.onReplyGotoStepId !== undefined && { onReplyGotoStepId: body.onReplyGotoStepId || null }),
      ...(body.onReplySendTemplateKey !== undefined && {
        onReplySendTemplateKey: body.onReplySendTemplateKey || null,
      }),
      ...(body.onTimeoutGotoStepId !== undefined && { onTimeoutGotoStepId: body.onTimeoutGotoStepId || null }),
      ...(body.endLabel !== undefined && { endLabel: body.endLabel || null }),
      ...(body.mediaUrl !== undefined && { mediaUrl: body.mediaUrl || null }),
      ...(body.mediaType !== undefined && { mediaType: body.mediaType || null }),
      ...(body.sendWindowStart !== undefined && { sendWindowStart: body.sendWindowStart }),
      ...(body.sendWindowEnd !== undefined && { sendWindowEnd: body.sendWindowEnd }),
    },
  });

  return NextResponse.json(step);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  const { stepId } = await params;
  await prisma.flowStep.delete({ where: { id: stepId } });
  return NextResponse.json({ ok: true });
}
