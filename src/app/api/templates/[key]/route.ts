import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;
  const template = await prisma.messageTemplate.findUnique({ where: { key } });
  return NextResponse.json(template);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;
  const { bodyText } = (await req.json()) as { bodyText?: string };
  if (typeof bodyText !== "string" || bodyText.trim() === "") {
    return NextResponse.json({ error: "bodyText é obrigatório" }, { status: 400 });
  }

  const template = await prisma.messageTemplate.upsert({
    where: { key },
    create: { key, bodyText },
    update: { bodyText },
  });

  return NextResponse.json(template);
}
