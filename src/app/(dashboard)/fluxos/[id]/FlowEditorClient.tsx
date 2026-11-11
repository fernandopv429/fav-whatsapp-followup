"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";

type StepType = "send" | "delay_branch" | "ai_offer" | "ai_reply" | "end";
type NumberStrategy = "same" | "specific" | "rotate";

interface FlowStepRow {
  id: string;
  type: StepType;
  position: number;
  label: string | null;
  templateKey: string | null;
  numberStrategy: NumberStrategy | null;
  numberId: string | null;
  nextStepId: string | null;
  thresholdMinutes: number | null;
  onReplyGotoStepId: string | null;
  onReplySendTemplateKey: string | null;
  onTimeoutGotoStepId: string | null;
  endLabel: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
  sendWindowStart: number | null;
  sendWindowEnd: number | null;
}

interface FlowDetail {
  id: string;
  name: string;
  sendWindowStart: number | null;
  sendWindowEnd: number | null;
  steps: FlowStepRow[];
}

interface TemplateRow {
  key: string;
}

interface NumberRow {
  id: string;
  label: string;
}

const TYPE_LABEL: Record<StepType, string> = {
  send: "Enviar mensagem",
  delay_branch: "Esperar resposta",
  ai_offer: "Oferta por IA",
  ai_reply: "Conversa aberta com IA",
  end: "Fim",
};

function autoTitle(step: FlowStepRow): string {
  if (step.type === "send") return `Enviar "${step.templateKey ?? "?"}"`;
  if (step.type === "delay_branch") return `Esperar resposta (${step.thresholdMinutes ?? "?"} min)`;
  if (step.type === "ai_offer") return "Oferta IA";
  if (step.type === "ai_reply") return "Conversa aberta com IA";
  return `Fim (${step.endLabel ?? "sem rótulo"})`;
}

function stepTitle(step: FlowStepRow): string {
  return step.label?.trim() || autoTitle(step);
}

function stepLabel(step: FlowStepRow): string {
  return `${step.position + 1}. ${stepTitle(step)}`;
}

