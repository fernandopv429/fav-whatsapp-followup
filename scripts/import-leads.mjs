// Import direto de um CSV de leads pro banco, sem passar pela API web.
// Uso: node scripts/import-leads.mjs --niche advocacia --source casa_de_dados --batch "lote-1" arquivo.csv
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const PHONE_COLUMNS = ["telefone", "telefones", "phone", "celular"];
const NAME_COLUMNS = ["nome fantasia", "razao social", "nome", "name"];
const RESERVED_KEYS = new Set([...PHONE_COLUMNS, ...NAME_COLUMNS]);

function normalizePhoneBR(raw) {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if (digits.length >= 12 && digits.length <= 13) return digits;
  return null;
}

function extractPhone(row) {
  for (const col of PHONE_COLUMNS) {
    const raw = row[col];
    if (!raw) continue;
    const first = raw.split(/[,;/]/)[0]?.trim();
    const normalized = normalizePhoneBR(first ?? "");
    if (normalized) return normalized;
  }
  return null;
}

function extractName(row) {
  for (const col of NAME_COLUMNS) {
    if (row[col]) return row[col];
  }
  return null;
}

// Parser CSV simples com suporte a `;` ou `,` (auto-detecta pela 1ª linha) e
// campos entre aspas (inclusive com vírgula/ponto-e-vírgula dentro).
function parseCsv(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";

  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const header = rows[0].map((h) => h.trim().toLowerCase());
  return rows
    .slice(1)
    .filter((r) => r.some((v) => v.trim() !== ""))
    .map((r) => Object.fromEntries(header.map((h, idx) => [h, (r[idx] ?? "").trim()])));
}

async function main() {
  const args = process.argv.slice(2);
  const opts = { niche: null, source: null, batch: null, files: [] };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--niche") opts.niche = args[++i];
    else if (args[i] === "--source") opts.source = args[++i];
    else if (args[i] === "--batch") opts.batch = args[++i];
    else opts.files.push(args[i]);
  }
  if (opts.files.length === 0) {
    console.error("Uso: node scripts/import-leads.mjs --niche X --source Y [--batch Z] arquivo.csv [...]");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  let totalCriados = 0;
  let totalDuplicados = 0;
  let totalInvalidos = 0;

  for (const file of opts.files) {
    const text = readFileSync(file, "utf-8").replace(/^﻿/, "");
    const rows = parseCsv(text);

    let criados = 0;
    let duplicados = 0;
    let invalidos = 0;

    for (const row of rows) {
      const phone = extractPhone(row);
      const name = extractName(row);
      if (!phone) {
        invalidos++;
        continue;
      }

      const companyEntries = Object.entries(row).filter(([k, v]) => !RESERVED_KEYS.has(k) && v !== "");
      const companyData = companyEntries.length > 0 ? Object.fromEntries(companyEntries) : undefined;

      try {
        await prisma.contact.create({
          data: {
            phone,
            name,
            sourceBatch: opts.batch,
            niche: opts.niche,
            leadSource: opts.source,
            companyData,
          },
        });
        criados++;
      } catch (err) {
        if (err instanceof Error && err.message.includes("Unique constraint")) {
          duplicados++;
        } else {
          invalidos++;
        }
      }
    }

    console.log(`${file}: ${criados} criados, ${duplicados} duplicados, ${invalidos} inválidos (de ${rows.length} linhas)`);
    totalCriados += criados;
    totalDuplicados += duplicados;
    totalInvalidos += invalidos;
  }

  console.log(`\nTotal: ${totalCriados} criados, ${totalDuplicados} duplicados, ${totalInvalidos} inválidos`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
