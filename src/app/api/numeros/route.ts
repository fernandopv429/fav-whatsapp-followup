import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createInstance, setWebhook, fetchInstances } from "@/lib/evolution";
import { getSettings } from "@/lib/settings";

function slugify(label: string): string {
  return (
    label
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "numero"
  );
}

export async function GET() {
  const numbers = await prisma.whatsappNumber.findMany({
    orderBy: { createdAt: "asc" },
  });

  let live: Awaited<ReturnType<typeof fetchInstances>> = [];
  try {
    live = await fetchInstances();
  } catch {
    // Evolution API indisponível no momento: devolve só os dados do banco.
  }
  const liveByName = new Map(live.map((i) => [i.name, i]));

  return NextResponse.json(
    numbers.map((n) => ({
      ...n,
      liveStatus: liveByName.get(n.evolutionInstanceName)?.connectionStatus ?? "desconhecido",
    }))
  );
}

export async function POST(req: NextRequest) {
  const { label } = (await req.json()) as { label?: string };
  if (!label) {
    return NextResponse.json({ error: "label é obrigatório" }, { status: 400 });
  }

  const instanceName = `${slugify(label)}-${Date.now().toString(36)}`;
  const appUrl = process.env.APP_URL;
  if (!appUrl) {
    return NextResponse.json({ error: "APP_URL não configurado no ambiente" }, { status: 500 });
  }

  const created = await createInstance(instanceName);
  const instanceToken =
    typeof created.hash === "string" ? created.hash : created.hash?.apikey;

  try {
    await setWebhook(instanceName, `${appUrl}/api/webhooks/evolution`, instanceToken);
  } catch (err) {
    // Não derruba a criação por causa do webhook; fica visível pro usuário tentar de novo.
    console.error("Falha ao configurar webhook da instance", instanceName, err);
  }

  const settings = await getSettings();
  const number = await prisma.whatsappNumber.create({
    data: {
      label,
      evolutionInstanceName: instanceName,
      evolutionInstanceToken: instanceToken,
      status: "warming_up",
      dailyCap: settings.warmupDailyCapStart,
    },
  });

  return NextResponse.json({ number, qrcode: created.qrcode });
}
