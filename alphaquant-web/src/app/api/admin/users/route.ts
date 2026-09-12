import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  listAllWebUsers,
  createWebUser,
  updateWebUser,
  deleteWebUser,
} from "@/lib/userStore";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || session.role !== "admin") {
      return NextResponse.json({ error: "Acesso restrito ao administrador" }, { status: 403 });
    }

    const users = await listAllWebUsers();
    return NextResponse.json({ ok: true, users });
  } catch (err: any) {
    return NextResponse.json({ error: "Erro interno ao listar usuários" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || session.role !== "admin") {
      return NextResponse.json({ error: "Acesso restrito ao administrador" }, { status: 403 });
    }

    const body = await req.json();
    const { name, username, password, role = "trader", status = "ATIVO", riskSizing = "5$", defaultLeverage = 10, accountIds = [] } = body;

    if (!name || !username || !password) {
      return NextResponse.json({ error: "Dados incompletos (nome, usuário e senha são obrigatórios)" }, { status: 400 });
    }

    const newUser = await createWebUser({
      name,
      username,
      password,
      role,
      status,
      riskSizing,
      defaultLeverage,
      accountIds,
    });

    return NextResponse.json({ ok: true, user: newUser });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erro ao criar usuário" }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || session.role !== "admin") {
      return NextResponse.json({ error: "Acesso restrito ao administrador" }, { status: 403 });
    }

    const body = await req.json();
    const { id, name, username, password, status, role, riskSizing, defaultLeverage, accountIds } = body;

    if (!id) {
      return NextResponse.json({ error: "ID de usuário obrigatório" }, { status: 400 });
    }

    const updated = await updateWebUser(Number(id), {
      name,
      username,
      password,
      status,
      role,
      riskSizing,
      defaultLeverage,
      accountIds,
    });

    if (!updated) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, user: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erro ao atualizar usuário" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || session.role !== "admin") {
      return NextResponse.json({ error: "Acesso restrito ao administrador" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get("id"));

    if (!id) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const deleted = await deleteWebUser(id);
    return NextResponse.json({ ok: deleted });
  } catch (err: any) {
    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
  }
}
