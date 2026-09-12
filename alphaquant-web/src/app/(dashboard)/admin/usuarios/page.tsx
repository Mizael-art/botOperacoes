"use client";

import React, { useState, useEffect } from "react";
import { Users, Plus, ShieldCheck, Check, Lock, X, CheckSquare, Square, Edit, Key, Trash2, DollarSign } from "lucide-react";

export default function AdminUsuariosPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [availableAccounts, setAvailableAccounts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  // Form states
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState("ATIVO");
  const [role, setRole] = useState("trader");
  const [riskSizing, setRiskSizing] = useState("5$");
  const [defaultLeverage, setDefaultLeverage] = useState(10);
  const [selectedAccounts, setSelectedAccounts] = useState<number[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const [uRes, aRes] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/accounts"),
      ]);

      let accs: any[] = [];
      if (aRes.ok) {
        const aData = await aRes.json();
        if (aData?.accounts) {
          accs = aData.accounts;
          setAvailableAccounts(accs);
        }
      }

      if (uRes.ok) {
        const data = await uRes.json();
        if (data?.users) {
          setUsers(
            data.users.map((u: any) => {
              const uAccIds: number[] = u.accountIds || [];
              const uAccNames = uAccIds
                .map((id) => accs.find((a) => a.id === id)?.name || `Conta #${id}`)
                .filter(Boolean);

              return {
                id: u.id,
                name: u.name,
                username: u.username,
                role: u.role || "trader",
                status: u.status || "ATIVO",
                riskSizing: u.riskSizing || "5$",
                defaultLeverage: u.defaultLeverage || 10,
                accountIds: uAccIds,
                accountsLabel: uAccNames.length > 0 ? uAccNames.join(", ") : "Nenhuma conta",
                createdAt: u.created_at ? new Date(u.created_at).toLocaleDateString("pt-BR") : "—",
              };
            })
          );
        }
      }
    } catch {}
    setIsLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const toggleAccount = (id: number) => {
    if (selectedAccounts.includes(id)) {
      setSelectedAccounts(selectedAccounts.filter((accId) => accId !== id));
    } else {
      setSelectedAccounts([...selectedAccounts, id]);
    }
  };

  // 1. Abrir Modal Criar
  const handleOpenCreate = () => {
    setName("");
    setUsername("");
    setPassword("");
    setConfirmPassword("");
    setRole("trader");
    setStatus("ATIVO");
    setRiskSizing("5$");
    setDefaultLeverage(10);
    setSelectedAccounts(availableAccounts.map((a) => a.id));
    setErrorMsg("");
    setSuccessMsg("");
    setIsCreateModalOpen(true);
  };

  // 2. Abrir Modal Editar
  const handleOpenEdit = (user: any) => {
    setSelectedUser(user);
    setName(user.name);
    setUsername(user.username);
    setStatus(user.status);
    setRole(user.role);
    setRiskSizing(user.riskSizing || "5$");
    setDefaultLeverage(user.defaultLeverage || 10);
    setSelectedAccounts(user.accountIds || []);
    setErrorMsg("");
    setSuccessMsg("");
    setIsEditModalOpen(true);
  };

  // 3. Abrir Modal Senha
  const handleOpenPassword = (user: any) => {
    setSelectedUser(user);
    setPassword("");
    setConfirmPassword("");
    setErrorMsg("");
    setSuccessMsg("");
    setIsPasswordModalOpen(true);
  };

  // Submissão: Criar Usuário
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (password !== confirmPassword) {
      setErrorMsg("As senhas não coincidem.");
      return;
    }
    if (password.length < 6) {
      setErrorMsg("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          username,
          password,
          role,
          status,
          riskSizing,
          defaultLeverage: Number(defaultLeverage),
          accountIds: selectedAccounts,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Falha ao criar usuário.");
        return;
      }
      setIsCreateModalOpen(false);
      await fetchUsers();
    } catch {
      setErrorMsg("Erro de conexão ao salvar.");
    }
  };

  // Submissão: Editar Usuário
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setErrorMsg("");

    try {
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedUser.id,
          name,
          username,
          status,
          role,
          riskSizing,
          defaultLeverage: Number(defaultLeverage),
          accountIds: selectedAccounts,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Falha ao atualizar usuário.");
        return;
      }
      setIsEditModalOpen(false);
      await fetchUsers();
    } catch {
      setErrorMsg("Erro de conexão ao atualizar.");
    }
  };

  // Submissão: Alterar Senha
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setErrorMsg("");

    if (password !== confirmPassword) {
      setErrorMsg("As senhas não coincidem.");
      return;
    }
    if (password.length < 6) {
      setErrorMsg("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    try {
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedUser.id,
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Falha ao alterar senha.");
        return;
      }
      setIsPasswordModalOpen(false);
      await fetchUsers();
    } catch {
      setErrorMsg("Erro de conexão ao alterar senha.");
    }
  };

  // Excluir Usuário
  const handleDeleteUser = async (userId: number, userName: string) => {
    if (!confirm(`Deseja realmente excluir o usuário "${userName}"?`)) return;

    try {
      const res = await fetch(`/api/admin/users?id=${userId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await fetchUsers();
      }
    } catch {}
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-white tracking-tight uppercase">
              Gerenciamento de Usuários
            </h1>
            <p className="text-xs text-slate-400">
              Controle de acesso, credenciais, tamanho de operação ($ / %) e vinculação de contas
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="py-2.5 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(6,182,212,0.3)] self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Usuário</span>
        </button>
      </div>

      {/* Users Table */}
      <div className="glass-panel rounded-2xl border border-[#1e2235] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0f111a] text-slate-400 font-bold uppercase tracking-wider border-b border-[#1e2235]">
              <tr>
                <th className="py-3.5 px-4">Nome Completo</th>
                <th className="py-3.5 px-4">Usuário</th>
                <th className="py-3.5 px-4">Perfil</th>
                <th className="py-3.5 px-4">Tamanho Trade</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Contas Vinculadas</th>
                <th className="py-3.5 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#181b28]">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-surface-50/50 transition-colors">
                  <td className="py-4 px-4 font-bold text-white whitespace-nowrap">
                    {u.name}
                  </td>
                  <td className="py-4 px-4 font-mono text-cyan-400 whitespace-nowrap">
                    @{u.username}
                  </td>
                  <td className="py-4 px-4 whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                      u.role === "admin"
                        ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                        : "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30"
                    }`}>
                      {u.role === "admin" ? "Admin" : "Trader"}
                    </span>
                  </td>
                  <td className="py-4 px-4 font-mono text-emerald-400 font-semibold whitespace-nowrap">
                    {u.riskSizing || "5$"} • {u.defaultLeverage || 10}x
                  </td>
                  <td className="py-4 px-4 whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                      u.status === "ATIVO"
                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                        : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                    }`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-slate-300 whitespace-nowrap max-w-xs truncate">
                    {u.accountsLabel}
                  </td>
                  <td className="py-4 px-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(u)}
                        className="px-2.5 py-1 rounded-lg bg-[#141724] hover:bg-[#1e2235] text-cyan-400 font-semibold text-[11px] flex items-center gap-1 border border-[#23273a]"
                      >
                        <Edit className="w-3 h-3" />
                        <span>Editar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenPassword(u)}
                        className="px-2.5 py-1 rounded-lg bg-[#141724] hover:bg-[#1e2235] text-amber-400 font-semibold text-[11px] flex items-center gap-1 border border-[#23273a]"
                      >
                        <Key className="w-3 h-3" />
                        <span>Senha</span>
                      </button>
                      {u.username !== "admin" && (
                        <button
                          type="button"
                          onClick={() => handleDeleteUser(u.id, u.name)}
                          className="p-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30"
                          title="Excluir Usuário"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: CRIAR NOVO USUÁRIO */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-lg glass-panel rounded-2xl p-6 border border-white/10 shadow-2xl">
            <button
              onClick={() => setIsCreateModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-black text-white uppercase tracking-wide mb-1">
              Criar Novo Usuário
            </h3>
            <p className="text-xs text-slate-400 mb-6">
              Defina as credenciais, risco e as contas permitidas ao usuário
            </p>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">
                  Nome Completo
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: João Silva"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0f111a] border border-[#232738] text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">
                    Usuário de Login
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Ex: joao"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0f111a] border border-[#232738] text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">
                    Perfil
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0f111a] border border-[#232738] text-white text-xs focus:outline-none focus:border-cyan-500"
                  >
                    <option value="trader">Trader (Vê só as suas contas)</option>
                    <option value="admin">Administrador (Vê tudo)</option>
                  </select>
                </div>
              </div>

              {/* Risco / Tamanho por Operação */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-[#0d0f17] border border-[#1b1e2c]">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1 uppercase">
                    Tamanho por Trade ($ ou %)
                  </label>
                  <input
                    type="text"
                    value={riskSizing}
                    onChange={(e) => setRiskSizing(e.target.value)}
                    placeholder="Ex: 5$ ou 5%"
                    required
                    className="w-full px-3 py-2 rounded-lg bg-[#08090d] border border-[#232738] text-emerald-400 font-mono text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1 uppercase">
                    Alavancagem Padrão
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="125"
                    value={defaultLeverage}
                    onChange={(e) => setDefaultLeverage(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-[#08090d] border border-[#232738] text-white font-mono text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">
                    Senha
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0f111a] border border-[#232738] text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">
                    Confirmar Senha
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita a senha"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0f111a] border border-[#232738] text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Contas vinculadas (Checkboxes) */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                  Contas Permitidas ao Usuário:
                </label>
                <div className="space-y-2 p-3 rounded-xl bg-[#0c0e15] border border-[#1e2235] max-h-36 overflow-y-auto">
                  {availableAccounts.map((acc) => {
                    const isSelected = selectedAccounts.includes(acc.id);
                    return (
                      <div
                        key={acc.id}
                        onClick={() => toggleAccount(acc.id)}
                        className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-surface-50/50 cursor-pointer select-none text-xs"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-cyan-400" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-500" />
                        )}
                        <span className={isSelected ? "text-white font-semibold" : "text-slate-400"}>
                          {acc.name} ({acc.exchange})
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-[#1a1d2d] text-slate-300 font-semibold text-xs uppercase"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs uppercase shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                >
                  Criar Usuário
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDITAR USUÁRIO */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-lg glass-panel rounded-2xl p-6 border border-white/10 shadow-2xl">
            <button
              onClick={() => setIsEditModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-black text-white uppercase tracking-wide mb-1">
              Editar Usuário: @{selectedUser?.username}
            </h3>
            <p className="text-xs text-slate-400 mb-6">
              Atualize o nome, login, tamanho de operação e contas vinculadas
            </p>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">
                    Nome Completo
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0f111a] border border-[#232738] text-white text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">
                    Usuário (Login)
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0f111a] border border-[#232738] text-white text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0f111a] border border-[#232738] text-white text-xs focus:outline-none focus:border-cyan-500"
                  >
                    <option value="ATIVO">ATIVO</option>
                    <option value="INATIVO">INATIVO (Bloqueado)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">
                    Perfil
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0f111a] border border-[#232738] text-white text-xs focus:outline-none focus:border-cyan-500"
                  >
                    <option value="trader">Trader</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
              </div>

              {/* Risco / Tamanho por Operação */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-[#0d0f17] border border-[#1b1e2c]">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1 uppercase">
                    Tamanho por Trade ($ ou %)
                  </label>
                  <input
                    type="text"
                    value={riskSizing}
                    onChange={(e) => setRiskSizing(e.target.value)}
                    placeholder="Ex: 5$ ou 5%"
                    required
                    className="w-full px-3 py-2 rounded-lg bg-[#08090d] border border-[#232738] text-emerald-400 font-mono text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1 uppercase">
                    Alavancagem Padrão
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="125"
                    value={defaultLeverage}
                    onChange={(e) => setDefaultLeverage(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-[#08090d] border border-[#232738] text-white font-mono text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Contas vinculadas (Checkboxes) */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                  Contas Permitidas ao Usuário:
                </label>
                <div className="space-y-2 p-3 rounded-xl bg-[#0c0e15] border border-[#1e2235] max-h-36 overflow-y-auto">
                  {availableAccounts.map((acc) => {
                    const isSelected = selectedAccounts.includes(acc.id);
                    return (
                      <div
                        key={acc.id}
                        onClick={() => toggleAccount(acc.id)}
                        className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-surface-50/50 cursor-pointer select-none text-xs"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-cyan-400" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-500" />
                        )}
                        <span className={isSelected ? "text-white font-semibold" : "text-slate-400"}>
                          {acc.name} ({acc.exchange})
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-[#1a1d2d] text-slate-300 font-semibold text-xs uppercase"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs uppercase shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ALTERAR SENHA */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-md glass-panel rounded-2xl p-6 border border-white/10 shadow-2xl">
            <button
              onClick={() => setIsPasswordModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-black text-white uppercase tracking-wide mb-1">
              Alterar Senha: @{selectedUser?.username}
            </h3>
            <p className="text-xs text-slate-400 mb-6">
              Digite uma nova senha de acesso para este usuário
            </p>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">
                  Nova Senha
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0f111a] border border-[#232738] text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">
                  Confirmar Nova Senha
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0f111a] border border-[#232738] text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-[#1a1d2d] text-slate-300 font-semibold text-xs uppercase"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase shadow-[0_0_15px_rgba(245,158,11,0.3)]"
                >
                  Atualizar Senha
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
