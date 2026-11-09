import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Contagens por nicho — quantos contatos no total e quantos ainda não foram atribuídos a um fluxo. */
export async function GET() {
  const totalGeral = await prisma.contact.count();
  const pendentesGeral = await prisma.contact.count({ where: { currentFlowId: null } });

  const distinctNiches = await prisma.contact.findMany({
    distinct: ["niche"],
    select: { niche: true },
  });

  const porNicho = await Promise.all(
    distinctNiches.map(async ({ niche }) => {
      const total = await prisma.contact.count({ where: { niche } });
      const pendentes = await prisma.contact.count({ where: { niche, currentFlowId: null } });
      return { niche, total, pendentes };
    })
  );

  return NextResponse.json({ totalGeral, pendentesGeral, porNicho });
}
