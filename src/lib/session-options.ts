import type { SessionOptions } from "iron-session";

export interface SessionData {
  isLoggedIn?: boolean;
  user?: string;
}

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET ?? "",
  cookieName: "fav_whatsapp_followup_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
  },
};
