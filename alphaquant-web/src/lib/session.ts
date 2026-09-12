import { getIronSession, IronSession } from "iron-session";
import { cookies } from "next/headers";

export interface SessionData {
  userId: number;
  username: string;
  name: string;
  role: "admin" | "trader";
  isLoggedIn: boolean;
}

export const defaultSession: SessionData = {
  userId: 0,
  username: "",
  name: "",
  role: "trader",
  isLoggedIn: false,
};

export const sessionOptions = {
  password: process.env.SESSION_SECRET || "complex_password_at_least_32_characters_long_alphaquant_2026",
  cookieName: "alphaquant_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 7, // 7 dias
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
  return session;
}
