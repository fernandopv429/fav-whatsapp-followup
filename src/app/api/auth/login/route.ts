import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { verifyCredentials } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { user, password } = (await req.json()) as {
    user?: string;
    password?: string;
  };

  if (!user || !password || !verifyCredentials(user, password)) {
    return NextResponse.json({ error: "Usuário ou senha inválidos." }, { status: 401 });
  }

  const session = await getSession();
  session.isLoggedIn = true;
  session.user = user;
  await session.save();

  return NextResponse.json({ ok: true });
}
