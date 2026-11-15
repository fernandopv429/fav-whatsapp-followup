import { NextRequest, NextResponse } from "next/server";
import { unsealData } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session-options";

const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/webhooks/evolution",
  "/api/internal/tick",
  // Mídia dos passos de fluxo (vídeo/imagem/PDF anexados nas mensagens):
  // quem baixa é a Evolution API, de fora, sem sessão — atrás do login ela
  // receberia o redirect pro /login no lugar do arquivo.
  "/midia",
];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(sessionOptions.cookieName)?.value;
  let loggedIn = false;
  if (cookie) {
    try {
      const data = await unsealData<SessionData>(cookie, {
        password: sessionOptions.password,
      });
      loggedIn = Boolean(data.isLoggedIn);
    } catch {
      loggedIn = false;
    }
  }

  if (!loggedIn) {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
