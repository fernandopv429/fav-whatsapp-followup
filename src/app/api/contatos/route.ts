import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const contacts = await prisma.contact.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { messageLogs: { where: { templateKey: "inicial" }, select: { id: true }, take: 1 } },
  });
  return NextResponse.json(
    contacts.map((c) => ({ ...c, started: c.messageLogs.length > 0, messageLogs: undefined }))
  );
}
