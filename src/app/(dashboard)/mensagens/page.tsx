"use client";

import { useEffect, useState } from "react";

interface TemplateRow {
  key: string;
  bodyText: string;
}

export default function MensagensPage() {
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [newKey, setNewKey] = useState("");

  const load = async () => {
    const res = await fetch("/api/templates");
    const data: TemplateRow[] = await res.json();
    setTemplates(data);
    const map: Record<string, string> = {};
    for (const t of data) map[t.key] = t.bodyText;
    setValues(map);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount é intencional aqui
    load();
  }, []);

  async function save(key: string) {
    setSaving(key);
    try {
      await fetch(`/api/templates/${key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bodyText: values[key] ?? "" }),
      });
      setDirty((d) => ({ ...d, [key]: false }));
      load();
    } finally {
      setSaving(null);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const key = newKey.trim();
    if (!key) return;
    setValues((v) => ({ ...v, [key]: "" }));
    await save(key);
    setNewKey("");
  }

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-lg font-semibold text-neutral-900">Mensagens</h1>
      <p className="text-sm text-neutral-500">
        Templates de texto usados pelos fluxos — use <code>{"{{nome}}"}</code> pra personalizar. Pra
        mensagens de oferta por IA, o texto aqui são as instruções pra IA escrever, não a mensagem
        pronta. Cada passo de um fluxo (em <strong>Fluxos</strong>) escolhe qual template usar pela
        chave abaixo.
      </p>

      <form onSubmit={handleCreate} className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-4 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1">
          <label className="text-sm text-neutral-600">Nova chave de template (ex: inicial, oferta, dia3)</label>
          <input
            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
          />
        </div>
        <button
          type="submit"
          disabled={!newKey.trim()}
          className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Criar template
        </button>
      </form>

      {templates.length === 0 && (
        <p className="text-sm text-neutral-400">Nenhum template ainda — crie o primeiro acima.</p>
      )}

      {templates.map((t) => (
        <div key={t.key} className="space-y-2 rounded-lg border border-neutral-200 bg-white p-4">
          <label className="text-sm font-medium text-neutral-700">
            <code>{t.key}</code>
          </label>
          <textarea
            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
            rows={4}
            value={values[t.key] ?? ""}
            onChange={(e) => {
              setValues((v) => ({ ...v, [t.key]: e.target.value }));
              setDirty((d) => ({ ...d, [t.key]: true }));
            }}
          />
          <button
            onClick={() => save(t.key)}
            disabled={!dirty[t.key] || saving === t.key}
            className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving === t.key ? "Salvando..." : dirty[t.key] ? "Salvar" : "Salvo"}
          </button>
        </div>
      ))}
    </div>
  );
}
