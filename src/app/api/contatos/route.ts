import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const niche = req.nextUrl.searchParams.get("niche");

  const contacts = await prisma.contact.findMany({
    where: niche ? { niche } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { currentFlow: { select: { name: true } }, currentStep: { select: { type: true } } },
  });
  return NextResponse.json(contacts);
}
