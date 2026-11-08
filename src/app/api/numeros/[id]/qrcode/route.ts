import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { connectInstance } from "@/lib/evolution";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const number = await prisma.whatsappNumber.findUnique({ where: { id } });
  if (!number) {
    return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  }

  const result = await connectInstance(number.evolutionInstanceName);
  return NextResponse.json(result);
}
