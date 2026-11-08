import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const templates = await prisma.messageTemplate.findMany({ orderBy: { key: "asc" } });
  return NextResponse.json(templates);
}
