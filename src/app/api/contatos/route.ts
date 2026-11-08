import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const contacts = await prisma.contact.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json(contacts);
}
