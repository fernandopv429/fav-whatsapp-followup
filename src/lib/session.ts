import { getIronSession, type IronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, type SessionData } from "@/lib/session-options";

export type { SessionData };
export { sessionOptions };

export async function getSession(): Promise<IronSession<SessionData>> {
  const password = sessionOptions.password;
  if (typeof password !== "string" || password.length < 32) {
    throw new Error("SESSION_SECRET precisa ter pelo menos 32 caracteres.");
  }
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}
