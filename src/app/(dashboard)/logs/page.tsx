"use client";

import { useEffect, useState } from "react";

interface LogRow {
  id: string;
  direction: "out" | "in";
  templateKey: string | null;
  body: string;
  status: string;
  createdAt: string;
  contact: { phone: string; name: string | null };
  number: { label: string } | null;
}

const STATUS_LABEL: Record<string, string> = {
  queued: "Na fila",
  sent: "Enviada",
  delivered: "Entregue",
  failed: "Falhou",
};

export default function LogsPage() {
  const [logs, setLogs] = useState<LogRow[]>([]);

  useEffect(() => {
    fetch("/api/logs")
      .then((r) => r.json())
      .then(setLogs);
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-neutral-900">Logs</h1>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-neutral-50 text-left text-neutral-500">
            <tr>
              <th className="px-4 py-2">Quando</th>
              <th className="px-4 py-2">Direção</th>
              <th className="px-4 py-2">Contato</th>
              <th className="px-4 py-2">Número</th>
              <th className="px-4 py-2">Mensagem</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-neutral-400">
                  Nenhum log ainda.
                </td>
              </tr>
            )}
            {logs.map((l) => (
              <tr key={l.id} className="border-t border-neutral-100 align-top">
                <td className="px-4 py-2 whitespace-nowrap text-neutral-500">
                  {new Date(l.createdAt).toLocaleString("pt-BR")}
                </td>
                <td className="px-4 py-2">{l.direction === "out" ? "Enviada" : "Recebida"}</td>
                <td className="px-4 py-2">{l.contact.name ?? l.contact.phone}</td>
                <td className="px-4 py-2 text-neutral-500">{l.number?.label ?? "—"}</td>
                <td className="px-4 py-2 max-w-xs truncate" title={l.body}>
                  {l.body}
                </td>
                <td className="px-4 py-2">{STATUS_LABEL[l.status] ?? l.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
