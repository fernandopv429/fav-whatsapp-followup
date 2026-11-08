"use client";

import { useEffect, useState } from "react";

interface SettingsForm {
  msg1ThresholdMinutes: number;
  msg2ThresholdMinutes: number;
  newContactsDailyCap: number;
  sendWindowStart: number;
  sendWindowEnd: number;
  minDelaySeconds: number;
  maxDelaySeconds: number;
  warmupDailyCapStart: number;
  warmupDailyCapMax: number;
  warmupRampDays: number;
}

const FIELDS: { key: keyof SettingsForm; label: string; hint: string }[] = [
  {
    key: "msg1ThresholdMinutes",
    label: "Limiar da mensagem 1 (minutos)",
    hint: "Resposta até esse tempo = pode ter IA (manda a msg de verificação). Sem resposta até esse tempo = já confirma 'não tem IA' e entra na simulação.",
  },
  {
    key: "msg2ThresholdMinutes",
    label: "Limiar da mensagem 2 / verificação (minutos)",
    hint: "Resposta até esse tempo confirma 'tem IA' (sai do funil). Sem resposta até esse tempo confirma 'não tem IA'.",
  },
  {
    key: "newContactsDailyCap",
    label: "Limite diário de contatos novos",
    hint: "Quantos contatos novos (mensagem inicial) no máximo por dia, somando todos os números — independente da capacidade de cada número. Mensagens de verificação, simulação e oferta não entram nesse limite.",
  },
  { key: "sendWindowStart", label: "Início da janela de envio (hora, 0-23)", hint: "" },
  { key: "sendWindowEnd", label: "Fim da janela de envio (hora, 0-23)", hint: "" },
  { key: "minDelaySeconds", label: "Delay mínimo entre envios por número (segundos)", hint: "" },
  { key: "maxDelaySeconds", label: "Delay máximo entre envios por número (segundos)", hint: "" },
  { key: "warmupDailyCapStart", label: "Cap diário inicial de número novo", hint: "" },
  { key: "warmupDailyCapMax", label: "Cap diário máximo após aquecer", hint: "" },
  { key: "warmupRampDays", label: "Dias até atingir o cap máximo", hint: "" },
];

export default function ConfiguracoesPage() {
  const [form, setForm] = useState<SettingsForm | null>(null);
  const [saved, setSaved] = useState(true);

  useEffect(() => {
    fetch("/api/configuracoes")
      .then((r) => r.json())
      .then(setForm);
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    await fetch("/api/configuracoes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaved(true);
  }

  if (!form) return <p className="text-sm text-neutral-400">Carregando...</p>;

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-lg font-semibold text-neutral-900">Configurações</h1>
      <p className="text-sm text-neutral-500">
        A quantidade de dias da simulação de cliente perdido não é configurada aqui — ela é automática,
        igual à quantidade de números ativos (veja Números).
      </p>

      <form onSubmit={handleSave} className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4">
        {FIELDS.map((f) => (
          <div key={f.key} className="space-y-1">
            <label className="text-sm font-medium text-neutral-700">{f.label}</label>
            <input
              type="number"
              value={form[f.key]}
              onChange={(e) => {
                setForm({ ...form, [f.key]: Number(e.target.value) });
                setSaved(false);
              }}
              className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
            />
            {f.hint && <p className="text-xs text-neutral-400">{f.hint}</p>}
          </div>
        ))}

        <button
          type="submit"
          disabled={saved}
          className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {saved ? "Salvo" : "Salvar configurações"}
        </button>
      </form>
    </div>
  );
}
