import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const session = await getSession();
    session.destroy();
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: "Erro ao encerrar sessão" }, { status: 500 });
  }
}
