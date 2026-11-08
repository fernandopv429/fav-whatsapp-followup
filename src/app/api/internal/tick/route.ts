import { NextRequest, NextResponse } from "next/server";
import { tick } from "@/lib/worker/tick";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-internal-secret");
  if (!secret || secret !== process.env.INTERNAL_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await tick();
  return NextResponse.json(result);
}
