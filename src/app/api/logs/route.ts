import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const logs = await prisma.messageLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { contact: true, number: true },
  });
  return NextResponse.json(logs);
}
