import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: session.userId,
        username: session.username,
        name: session.name,
        role: session.role,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: "Erro ao consultar sessão" }, { status: 500 });
  }
}
