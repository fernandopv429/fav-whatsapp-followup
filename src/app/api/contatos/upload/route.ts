import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { prisma } from "@/lib/prisma";
import { normalizePhoneBR } from "@/lib/phone";
import { renderTemplate } from "@/lib/templates";

interface CsvRow {
  [key: string]: string;
}

const PHONE_COLUMNS = ["telefone", "telefones", "phone", "celular"];
const NAME_COLUMNS = ["nome fantasia", "razao social", "nome", "name"];
const RESERVED_KEYS = new Set([...PHONE_COLUMNS, ...NAME_COLUMNS]);

/** Campos de telefone às vezes trazem mais de um número junto (ex: "11-2379,11-4975"); usa o primeiro. */
function extractPhone(row: Record<string, string>): string | null {
  for (const col of PHONE_COLUMNS) {
    const raw = row[col];
    if (!raw) continue;
    const first = raw.split(/[,;/]/)[0]?.trim();
    const normalized = normalizePhoneBR(first ?? "");
    if (normalized) return normalized;
  }
  return null;
}

function extractName(row: Record<string, string>): string | null {
  for (const col of NAME_COLUMNS) {
    if (row[col]) return row[col];
  }
  return null;
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
  const niche = String(form.get("niche") ?? "").trim() || null;
  const leadSource = String(form.get("leadSource") ?? "").trim() || null;

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

    const phone = extractPhone(normalizedRow);
    const name = extractName(normalizedRow);

    if (!phone) {
      invalidos++;
      continue;
    }

    const companyEntries = Object.entries(normalizedRow).filter(
      ([k, v]) => !RESERVED_KEYS.has(k) && v !== ""
    );
    const companyData = companyEntries.length > 0 ? Object.fromEntries(companyEntries) : undefined;

    try {
      const contact = await prisma.contact.create({
        data: { phone, name, sourceBatch, niche, leadSource, stage: "novo", companyData },
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
