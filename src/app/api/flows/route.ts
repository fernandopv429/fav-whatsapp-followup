import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const flows = await prisma.flow.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { steps: true, contacts: true } } },
  });
  return NextResponse.json(flows);
}

export async function POST(req: NextRequest) {
  const { name } = (await req.json().catch(() => ({}))) as { name?: string };
  if (!name?.trim()) {
    return NextResponse.json({ error: "Dê um nome pro fluxo." }, { status: 400 });
  }
  const flow = await prisma.flow.create({ data: { name: name.trim() } });
  return NextResponse.json(flow);
}
