"use client";

import { useEffect, useState, useCallback } from "react";

interface Contact {
  id: string;
  phone: string;
  name: string | null;
  sourceBatch: string | null;
  stage: string;
  createdAt: string;
}

const STAGE_LABEL: Record<string, string> = {
  novo: "Novo",
  aguardando_resposta: "Aguardando resposta",
  resposta_imediata: "Resposta imediata",
  potencial_cliente: "Potencial cliente",
  em_drip: "Em simulação (drip)",
  convertido: "Convertido",
  perdido: "Perdido",
};

export default function ContatosPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [templateText, setTemplateText] = useState("");
  const [templateSaved, setTemplateSaved] = useState(true);
  const [sourceBatch, setSourceBatch] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const loadContacts = useCallback(async () => {
    const res = await fetch("/api/contatos");
    if (res.ok) setContacts(await res.json());
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount é intencional aqui
    loadContacts();
    fetch("/api/templates/inicial")
      .then((r) => r.json())
      .then((t) => setTemplateText(t?.bodyText ?? ""));
  }, [loadContacts]);

  async function saveTemplate() {
    await fetch("/api/templates/inicial", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bodyText: templateText }),
    });
    setTemplateSaved(true);
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    setUploadResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("sourceBatch", sourceBatch);
      const res = await fetch("/api/contatos/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error ?? "Falha ao subir a lista.");
        return;
      }
      setUploadResult(
        `${data.criados} contato(s) adicionado(s) à fila, ${data.duplicados} já existia(m), ${data.invalidos} inválido(s).`
      );
      setFile(null);
      loadContacts();
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-neutral-900">Contatos</h1>

      <div className="space-y-2 rounded-lg border border-neutral-200 bg-white p-4">
        <label className="text-sm font-medium text-neutral-700">
          Mensagem inicial (disparada pra todo contato novo — use <code>{"{{nome}}"}</code> se quiser personalizar)
        </label>
        <textarea
          className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
          rows={4}
          value={templateText}
          onChange={(e) => {
            setTemplateText(e.target.value);
            setTemplateSaved(false);
          }}
        />
        <button
          onClick={saveTemplate}
          disabled={templateSaved}
          className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {templateSaved ? "Salvo" : "Salvar mensagem"}
        </button>
      </div>

      <form onSubmit={handleUpload} className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4">
        <p className="text-sm font-medium text-neutral-700">Subir lista de contatos (CSV)</p>
        <p className="text-sm text-neutral-500">
          Colunas esperadas: <code>telefone</code> e <code>nome</code> (nome é opcional).
        </p>
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <label className="text-sm text-neutral-600">Nome da campanha/lote (opcional)</label>
            <input
              className="rounded border border-neutral-300 px-3 py-2 text-sm"
              value={sourceBatch}
              onChange={(e) => setSourceBatch(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-neutral-600">Arquivo CSV</label>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={!file || uploading}
            className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {uploading ? "Enviando..." : "Subir lista"}
          </button>
        </div>
        {uploadResult && <p className="text-sm text-green-700">{uploadResult}</p>}
        {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
      </form>

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-neutral-500">
            <tr>
              <th className="px-4 py-2">Telefone</th>
              <th className="px-4 py-2">Nome</th>
              <th className="px-4 py-2">Lote</th>
              <th className="px-4 py-2">Estágio</th>
            </tr>
          </thead>
          <tbody>
            {contacts.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-neutral-400">
                  Nenhum contato ainda.
                </td>
              </tr>
            )}
            {contacts.map((c) => (
              <tr key={c.id} className="border-t border-neutral-100">
                <td className="px-4 py-2">{c.phone}</td>
                <td className="px-4 py-2">{c.name ?? "—"}</td>
                <td className="px-4 py-2 text-neutral-500">{c.sourceBatch ?? "—"}</td>
                <td className="px-4 py-2">{STAGE_LABEL[c.stage] ?? c.stage}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
