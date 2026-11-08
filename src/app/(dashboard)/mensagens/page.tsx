"use client";

import { useEffect, useMemo, useState } from "react";

interface TemplateRow {
  key: string;
  bodyText: string;
}

interface Slot {
  key: string;
  label: string;
  hint: string;
  rows: number;
}

interface NumberRow {
  id: string;
  status: "warming_up" | "active" | "paused" | "banned";
}

export default function MensagensPage() {
  const [dripTotalDays, setDripTotalDays] = useState<number | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/numeros")
      .then((r) => r.json())
      .then((numbers: NumberRow[]) => {
        const ativos = numbers.filter((n) => n.status === "active" || n.status === "warming_up");
        setDripTotalDays(ativos.length);
      });
    fetch("/api/templates")
      .then((r) => r.json())
      .then((templates: TemplateRow[]) => {
        const map: Record<string, string> = {};
        for (const t of templates) map[t.key] = t.bodyText;
        setValues(map);
      });
  }, []);

  const slots: Slot[] = useMemo(() => {
    const base: Slot[] = [
      {
        key: "inicial",
        label: "Mensagem inicial (Msg1)",
        hint: "Primeiro contato — serve pra testar se o lead tem um agente de IA no WhatsApp. Use {{nome}} se quiser.",
        rows: 4,
      },
      {
        key: "verificacao",
        label: "Mensagem de verificação (Msg2)",
        hint: "Só é enviada se a Msg1 for respondida rápido demais (ambíguo entre auto-resposta e IA de verdade) — confirma se é mesmo um agente de IA.",
        rows: 4,
      },
    ];

    if (dripTotalDays) {
      for (let day = 1; day <= dripTotalDays; day++) {
        base.push({
          key: `drip_dia_${day}`,
          label: `Simulação de cliente perdido — dia ${day}`,
          hint: `Enviada automaticamente pelo número ${day} (na ordem definida em Números), pros contatos marcados como 'não tem IA'.`,
          rows: 3,
        });
      }
    }

    base.push({
      key: "drip_resposta_ocupado",
      label: "Resposta durante a simulação (genérica)",
      hint: "Disparada quando o contato responde durante a sequência de cliente perdido — reforça a simulação (ex: 'já marquei com outro'). Pode criar uma versão específica por dia com a chave drip_dia_N_resposta direto na API, se quiser.",
      rows: 3,
    });

    base.push({
      key: "oferta",
      label: "Instruções da IA para a oferta final",
      hint: "Não é a mensagem pronta — são instruções pra a IA (Claude) escrever a oferta personalizada, usando os dados da empresa do CSV. Disparada automaticamente ao fim da sequência, ou manualmente pelo botão em Contatos.",
      rows: 5,
    });

    return base;
  }, [dripTotalDays]);

  async function save(key: string) {
    setSaving(key);
    try {
      await fetch(`/api/templates/${key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bodyText: values[key] ?? "" }),
      });
      setDirty((d) => ({ ...d, [key]: false }));
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-lg font-semibold text-neutral-900">Mensagens</h1>
      <p className="text-sm text-neutral-500">
        Todos os textos usados pelo funil: a mensagem inicial, a verificação de IA, a sequência de
        simulação de cliente perdido e a oferta final.
      </p>
      <p className="text-sm text-neutral-500">
        A quantidade de dias da simulação abaixo ({dripTotalDays ?? "..."}) é igual à quantidade de
        números ativos agora — conecte mais números em <strong>Números</strong> pra ter mais dias.
      </p>

      {slots.map((slot) => (
        <div key={slot.key} className="space-y-2 rounded-lg border border-neutral-200 bg-white p-4">
          <label className="text-sm font-medium text-neutral-700">{slot.label}</label>
          <p className="text-xs text-neutral-400">{slot.hint}</p>
          <textarea
            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
            rows={slot.rows}
            value={values[slot.key] ?? ""}
            onChange={(e) => {
              setValues((v) => ({ ...v, [slot.key]: e.target.value }));
              setDirty((d) => ({ ...d, [slot.key]: true }));
            }}
          />
          <button
            onClick={() => save(slot.key)}
            disabled={!dirty[slot.key] || saving === slot.key}
            className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving === slot.key ? "Salvando..." : dirty[slot.key] ? "Salvar" : "Salvo"}
          </button>
        </div>
      ))}
    </div>
  );
}
