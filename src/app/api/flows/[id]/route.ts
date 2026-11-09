import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const flow = await prisma.flow.findUnique({
    where: { id },
    include: { steps: { orderBy: { position: "asc" } } },
  });
  if (!flow) return NextResponse.json({ error: "Fluxo não encontrado." }, { status: 404 });
  return NextResponse.json(flow);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const contactsUsing = await prisma.contact.count({ where: { currentFlowId: id } });
  if (contactsUsing > 0) {
    return NextResponse.json(
      { error: `${contactsUsing} contato(s) ainda estão nesse fluxo — não dá pra apagar.` },
      { status: 400 }
    );
  }
  await prisma.$transaction([
    prisma.flowStep.deleteMany({ where: { flowId: id } }),
    prisma.flow.delete({ where: { id } }),
  ]);
  return NextResponse.json({ ok: true });
}
