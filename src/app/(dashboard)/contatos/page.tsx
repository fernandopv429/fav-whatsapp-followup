"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";

interface Contact {
  id: string;
  phone: string;
  name: string | null;
  sourceBatch: string | null;
  niche: string | null;
  leadSource: string | null;
  stage: string;
  companyData: Record<string, unknown> | null;
  createdAt: string;
}

const STAGE_LABEL: Record<string, string> = {
  novo: "Novo",
  aguardando_msg1: "Aguardando resposta (msg 1)",
  aguardando_msg2: "Verificando IA (msg 2)",
  tem_ia: "Tem IA (fora do funil)",
  em_drip: "Simulação de cliente perdido",
  oferta_enviada: "Oferta enviada",
  convertido: "Convertido",
  perdido: "Perdido",
};

export default function ContatosPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [sourceBatch, setSourceBatch] = useState("");
  const [niche, setNiche] = useState("");
  const [leadSource, setLeadSource] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [qualifyingId, setQualifyingId] = useState<string | null>(null);
  const [qualifyError, setQualifyError] = useState<string | null>(null);
  const [nicheFilter, setNicheFilter] = useState("todos");

  const loadContacts = useCallback(async () => {
    const res = await fetch("/api/contatos");
    if (res.ok) setContacts(await res.json());
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount é intencional aqui
    loadContacts();
  }, [loadContacts]);

  const knownNiches = useMemo(
    () => Array.from(new Set(contacts.map((c) => c.niche).filter((v): v is string => Boolean(v)))),
    [contacts]
  );
  const knownSources = useMemo(
    () => Array.from(new Set(contacts.map((c) => c.leadSource).filter((v): v is string => Boolean(v)))),
    [contacts]
  );
  const visibleContacts = useMemo(
    () => (nicheFilter === "todos" ? contacts : contacts.filter((c) => c.niche === nicheFilter)),
    [contacts, nicheFilter]
  );

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
      form.append("niche", niche);
      form.append("leadSource", leadSource);
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

  async function handleQualificar(contact: Contact) {
    setQualifyingId(contact.id);
    setQualifyError(null);
    try {
      const res = await fetch(`/api/contatos/${contact.id}/qualificar`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setQualifyError(`${contact.name ?? contact.phone}: ${data.error ?? "falha ao gerar oferta"}`);
        return;
      }
      loadContacts();
    } finally {
      setQualifyingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-neutral-900">Contatos</h1>

      <p className="text-sm text-neutral-500">
        A mensagem inicial, a de verificação e as da simulação de cliente perdido ficam em{" "}
        <Link href="/mensagens" className="text-blue-600 hover:underline">
          Mensagens
        </Link>
        .
      </p>

      <form onSubmit={handleUpload} className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4">
        <p className="text-sm font-medium text-neutral-700">Subir lista de contatos (CSV)</p>
        <p className="text-sm text-neutral-500">
          Reconhece tanto exportação do Google Maps (<code>Name</code>/<code>Phone</code>) quanto da Casa
          de Dados (<code>Razao Social</code>/<code>Telefones</code>). Qualquer outra coluna vira dado da
          empresa, disponível pra IA usar na oferta.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <label className="text-sm text-neutral-600">Nicho (ex: advocacia, clinicas)</label>
            <input
              list="niches"
              className="rounded border border-neutral-300 px-3 py-2 text-sm"
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
            />
            <datalist id="niches">
              {knownNiches.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1">
            <label className="text-sm text-neutral-600">Fonte (ex: google_maps, casa_de_dados)</label>
            <input
              list="sources"
              className="rounded border border-neutral-300 px-3 py-2 text-sm"
              value={leadSource}
              onChange={(e) => setLeadSource(e.target.value)}
            />
            <datalist id="sources">
              {knownSources.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
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

      {qualifyError && <p className="text-sm text-red-600">{qualifyError}</p>}

      <div className="flex items-center gap-2">
        <label className="text-sm text-neutral-600">Filtrar por nicho:</label>
        <select
          value={nicheFilter}
          onChange={(e) => setNicheFilter(e.target.value)}
          className="rounded border border-neutral-300 px-2 py-1 text-sm"
        >
          <option value="todos">Todos</option>
          {knownNiches.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-neutral-500">
            <tr>
              <th className="px-4 py-2">Telefone</th>
              <th className="px-4 py-2">Nome</th>
              <th className="px-4 py-2">Nicho</th>
              <th className="px-4 py-2">Fonte</th>
              <th className="px-4 py-2">Lote</th>
              <th className="px-4 py-2">Estágio</th>
              <th className="px-4 py-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {visibleContacts.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-neutral-400">
                  Nenhum contato ainda.
                </td>
              </tr>
            )}
            {visibleContacts.map((c) => (
              <tr key={c.id} className="border-t border-neutral-100">
                <td className="px-4 py-2">{c.phone}</td>
                <td className="px-4 py-2">{c.name ?? "—"}</td>
                <td className="px-4 py-2 text-neutral-500">{c.niche ?? "—"}</td>
                <td className="px-4 py-2 text-neutral-500">{c.leadSource ?? "—"}</td>
                <td className="px-4 py-2 text-neutral-500">{c.sourceBatch ?? "—"}</td>
                <td className="px-4 py-2">{STAGE_LABEL[c.stage] ?? c.stage}</td>
                <td className="px-4 py-2">
                  <button
                    onClick={() => handleQualificar(c)}
                    disabled={qualifyingId === c.id}
                    className="text-blue-600 hover:underline disabled:opacity-50"
                  >
                    {qualifyingId === c.id ? "Gerando..." : "Gerar oferta IA"}
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
