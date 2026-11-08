import { NextRequest, NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/settings";

export async function GET() {
  return NextResponse.json(await getSettings());
}

const NUMERIC_FIELDS = [
  "responseThresholdMinutes",
  "dripTotalDays",
  "sendWindowStart",
  "sendWindowEnd",
  "minDelaySeconds",
  "maxDelaySeconds",
  "warmupDailyCapStart",
  "warmupDailyCapMax",
  "warmupRampDays",
] as const;

export async function PUT(req: NextRequest) {
  const body = (await req.json()) as Record<string, unknown>;
  const data: Record<string, number> = {};

  for (const field of NUMERIC_FIELDS) {
    if (field in body) {
      const value = Number(body[field]);
      if (!Number.isFinite(value)) {
        return NextResponse.json({ error: `${field} inválido` }, { status: 400 });
      }
      data[field] = value;
    }
  }

  const updated = await updateSettings(data);
  return NextResponse.json(updated);
}
