import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logoutInstance, deleteInstance } from "@/lib/evolution";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await req.json()) as {
    status?: "warming_up" | "active" | "paused" | "banned";
    dailyCap?: number;
    label?: string;
  };

  const number = await prisma.whatsappNumber.update({
    where: { id },
    data: {
      ...(body.status && { status: body.status }),
      ...(typeof body.dailyCap === "number" && { dailyCap: body.dailyCap }),
      ...(body.label && { label: body.label }),
    },
  });

  return NextResponse.json(number);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const number = await prisma.whatsappNumber.findUnique({ where: { id } });
  if (!number) {
    return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  }

  try {
    await logoutInstance(number.evolutionInstanceName, number.evolutionInstanceToken ?? undefined);
    await deleteInstance(number.evolutionInstanceName, number.evolutionInstanceToken ?? undefined);
  } catch (err) {
    console.error("Falha ao remover instance na Evolution API", err);
  }

  await prisma.whatsappNumber.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
