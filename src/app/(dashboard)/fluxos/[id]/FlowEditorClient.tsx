"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

type StepType = "send" | "delay_branch" | "ai_offer" | "ai_reply" | "end";
type NumberStrategy = "same" | "specific" | "rotate";

interface FlowStepRow {
  id: string;
  type: StepType;
  position: number;
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

function stepLabel(step: FlowStepRow): string {
  const n = step.position + 1;
  if (step.type === "send") return `${n}. Enviar "${step.templateKey ?? "?"}"`;
  if (step.type === "delay_branch") return `${n}. Esperar resposta (${step.thresholdMinutes ?? "?"} min)`;
  if (step.type === "ai_offer") return `${n}. Oferta IA`;
  if (step.type === "ai_reply") return `${n}. Conversa aberta com IA`;
  return `${n}. Fim (${step.endLabel ?? "sem rótulo"})`;
}

export default function FlowEditorClient({ flowId }: { flowId: string }) {
  const [flow, setFlow] = useState<FlowDetail | null>(null);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [numbers, setNumbers] = useState<NumberRow[]>([]);
  const [newType, setNewType] = useState<StepType>("send");
  const [saving, setSaving] = useState<string | null>(null);

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

  async function addStep() {
    await fetch(`/api/flows/${flowId}/steps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: newType }),
    });
    load();
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

      {flow.steps.map((step) => (
        <div key={step.id} className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-neutral-700">
              {stepLabel(step)} <span className="text-neutral-400">({TYPE_LABEL[step.type]})</span>
            </p>
            <button onClick={() => deleteStep(step.id)} className="text-sm text-red-600 hover:underline">
              Remover
            </button>
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

      <div className="flex items-end gap-2 rounded-lg border border-dashed border-neutral-300 bg-white p-4">
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
