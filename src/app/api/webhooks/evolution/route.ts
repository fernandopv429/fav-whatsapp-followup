import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizePhoneBR } from "@/lib/phone";
import { generateAiReply, AI_REPLY_QUALIFIED_MARKER, AI_REPLY_DISQUALIFIED_MARKER } from "@/lib/ai";

interface EvolutionWebhookBody {
  event?: string;
  instance?: string;
  data?: {
    key?: { remoteJid?: string; fromMe?: boolean; id?: string };
    message?: {
      conversation?: string;
      extendedTextMessage?: { text?: string };
    };
  };
}

function extractText(data: EvolutionWebhookBody["data"]): string {
  return (
    data?.message?.conversation ?? data?.message?.extendedTextMessage?.text ?? "[mensagem sem texto]"
  );
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as EvolutionWebhookBody | null;
  if (!body) return NextResponse.json({ ok: true });

  const event = (body.event ?? "").toUpperCase().replace(/\./g, "_");
  if (event !== "MESSAGES_UPSERT") {
    return NextResponse.json({ ok: true });
  }

  const remoteJid = body.data?.key?.remoteJid ?? "";
  const fromMe = body.data?.key?.fromMe ?? true;
  if (fromMe || remoteJid.endsWith("@g.us") || !remoteJid.includes("@")) {
    return NextResponse.json({ ok: true });
  }

  const phone = normalizePhoneBR(remoteJid.split("@")[0]);
  if (!phone) return NextResponse.json({ ok: true });

  const contact = await prisma.contact.findUnique({ where: { phone } });
  if (!contact) return NextResponse.json({ ok: true });

  const text = extractText(body.data);
  const now = new Date();

  await prisma.messageLog.create({
    data: { contactId: contact.id, direction: "in", body: text, status: "delivered" },
  });

  if (!contact.firstReplyAt) {
    await prisma.contact.update({ where: { id: contact.id }, data: { firstReplyAt: now } });
  }

  if (!contact.currentStepId) return NextResponse.json({ ok: true }); // fluxo já encerrado, só loga

  const step = await prisma.flowStep.findUnique({ where: { id: contact.currentStepId } });
  if (!step) return NextResponse.json({ ok: true });

  if (step.type === "ai_reply") {
    // Pausa manual: o usuário assumiu a conversa pela tela de Contatos — a IA
    // fica muda pra esse contato até ele reativar.
    if (contact.aiPaused) return NextResponse.json({ ok: true });

    // Conversa aberta: cada mensagem recebida gera uma resposta da IA, sem
    // nunca avançar currentStepId — o passo permanece ativo indefinidamente,
    // a não ser que a própria IA sinalize o fim (ver marcadores abaixo).
    const promptTemplate = step.templateKey
      ? await prisma.messageTemplate.findUnique({ where: { key: step.templateKey } })
      : null;
    if (!promptTemplate?.bodyText.trim()) return NextResponse.json({ ok: true });

    const recentLogs = await prisma.messageLog.findMany({
      where: { contactId: contact.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    const history = recentLogs
      .slice()
      .reverse()
      .map((l) => ({ direction: l.direction, body: l.body }));

    // A mídia do passo (ex: um PDF de material) só vai junto na primeira resposta
    // da IA depois de entrar nesse passo — nas seguintes, só texto.
    const jaRespondeuNessePasso = await prisma.messageLog.count({
      where: {
        contactId: contact.id,
        direction: "out",
        templateKey: step.templateKey,
        createdAt: { gte: contact.stepEnteredAt ?? now },
      },
    });
    const isPrimeiraResposta = jaRespondeuNessePasso === 0;

    try {
      const rawReply = await generateAiReply({
        promptInstructions: promptTemplate.bodyText,
        contactName: contact.name,
        niche: contact.niche,
        companyData: (contact.companyData as Record<string, unknown> | null) ?? null,
        history,
      });

      // A IA sinaliza o fim da conversa aberta com um marcador oculto no fim
      // da resposta — detecta, remove da mensagem que vai ser enviada, e
      // tira o contato do piloto automático.
      let endLabel: string | null = null;
      if (rawReply.includes(AI_REPLY_QUALIFIED_MARKER)) endLabel = "qualificado";
      else if (rawReply.includes(AI_REPLY_DISQUALIFIED_MARKER)) endLabel = "desqualificado";
      const replyBody = rawReply
        .replaceAll(AI_REPLY_QUALIFIED_MARKER, "")
        .replaceAll(AI_REPLY_DISQUALIFIED_MARKER, "")
        .trim();

      // A IA é instruída a quebrar respostas longas em várias mensagens
      // separadas por linha em branco, pra simular alguém digitando várias
      // mensagens seguidas em vez de mandar um bloco único de texto.
      const chunks = replyBody
        .split(/\n\s*\n/)
        .map((c) => c.trim())
        .filter(Boolean);
      if (chunks.length === 0) chunks.push(replyBody.trim());

      for (let i = 0; i < chunks.length; i++) {
        const attachMedia = i === 0 && isPrimeiraResposta;
        await prisma.messageLog.create({
          data: {
            contactId: contact.id,
            numberId: contact.assignedNumberId,
            direction: "out",
            templateKey: step.templateKey,
            body: chunks[i],
            mediaUrl: attachMedia ? (step.mediaUrl ?? undefined) : undefined,
            mediaType: attachMedia ? (step.mediaType ?? undefined) : undefined,
            status: "queued",
          },
        });
      }

      if (endLabel) {
        await prisma.contact.update({
          where: { id: contact.id },
          data: { currentStepId: null, currentFlowId: null, stageLabel: endLabel },
        });
      }
    } catch (err) {
      console.error(`Falha ao gerar resposta de IA (passo ${step.id}) pro contato ${contact.id}:`, err);
    }

    return NextResponse.json({ ok: true });
  }

  if (step.type !== "delay_branch") return NextResponse.json({ ok: true }); // não está esperando resposta agora

  const sendTemplate = step.onReplySendTemplateKey
    ? await prisma.messageTemplate.findUnique({ where: { key: step.onReplySendTemplateKey } })
    : null;

  // Condição no where evita processar duas vezes a mesma transição se duas
  // mensagens do mesmo contato chegarem quase juntas (updateMany só afeta
  // quem ainda estiver nesse passo exato).
  const { count } = await prisma.contact.updateMany({
    where: { id: contact.id, currentStepId: step.id },
    data: step.onReplyGotoStepId
      ? { currentStepId: step.onReplyGotoStepId, stepEnteredAt: now }
      : {},
  });

  if (count > 0 && sendTemplate?.bodyText.trim()) {
    await prisma.messageLog.create({
      data: {
        contactId: contact.id,
        numberId: contact.assignedNumberId,
        direction: "out",
        templateKey: step.onReplySendTemplateKey,
        body: sendTemplate.bodyText,
        status: "queued",
      },
    });
  }

  return NextResponse.json({ ok: true });
}
