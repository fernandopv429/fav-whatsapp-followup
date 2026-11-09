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
  stageLabel: string | null;
  currentFlow: { name: string } | null;
  currentStep: { type: string } | null;
  companyData: Record<string, unknown> | null;
  createdAt: string;
  aiPaused: boolean;
}

interface Resumo {
  totalGeral: number;
  pendentesGeral: number;
  porNicho: { niche: string | null; total: number; pendentes: number }[];
}

interface FlowRow {
  id: string;
  name: string;
}

export default function ContatosPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [flows, setFlows] = useState<FlowRow[]>([]);
  const [sourceBatch, setSourceBatch] = useState("");
  const [niche, setNiche] = useState("");
  const [leadSource, setLeadSource] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [qualifyingId, setQualifyingId] = useState<string | null>(null);
  const [qualifyError, setQualifyError] = useState<string | null>(null);
  const [togglingAiId, setTogglingAiId] = useState<string | null>(null);
  const [nicheFilter, setNicheFilter] = useState("todos");
  const [iniciarNicho, setIniciarNicho] = useState("todos");
  const [iniciarFlowId, setIniciarFlowId] = useState("");
  const [iniciando, setIniciando] = useState(false);
  const [iniciarResult, setIniciarResult] = useState<string | null>(null);
  const [iniciarError, setIniciarError] = useState<string | null>(null);

  const loadContacts = useCallback(async (niche: string) => {
    const qs = niche === "todos" ? "" : `?niche=${encodeURIComponent(niche)}`;
    const res = await fetch(`/api/contatos${qs}`);
    if (res.ok) setContacts(await res.json());
  }, []);

  const loadResumo = useCallback(async () => {
    const res = await fetch("/api/contatos/resumo");
    if (res.ok) setResumo(await res.json());
  }, []);

  const loadFlows = useCallback(async () => {
    const res = await fetch("/api/flows");
    if (res.ok) {
      const data: FlowRow[] = await res.json();
      setFlows(data);
      setIniciarFlowId((current) => current || data[0]?.id || "");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount é intencional aqui
    loadContacts(nicheFilter);
  }, [loadContacts, nicheFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount é intencional aqui
    loadResumo();
    loadFlows();
  }, [loadResumo, loadFlows]);

  const knownNiches = useMemo(
    () => (resumo?.porNicho.filter((p) => p.niche).map((p) => p.niche as string) ?? []),
    [resumo]
  );
  const knownSources = useMemo(
    () => Array.from(new Set(contacts.map((c) => c.leadSource).filter((v): v is string => Boolean(v)))),
    [contacts]
  );
  const nichosParaIniciar = knownNiches;

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
        `${data.criados} contato(s) adicionado(s) (ainda sem fluxo), ${data.duplicados} já existia(m), ${data.invalidos} inválido(s).`
      );
      setFile(null);
      loadContacts(nicheFilter);
      loadResumo();
    } finally {
      setUploading(false);
    }
  }

  async function handleIniciar() {
    if (!iniciarFlowId) {
      setIniciarError("Crie um fluxo em Fluxos antes de iniciar o disparo.");
      return;
    }
    setIniciando(true);
    setIniciarError(null);
    setIniciarResult(null);
    try {
      const res = await fetch("/api/contatos/iniciar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flowId: iniciarFlowId,
          niche: iniciarNicho === "todos" ? undefined : iniciarNicho,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setIniciarError(data.error ?? "Falha ao iniciar o disparo.");
        return;
      }
      setIniciarResult(`${data.iniciados} contato(s) entraram no fluxo.`);
      loadContacts(nicheFilter);
      loadResumo();
    } finally {
      setIniciando(false);
    }
  }

  async function handleToggleAiPaused(contact: Contact) {
    setTogglingAiId(contact.id);
    try {
      await fetch(`/api/contatos/${contact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiPaused: !contact.aiPaused }),
      });
      setContacts((prev) =>
        prev.map((c) => (c.id === contact.id ? { ...c, aiPaused: !contact.aiPaused } : c))
      );
    } finally {
      setTogglingAiId(null);
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
      loadContacts(nicheFilter);
    } finally {
      setQualifyingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-neutral-900">Contatos</h1>

      <p className="text-sm text-neutral-500">
        Os templates de mensagem ficam em{" "}
        <Link href="/mensagens" className="text-blue-600 hover:underline">
          Mensagens
        </Link>
        , e a sequência de passos de cada fluxo fica em{" "}
        <Link href="/fluxos" className="text-blue-600 hover:underline">
          Fluxos
        </Link>
        .
      </p>

      <form onSubmit={handleUpload} className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4">
        <p className="text-sm font-medium text-neutral-700">Subir lista de contatos (CSV)</p>
        <p className="text-sm text-neutral-500">
          Reconhece tanto exportação do Google Maps (<code>Name</code>/<code>Phone</code>) quanto da Casa
          de Dados (<code>Razao Social</code>/<code>Telefones</code>). Qualquer outra coluna vira dado da
          empresa, disponível pra IA usar na oferta. Subir a lista <strong>não dispara nada</strong> —
          os contatos ficam sem fluxo até você iniciar o disparo deles (abaixo).
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

      <div className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4">
        <p className="text-sm font-medium text-neutral-700">Iniciar disparo</p>
        <p className="text-sm text-neutral-500">
          Escolha o fluxo e, se quiser, um nicho específico (ou todos) pra atribuir esse fluxo só de
          quem ainda não tem nenhum. Pode rodar quantas vezes quiser — nunca reatribui quem já está
          num fluxo.
        </p>

        {resumo && (
          <div className="flex flex-wrap gap-4 text-sm text-neutral-600">
            <span>
              <strong className="text-neutral-900">{resumo.totalGeral}</strong> contatos no total
            </span>
            <span>
              <strong className="text-neutral-900">{resumo.pendentesGeral}</strong> ainda sem fluxo
            </span>
            {resumo.porNicho.map((p) => (
              <span key={p.niche ?? "sem-nicho"}>
                {p.niche ?? "sem nicho"}: <strong className="text-neutral-900">{p.pendentes}</strong>/
                {p.total} pendentes
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <label className="text-sm text-neutral-600">Fluxo</label>
            <select
              value={iniciarFlowId}
              onChange={(e) => setIniciarFlowId(e.target.value)}
              className="rounded border border-neutral-300 px-3 py-2 text-sm"
            >
              {flows.length === 0 && <option value="">Nenhum fluxo criado ainda</option>}
              {flows.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm text-neutral-600">Nicho</label>
            <select
              value={iniciarNicho}
              onChange={(e) => setIniciarNicho(e.target.value)}
              className="rounded border border-neutral-300 px-3 py-2 text-sm"
            >
              <option value="todos">Todos os nichos</option>
              {nichosParaIniciar.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleIniciar}
            disabled={iniciando || !flows.length}
            className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {iniciando ? "Iniciando..." : "Iniciar disparo"}
          </button>
        </div>
        {flows.length === 0 && (
          <p className="text-sm text-amber-600">
            Nenhum fluxo criado ainda —{" "}
            <Link href="/fluxos" className="underline">
              crie um em Fluxos
            </Link>{" "}
            primeiro.
          </p>
        )}
        {iniciarResult && <p className="text-sm text-green-700">{iniciarResult}</p>}
        {iniciarError && <p className="text-sm text-red-600">{iniciarError}</p>}
      </div>

      {qualifyError && <p className="text-sm text-red-600">{qualifyError}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm text-neutral-600">Filtrar lista por nicho:</label>
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
        <span className="text-xs text-neutral-400">(mostra os 200 mais recentes desse filtro)</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full min-w-[840px] text-sm">
          <thead className="bg-neutral-50 text-left text-neutral-500">
            <tr>
              <th className="px-4 py-2">Telefone</th>
              <th className="px-4 py-2">Nome</th>
              <th className="px-4 py-2">Nicho</th>
              <th className="px-4 py-2">Fonte</th>
              <th className="px-4 py-2">Lote</th>
              <th className="px-4 py-2">Fluxo</th>
              <th className="px-4 py-2">Estágio</th>
              <th className="px-4 py-2">IA</th>
              <th className="px-4 py-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {contacts.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-neutral-400">
                  Nenhum contato ainda.
                </td>
              </tr>
            )}
            {contacts.map((c) => (
              <tr key={c.id} className="border-t border-neutral-100">
                <td className="px-4 py-2 whitespace-nowrap">{c.phone}</td>
                <td className="px-4 py-2">{c.name ?? "—"}</td>
                <td className="px-4 py-2 text-neutral-500">{c.niche ?? "—"}</td>
                <td className="px-4 py-2 text-neutral-500">{c.leadSource ?? "—"}</td>
                <td className="px-4 py-2 text-neutral-500">{c.sourceBatch ?? "—"}</td>
                <td className="px-4 py-2 text-neutral-500">{c.currentFlow?.name ?? "—"}</td>
                <td className="px-4 py-2">{c.stageLabel ?? "—"}</td>
                <td className="px-4 py-2">
                  <button
                    onClick={() => handleToggleAiPaused(c)}
                    disabled={togglingAiId === c.id}
                    className={`rounded px-2 py-1 text-xs font-medium disabled:opacity-50 ${
                      c.aiPaused
                        ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                        : "bg-green-100 text-green-800 hover:bg-green-200"
                    }`}
                  >
                    {togglingAiId === c.id ? "..." : c.aiPaused ? "Pausada" : "Ativa"}
                  </button>
                </td>
                <td className="px-4 py-2 whitespace-nowrap">
                  {c.currentStep?.type === "ai_offer" ? (
                    <button
                      onClick={() => handleQualificar(c)}
                      disabled={qualifyingId === c.id}
                      className="text-blue-600 hover:underline disabled:opacity-50"
                      title="Força o envio da oferta desse passo agora, sem esperar a janela/cap"
                    >
                      {qualifyingId === c.id ? "Gerando..." : "Forçar oferta agora"}
                    </button>
                  ) : (
                    <span
                      className="text-neutral-300"
                      title="Só disponível quando o contato está parado num passo de oferta por IA"
                    >
                      —
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
