"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface FlowRow {
  id: string;
  name: string;
  _count: { steps: number; contacts: number };
}

export default function FluxosPage() {
  const router = useRouter();
  const [flows, setFlows] = useState<FlowRow[]>([]);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const load = async () => {
    const res = await fetch("/api/flows");
    if (res.ok) setFlows(await res.json());
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount é intencional aqui
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/flows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const flow = await res.json();
      setNewName("");
      await load();
      router.push(`/fluxos/${flow.id}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-lg font-semibold text-neutral-900">Fluxos</h1>
      <p className="text-sm text-neutral-500">
        Cada fluxo é uma sequência de passos (mandar mensagem, esperar resposta, oferta por IA) que um
        contato percorre depois de iniciado. Monte um fluxo pra cada lógica diferente — ex: um funil de
        qualificação de IA com vários números, e uma cadência simples com um número só.
      </p>

      <form onSubmit={handleCreate} className="flex items-end gap-2 rounded-lg border border-neutral-200 bg-white p-4">
        <div className="flex-1 space-y-1">
          <label className="text-sm text-neutral-600">Nome do fluxo (ex: Funil IA, Cadência advocacia)</label>
          <input
            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
        </div>
        <button
          type="submit"
          disabled={creating || !newName.trim()}
          className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {creating ? "Criando..." : "Criar fluxo"}
        </button>
      </form>

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-neutral-500">
            <tr>
              <th className="px-4 py-2">Nome</th>
              <th className="px-4 py-2">Passos</th>
              <th className="px-4 py-2">Contatos nele agora</th>
              <th className="px-4 py-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {flows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-neutral-400">
                  Nenhum fluxo ainda.
                </td>
              </tr>
            )}
            {flows.map((f) => (
              <tr key={f.id} className="border-t border-neutral-100">
                <td className="px-4 py-2 font-medium text-neutral-900">{f.name}</td>
                <td className="px-4 py-2">{f._count.steps}</td>
                <td className="px-4 py-2">{f._count.contacts}</td>
                <td className="px-4 py-2">
                  <Link href={`/fluxos/${f.id}`} className="text-blue-600 hover:underline">
                    Editar passos
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
