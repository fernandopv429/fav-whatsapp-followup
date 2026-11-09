import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { aiPaused?: boolean };

  if (typeof body.aiPaused !== "boolean") {
    return NextResponse.json({ error: "aiPaused é obrigatório." }, { status: 400 });
  }

  const contact = await prisma.contact.update({
    where: { id },
    data: { aiPaused: body.aiPaused },
  });
  return NextResponse.json(contact);
}
