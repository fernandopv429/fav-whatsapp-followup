import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { prisma } from "@/lib/prisma";
import { normalizePhoneBR } from "@/lib/phone";
import { renderTemplate } from "@/lib/templates";

interface CsvRow {
  [key: string]: string;
}

export async function POST(req: NextRequest) {
  const template = await prisma.messageTemplate.findUnique({ where: { key: "inicial" } });
  if (!template || !template.bodyText.trim()) {
    return NextResponse.json(
      { error: "Defina a mensagem inicial antes de subir uma lista de contatos." },
      { status: 400 }
    );
  }

  const form = await req.formData();
  const file = form.get("file");
  const sourceBatch = String(form.get("sourceBatch") ?? "").trim() || null;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Envie um arquivo CSV no campo 'file'." }, { status: 400 });
  }

  const text = await file.text();
  const parsed = Papa.parse<CsvRow>(text, { header: true, skipEmptyLines: true });

  let criados = 0;
  let duplicados = 0;
  let invalidos = 0;

  for (const row of parsed.data) {
    const normalizedRow: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) {
      normalizedRow[k.trim().toLowerCase()] = String(v ?? "").trim();
    }

    const rawPhone = normalizedRow["telefone"] ?? normalizedRow["phone"] ?? normalizedRow["celular"] ?? "";
    const name = normalizedRow["nome"] ?? normalizedRow["name"] ?? null;
    const phone = normalizePhoneBR(rawPhone);

    if (!phone) {
      invalidos++;
      continue;
    }

    try {
      const contact = await prisma.contact.create({
        data: { phone, name, sourceBatch, stage: "novo" },
      });

      await prisma.messageLog.create({
        data: {
          contactId: contact.id,
          direction: "out",
          templateKey: "inicial",
          body: renderTemplate(template.bodyText, { nome: name }),
          status: "queued",
        },
      });

      criados++;
    } catch (err: unknown) {
      // violação da unique constraint em `phone` => contato já existe, não duplica envio
      if (err instanceof Error && err.message.includes("Unique constraint")) {
        duplicados++;
      } else {
        invalidos++;
      }
    }
  }

  return NextResponse.json({ criados, duplicados, invalidos, total: parsed.data.length });
}
