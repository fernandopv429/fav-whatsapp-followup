"use client";

import { useEffect, useState, useCallback } from "react";

interface NumberRow {
  id: string;
  label: string;
  evolutionInstanceName: string;
  phoneNumber: string | null;
  order: number;
  status: "warming_up" | "active" | "paused" | "banned";
  dailyCap: number;
  sentToday: number;
  liveStatus: string;
}

const STATUS_LABEL: Record<NumberRow["status"], string> = {
  warming_up: "Aquecendo",
  active: "Ativo",
  paused: "Pausado",
  banned: "Bloqueado",
};

export default function NumerosPage() {
  const [numbers, setNumbers] = useState<NumberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [qrcode, setQrcode] = useState<{ label: string; base64?: string; code?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/numeros");
    if (res.ok) setNumbers(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount + polling é intencional aqui
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const res = await fetch("/api/numeros", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newLabel }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Falha ao criar número.");
        return;
      }
      setQrcode({ label: newLabel, base64: data.qrcode?.base64, code: data.qrcode?.code });
      setNewLabel("");
      load();
    } finally {
      setCreating(false);
    }
  }

  async function handleRefreshQr(n: NumberRow) {
    const res = await fetch(`/api/numeros/${n.id}/qrcode`);
    const data = await res.json();
    setQrcode({ label: n.label, base64: data.base64, code: data.code });
  }

  async function handleToggleStatus(n: NumberRow) {
    const next = n.status === "paused" ? "active" : "paused";
    await fetch(`/api/numeros/${n.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    load();
  }

  async function handleCapChange(n: NumberRow, cap: number) {
    await fetch(`/api/numeros/${n.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dailyCap: cap }),
    });
    load();
  }

  async function handleOrderChange(n: NumberRow, order: number) {
    await fetch(`/api/numeros/${n.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order }),
    });
    load();
  }

  async function handleDelete(n: NumberRow) {
    if (!confirm(`Remover o número "${n.label}"? Isso desconecta e apaga a instance na Evolution API.`)) return;
    await fetch(`/api/numeros/${n.id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-neutral-900">Números</h1>
      </div>

      <form onSubmit={handleCreate} className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-4 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1">
          <label className="text-sm text-neutral-600">Nome do número (ex: Comercial 1)</label>
          <input
            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            required
          />
        </div>
        <button
          type="submit"
          disabled={creating}
          className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {creating ? "Criando..." : "Conectar novo número"}
        </button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {qrcode && (
        <div className="space-y-2 rounded-lg border border-neutral-200 bg-white p-4">
          <p className="text-sm text-neutral-700">
            Escaneie o QR code no WhatsApp de <strong>{qrcode.label}</strong>:
          </p>
          {qrcode.base64 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrcode.base64} alt="QR code" className="h-64 w-64" />
          ) : (
            <p className="text-sm text-neutral-500">QR code indisponível no momento.</p>
          )}
          <button onClick={() => setQrcode(null)} className="text-sm text-neutral-500 underline">
            Fechar
          </button>
        </div>
      )}

      <p className="text-sm text-neutral-500">
        A ordem abaixo define qual número manda o Dia 1, Dia 2 etc. da simulação de cliente perdido —
        cada dia usa um número diferente, na ordem que você definir aqui.
      </p>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-neutral-50 text-left text-neutral-500">
            <tr>
              <th className="px-4 py-2">Ordem</th>
              <th className="px-4 py-2">Nome</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Conexão</th>
              <th className="px-4 py-2">Cap diário</th>
              <th className="px-4 py-2">Enviadas hoje</th>
              <th className="px-4 py-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-neutral-400">
                  Carregando...
                </td>
              </tr>
            )}
            {!loading && numbers.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-neutral-400">
                  Nenhum número conectado ainda.
                </td>
              </tr>
            )}
            {numbers.map((n) => (
              <tr key={n.id} className="border-t border-neutral-100">
                <td className="px-4 py-2">
                  <input
                    type="number"
                    defaultValue={n.order}
                    onBlur={(e) => handleOrderChange(n, Number(e.target.value))}
                    className="w-16 rounded border border-neutral-300 px-2 py-1"
                  />
                </td>
                <td className="px-4 py-2 font-medium text-neutral-900">{n.label}</td>
                <td className="px-4 py-2">{STATUS_LABEL[n.status]}</td>
                <td className="px-4 py-2 text-neutral-500">{n.liveStatus}</td>
                <td className="px-4 py-2">
                  <input
                    type="number"
                    defaultValue={n.dailyCap}
                    onBlur={(e) => handleCapChange(n, Number(e.target.value))}
                    className="w-20 rounded border border-neutral-300 px-2 py-1"
                  />
                </td>
                <td className="px-4 py-2">{n.sentToday}</td>
                <td className="px-4 py-2 space-x-2">
                  <button onClick={() => handleRefreshQr(n)} className="text-blue-600 hover:underline">
                    QR
                  </button>
                  <button onClick={() => handleToggleStatus(n)} className="text-amber-600 hover:underline">
                    {n.status === "paused" ? "Reativar" : "Pausar"}
                  </button>
                  <button onClick={() => handleDelete(n)} className="text-red-600 hover:underline">
                    Remover
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