export default function FlowEditorClient({ flowId }: { flowId: string }) {
  const [flow, setFlow] = useState<FlowDetail | null>(null);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [numbers, setNumbers] = useState<NumberRow[]>([]);
  const [newType, setNewType] = useState<StepType>("send");
  const [saving, setSaving] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/flows/${flowId}`);
    if (res.ok) setFlow(await res.json());
  }, [flowId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount é intencional aqui
    load();
    fetch("/api/templates")
      .then((r) => r.json())
      .then(setTemplates);
    fetch("/api/numeros")
      .then((r) => r.json())
      .then(setNumbers);
  }, [load]);

  function focusStep(stepId: string) {
    const el = document.getElementById(`step-${stepId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightId(stepId);
    setTimeout(() => setHighlightId((cur) => (cur === stepId ? null : cur)), 1600);
  }

  async function addStep() {
    const res = await fetch(`/api/flows/${flowId}/steps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: newType }),
    });
    await load();
    if (res.ok) {
      const created = await res.json();
      focusStep(created.id);
    }
  }

  async function duplicateStep(step: FlowStepRow) {
    const res = await fetch(`/api/flows/${flowId}/steps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: step.type,
        label: step.label ? `${step.label} (cópia)` : null,
        templateKey: step.templateKey,
        numberStrategy: step.numberStrategy,
        numberId: step.numberId,
        thresholdMinutes: step.thresholdMinutes,
        onReplySendTemplateKey: step.onReplySendTemplateKey,
        endLabel: step.endLabel,
        mediaUrl: step.mediaUrl,
        mediaType: step.mediaType,
        sendWindowStart: step.sendWindowStart,
        sendWindowEnd: step.sendWindowEnd,
      }),
    });
    await load();
    if (res.ok) {
      const created = await res.json();
      focusStep(created.id);
    }
  }

  async function moveStep(step: FlowStepRow, direction: "up" | "down") {
    if (!flow) return;
    const ordered = [...flow.steps].sort((a, b) => a.position - b.position);
    const idx = ordered.findIndex((s) => s.id === step.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= ordered.length) return;
    const other = ordered[swapIdx];
    setSaving(step.id);
    try {
      await Promise.all([
        fetch(`/api/flows/${flowId}/steps/${step.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ position: other.position }),
        }),
        fetch(`/api/flows/${flowId}/steps/${other.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ position: step.position }),
        }),
      ]);
      await load();
    } finally {
      setSaving(null);
    }
  }

  async function updateFlowWindow(patch: { sendWindowStart?: number | null; sendWindowEnd?: number | null }) {
    await fetch(`/api/flows/${flowId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    load();
  }

  async function updateStep(stepId: string, patch: Partial<FlowStepRow>) {
    setSaving(stepId);
    try {
      await fetch(`/api/flows/${flowId}/steps/${stepId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      await load();
    } finally {
      setSaving(null);
    }
  }

  async function deleteStep(stepId: string) {
    if (!confirm("Remover esse passo? Outros passos que apontam pra ele vão precisar ser ajustados.")) return;
    await fetch(`/api/flows/${flowId}/steps/${stepId}`, { method: "DELETE" });
    load();
  }

  if (!flow) return <p className="text-sm text-neutral-400">Carregando...</p>;

  const otherSteps = (currentId: string) => flow.steps.filter((s) => s.id !== currentId);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/fluxos" className="text-sm text-blue-600 hover:underline">
          ← Fluxos
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-neutral-900">{flow.name}</h1>
      </div>

      {flow.steps.length > 0 && <FlowDiagram steps={flow.steps} onSelect={focusStep} />}

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 bg-white p-4">
        <div className="space-y-1">
          <label className="text-xs text-neutral-600">Janela de envio — início (hora, 0-23)</label>
          <input
            type="number"
            min={0}
            max={23}
            defaultValue={flow.sendWindowStart ?? ""}
            placeholder="padrão global"
            onBlur={(e) =>
              updateFlowWindow({ sendWindowStart: e.target.value === "" ? null : Number(e.target.value) })
            }
            className="w-36 rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-neutral-600">Janela de envio — fim (hora, 0-23)</label>
          <input
            type="number"
            min={0}
            max={23}
            defaultValue={flow.sendWindowEnd ?? ""}
            placeholder="padrão global"
            onBlur={(e) =>
              updateFlowWindow({ sendWindowEnd: e.target.value === "" ? null : Number(e.target.value) })
            }
            className="w-36 rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>
        <p className="text-xs text-neutral-400">Deixe em branco pra usar a janela padrão de Configurações.</p>
      </div>

      {flow.steps.length === 0 && (
        <p className="text-sm text-neutral-400">Nenhum passo ainda — adicione o primeiro abaixo.</p>
      )}

      {flow.steps.map((step, idx) => (
        <div
          key={step.id}
          id={`step-${step.id}`}
          className={`space-y-3 rounded-lg border bg-white p-4 transition-shadow ${
            highlightId === step.id
              ? "border-blue-400 ring-2 ring-blue-200"
              : "border-neutral-200"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-neutral-700">
              {stepLabel(step)} <span className="text-neutral-400">({TYPE_LABEL[step.type]})</span>
            </p>
            <div className="flex items-center gap-3 text-sm">
              <button
                onClick={() => moveStep(step, "up")}
                disabled={idx === 0}
                title="Mover pra cima na lista"
                className="text-neutral-500 hover:underline disabled:opacity-30"
              >
                ↑
              </button>
              <button
                onClick={() => moveStep(step, "down")}
                disabled={idx === flow.steps.length - 1}
                title="Mover pra baixo na lista"
                className="text-neutral-500 hover:underline disabled:opacity-30"
              >
                ↓
              </button>
              <button onClick={() => duplicateStep(step)} className="text-neutral-600 hover:underline">
                Duplicar
              </button>
              <button onClick={() => deleteStep(step.id)} className="text-red-600 hover:underline">
                Remover
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-neutral-600">Nome do passo (opcional, só pra identificar aqui)</label>
            <input
              defaultValue={step.label ?? ""}
              placeholder={autoTitle(step)}
              onBlur={(e) => updateStep(step.id, { label: e.target.value || null })}
              className="w-full rounded border border-neutral-300 px-3 py-1.5 text-sm"
            />
          </div>

          {(step.type === "send" || step.type === "ai_offer") && (
            <>
              <div className="space-y-1">
                <label className="text-xs text-neutral-600">
                  {step.type === "ai_offer" ? "Template de instruções pra IA" : "Template da mensagem"}
                </label>
                <input
                  list="template-keys"
                  defaultValue={step.templateKey ?? ""}
                  onBlur={(e) => updateStep(step.id, { templateKey: e.target.value })}
                  className="w-full rounded border border-neutral-300 px-3 py-1.5 text-sm"
                />
              </div>

              <div className="flex gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-neutral-600">Número</label>
                  <select
                    defaultValue={step.numberStrategy ?? "same"}
                    onChange={(e) => updateStep(step.id, { numberStrategy: e.target.value as NumberStrategy })}
                    className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
                  >
                    <option value="same">Mesmo número já em conversa</option>
                    <option value="specific">Número específico</option>
                    <option value="rotate">Revezar entre números ativos</option>
                  </select>
                </div>
                {step.numberStrategy === "specific" && (
                  <div className="space-y-1">
                    <label className="text-xs text-neutral-600">Qual número</label>
                    <select
                      defaultValue={step.numberId ?? ""}
                      onChange={(e) => updateStep(step.id, { numberId: e.target.value })}
                      className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
                    >
                      <option value="">Escolha...</option>
                      {numbers.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs text-neutral-600">Depois, vai pro passo</label>
                <select
                  defaultValue={step.nextStepId ?? ""}
                  onChange={(e) => updateStep(step.id, { nextStepId: e.target.value })}
                  className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
                >
                  <option value="">Nenhum (encerra aqui)</option>
                  {otherSteps(step.id).map((s) => (
                    <option key={s.id} value={s.id}>
                      {stepLabel(s)}
                    </option>
                  ))}
                </select>
              </div>

              <MediaFields step={step} onChange={(patch) => updateStep(step.id, patch)} />
              <StepWindowFields step={step} onChange={(patch) => updateStep(step.id, patch)} />
            </>
          )}

          {step.type === "ai_reply" && (
            <>
              <div className="space-y-1">
                <label className="text-xs text-neutral-600">
                  Template com as instruções do prompt (como a IA deve conversar nesse nicho)
                </label>
                <input
                  list="template-keys"
                  defaultValue={step.templateKey ?? ""}
                  onBlur={(e) => updateStep(step.id, { templateKey: e.target.value })}
                  className="w-full rounded border border-neutral-300 px-3 py-1.5 text-sm"
                />
              </div>
              <p className="text-xs text-neutral-400">
                Conversa aberta: a IA responde toda mensagem nova do lead usando essas instruções,
                sem sair desse passo — não há &quot;próximo passo&quot; porque a conversa não tem fim definido.
              </p>

              <MediaFields step={step} onChange={(patch) => updateStep(step.id, patch)} />
            </>
          )}

          {step.type === "delay_branch" && (
            <>
              <div className="space-y-1">
                <label className="text-xs text-neutral-600">Esperar até (minutos)</label>
                <input
                  type="number"
                  defaultValue={step.thresholdMinutes ?? 60}
                  onBlur={(e) => updateStep(step.id, { thresholdMinutes: Number(e.target.value) })}
                  className="w-32 rounded border border-neutral-300 px-2 py-1.5 text-sm"
                />
              </div>

              <div className="rounded border border-neutral-100 bg-neutral-50 p-3 space-y-2">
                <p className="text-xs font-medium text-neutral-600">Se responder a tempo</p>
                <div className="flex flex-wrap gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-neutral-600">Manda esse template antes (opcional)</label>
                    <input
                      list="template-keys"
                      defaultValue={step.onReplySendTemplateKey ?? ""}
                      onBlur={(e) => updateStep(step.id, { onReplySendTemplateKey: e.target.value })}
                      className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-neutral-600">E vai pro passo</label>
                    <select
                      defaultValue={step.onReplyGotoStepId ?? ""}
                      onChange={(e) => updateStep(step.id, { onReplyGotoStepId: e.target.value })}
                      className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
                    >
                      <option value="">Nenhum (encerra aqui)</option>
                      {otherSteps(step.id).map((s) => (
                        <option key={s.id} value={s.id}>
                          {stepLabel(s)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="rounded border border-neutral-100 bg-neutral-50 p-3 space-y-2">
                <p className="text-xs font-medium text-neutral-600">Se não responder a tempo</p>
                <div className="space-y-1">
                  <label className="text-xs text-neutral-600">Vai pro passo</label>
                  <select
                    defaultValue={step.onTimeoutGotoStepId ?? ""}
                    onChange={(e) => updateStep(step.id, { onTimeoutGotoStepId: e.target.value })}
                    className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
                  >
                    <option value="">Nenhum (encerra aqui)</option>
                    {otherSteps(step.id).map((s) => (
                      <option key={s.id} value={s.id}>
                        {stepLabel(s)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="text-xs text-neutral-400">
                Dica: pra uma resposta que não deve mudar o rumo do fluxo (só mandar uma mensagem extra
                e seguir), aponte os dois desfechos pro mesmo passo.
              </p>
            </>
          )}

          {step.type === "end" && (
            <div className="space-y-1">
              <label className="text-xs text-neutral-600">Rótulo (aparece na tela de Contatos)</label>
              <input
                defaultValue={step.endLabel ?? ""}
                onBlur={(e) => updateStep(step.id, { endLabel: e.target.value })}
                className="w-full rounded border border-neutral-300 px-3 py-1.5 text-sm"
                placeholder="ex: tem_ia, convertido"
              />
            </div>
          )}

          {saving === step.id && <p className="text-xs text-neutral-400">Salvando...</p>}
        </div>
      ))}

      <datalist id="template-keys">
        {templates.map((t) => (
          <option key={t.key} value={t.key} />
        ))}
      </datalist>

      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-neutral-300 bg-white p-4">
        <div className="space-y-1">
          <label className="text-sm text-neutral-600">Tipo do novo passo</label>
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as StepType)}
            className="rounded border border-neutral-300 px-3 py-2 text-sm"
          >
            {Object.entries(TYPE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={addStep}
          className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
        >
          Adicionar passo
        </button>
      </div>
    </div>
  );
}

function MediaFields({
  step,
  onChange,
}: {
  step: FlowStepRow;
  onChange: (patch: Partial<FlowStepRow>) => void;
}) {
  return (
    <div className="rounded border border-neutral-100 bg-neutral-50 p-3 space-y-2">
      <p className="text-xs font-medium text-neutral-600">Anexar imagem ou vídeo (opcional)</p>
      <div className="flex flex-wrap gap-3">
        <div className="space-y-1">
          <label className="text-xs text-neutral-600">Tipo</label>
          <select
            defaultValue={step.mediaType ?? ""}
            onChange={(e) => onChange({ mediaType: e.target.value || null })}
            className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
          >
            <option value="">Sem mídia</option>
            <option value="image">Imagem</option>
            <option value="video">Vídeo</option>
            <option value="document">Documento (PDF)</option>
          </select>
        </div>
        <div className="min-w-[16rem] flex-1 space-y-1">
          <label className="text-xs text-neutral-600">URL da mídia</label>
          <input
            defaultValue={step.mediaUrl ?? ""}
            onBlur={(e) => onChange({ mediaUrl: e.target.value || null })}
            placeholder="https://..."
            className="w-full rounded border border-neutral-300 px-3 py-1.5 text-sm"
          />
        </div>
      </div>
    </div>
  );
}

function StepWindowFields({
  step,
  onChange,
}: {
  step: FlowStepRow;
  onChange: (patch: Partial<FlowStepRow>) => void;
}) {
  return (
    <div className="rounded border border-neutral-100 bg-neutral-50 p-3 space-y-2">
      <p className="text-xs font-medium text-neutral-600">
        Sobrepor a janela de envio do fluxo só pra esse passo (opcional)
      </p>
      <div className="flex flex-wrap gap-3">
        <div className="space-y-1">
          <label className="text-xs text-neutral-600">Início (hora, 0-23)</label>
          <input
            type="number"
            min={0}
            max={23}
            defaultValue={step.sendWindowStart ?? ""}
            placeholder="janela do fluxo"
            onBlur={(e) =>
              onChange({ sendWindowStart: e.target.value === "" ? null : Number(e.target.value) })
            }
            className="w-36 rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-neutral-600">Fim (hora, 0-23)</label>
          <input
            type="number"
            min={0}
            max={23}
            defaultValue={step.sendWindowEnd ?? ""}
            placeholder="janela do fluxo"
            onBlur={(e) =>
              onChange({ sendWindowEnd: e.target.value === "" ? null : Number(e.target.value) })
            }
            className="w-36 rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>
      </div>
    </div>
  );
}

// ---- Diagrama visual do caminho do fluxo ----

type EdgeKind = "next" | "reply" | "timeout";
interface DiagramEdge {
  from: string;
  to: string;
  kind: EdgeKind;
}

const NODE_W = 184;
const NODE_H = 58;
const COL_GAP = 104;
const ROW_GAP = 20;
const MARGIN = 20;

const TYPE_COLORS: Record<StepType, { border: string; bg: string; dot: string }> = {
  send: { border: "#1d4ed8", bg: "#eff6ff", dot: "#1d4ed8" },
  ai_offer: { border: "#7c3aed", bg: "#f5f3ff", dot: "#7c3aed" },
  ai_reply: { border: "#0d9488", bg: "#f0fdfa", dot: "#0d9488" },
  delay_branch: { border: "#b45309", bg: "#fffbeb", dot: "#b45309" },
  end: { border: "#525252", bg: "#f5f5f5", dot: "#525252" },
};

const EDGE_COLORS: Record<EdgeKind, string> = {
  next: "#737373",
  reply: "#16a34a",
  timeout: "#b45309",
};

function buildEdges(steps: FlowStepRow[]): DiagramEdge[] {
  const edges: DiagramEdge[] = [];
  for (const s of steps) {
    if ((s.type === "send" || s.type === "ai_offer") && s.nextStepId) {
      edges.push({ from: s.id, to: s.nextStepId, kind: "next" });
    }
    if (s.type === "delay_branch") {
      if (s.onReplyGotoStepId) edges.push({ from: s.id, to: s.onReplyGotoStepId, kind: "reply" });
      if (s.onTimeoutGotoStepId) edges.push({ from: s.id, to: s.onTimeoutGotoStepId, kind: "timeout" });
    }
  }
  return edges;
}

function FlowDiagram({
  steps,
  onSelect,
}: {
  steps: FlowStepRow[];
  onSelect: (stepId: string) => void;
}) {
  const layout = useMemo(() => {
    const edges = buildEdges(steps);
    const byId = new Map(steps.map((s) => [s.id, s]));
    const entry = steps.find((s) => s.position === 0) ?? steps[0];

    const layerOf = new Map<string, number>();
    if (entry) {
      layerOf.set(entry.id, 0);
      const queue = [entry.id];
      while (queue.length) {
        const cur = queue.shift()!;
        const curLayer = layerOf.get(cur)!;
        for (const e of edges) {
          if (e.from === cur && byId.has(e.to) && !layerOf.has(e.to)) {
            layerOf.set(e.to, curLayer + 1);
            queue.push(e.to);
          }
        }
      }
    }
    const reachedMax = Math.max(0, ...Array.from(layerOf.values()));
    const orphanIds = new Set<string>();
    for (const s of steps) {
      if (!layerOf.has(s.id)) {
        layerOf.set(s.id, reachedMax + 1);
        orphanIds.add(s.id);
      }
    }

    const layers = new Map<number, FlowStepRow[]>();
    for (const s of steps) {
      const l = layerOf.get(s.id)!;
      if (!layers.has(l)) layers.set(l, []);
      layers.get(l)!.push(s);
    }
    const maxLayer = Math.max(...Array.from(layers.keys()));
    const maxRows = Math.max(...Array.from(layers.values()).map((arr) => arr.length));

    const pos = new Map<string, { x: number; y: number }>();
    for (const [l, arr] of layers.entries()) {
      arr.forEach((s, i) => {
        pos.set(s.id, {
          x: MARGIN + l * (NODE_W + COL_GAP),
          y: MARGIN + i * (NODE_H + ROW_GAP),
        });
      });
    }

    const width = MARGIN * 2 + (maxLayer + 1) * NODE_W + maxLayer * COL_GAP;
    const height = MARGIN * 2 + maxRows * NODE_H + (maxRows - 1) * ROW_GAP + 70;

    return { edges, pos, layerOf, orphanIds, width, height };
  }, [steps]);

  const { edges, pos, layerOf, orphanIds, width, height } = layout;

  return (
    <div className="space-y-2 rounded-lg border border-neutral-200 bg-white p-4">
      <p className="text-xs font-medium text-neutral-600">Caminho do fluxo</p>
      <div className="overflow-x-auto">
        <svg width={width} height={height} className="block">
          <defs>
            <marker id="arrow-next" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" fill={EDGE_COLORS.next} />
            </marker>
            <marker id="arrow-reply" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" fill={EDGE_COLORS.reply} />
            </marker>
            <marker id="arrow-timeout" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" fill={EDGE_COLORS.timeout} />
            </marker>
          </defs>

          {edges.map((e, i) => {
            const from = pos.get(e.from);
            const to = pos.get(e.to);
            if (!from || !to) return null;
            const color = EDGE_COLORS[e.kind];
            const marker = `url(#arrow-${e.kind})`;
            const isForward = layerOf.get(e.to)! > layerOf.get(e.from)!;
            const label = e.kind === "reply" ? "respondeu" : e.kind === "timeout" ? "não respondeu" : "";

            if (e.from === e.to) {
              const x = from.x + NODE_W;
              const y = from.y + NODE_H / 2;
              const d = `M ${x},${y - 14} C ${x + 34},${y - 24} ${x + 34},${y + 24} ${x},${y + 14}`;
              return (
                <g key={i}>
                  <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeDasharray="4 3" markerEnd={marker} />
                  {label && (
                    <text x={x + 38} y={y + 3} fontSize={9} fill={color}>
                      {label}
                    </text>
                  )}
                </g>
              );
            }

            if (isForward) {
              const x1 = from.x + NODE_W;
              const y1 = from.y + NODE_H / 2;
              const x2 = to.x;
              const y2 = to.y + NODE_H / 2;
              const midX = (x1 + x2) / 2;
              const d = `M ${x1},${y1} C ${midX},${y1} ${midX},${y2} ${x2},${y2}`;
              const labelX = x1 + (x2 - x1) * 0.5;
              const labelY = (y1 + y2) / 2 - 6;
              return (
                <g key={i}>
                  <path d={d} fill="none" stroke={color} strokeWidth={1.5} markerEnd={marker} />
                  {label && (
                    <text x={labelX} y={labelY} fontSize={9} fill={color} textAnchor="middle">
                      {label}
                    </text>
                  )}
                </g>
              );
            }

            // back edge / mesma camada: contorna por baixo
            const x1 = from.x + NODE_W / 2;
            const y1 = from.y + NODE_H;
            const x2 = to.x + NODE_W / 2;
            const y2 = to.y + NODE_H;
            const sag = Math.max(y1, y2) + 46;
            const d = `M ${x1},${y1} C ${x1},${sag} ${x2},${sag} ${x2},${y2}`;
            return (
              <g key={i}>
                <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeDasharray="4 3" markerEnd={marker} />
                {label && (
                  <text x={(x1 + x2) / 2} y={sag + 11} fontSize={9} fill={color} textAnchor="middle">
                    {label}
                  </text>
                )}
              </g>
            );
          })}

          {steps.map((s) => {
            const p = pos.get(s.id);
            if (!p) return null;
            const colors = TYPE_COLORS[s.type];
            const isOrphan = orphanIds.has(s.id);
            const title = stepTitle(s);
            return (
              <g
                key={s.id}
                transform={`translate(${p.x},${p.y})`}
                onClick={() => onSelect(s.id)}
                className="cursor-pointer"
              >
                <rect
                  width={NODE_W}
                  height={NODE_H}
                  rx={8}
                  fill={colors.bg}
                  stroke={colors.border}
                  strokeWidth={1.5}
                  strokeDasharray={isOrphan ? "4 3" : undefined}
                />
                <circle cx={14} cy={16} r={4} fill={colors.dot} />
                <text x={24} y={20} fontSize={10} fill={colors.border} fontWeight={600}>
                  {s.position + 1}. {TYPE_LABEL[s.type]}
                </text>
                <text x={12} y={38} fontSize={11} fill="#262626">
                  {title.length > 26 ? `${title.slice(0, 25)}…` : title}
                </text>
                {isOrphan && (
                  <text x={12} y={51} fontSize={9} fill="#a3a3a3">
                    não conectado ao início
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-neutral-500">
        {Object.entries(TYPE_LABEL).map(([type, label]) => (
          <span key={type} className="flex items-center gap-1">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: TYPE_COLORS[type as StepType].dot }}
            />
            {label}
          </span>
        ))}
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-full border border-dashed border-neutral-400" />
          não conectado ao passo inicial
        </span>
      </div>
    </div>
  );
}
