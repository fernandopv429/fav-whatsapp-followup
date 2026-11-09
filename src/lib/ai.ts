import Anthropic from "@anthropic-ai/sdk";

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

/** Marcadores que a IA usa pra sinalizar o fim da conversa aberta (ai_reply); ver generateAiReply. */
export const AI_REPLY_QUALIFIED_MARKER = "[[QUALIFICADO]]";
export const AI_REPLY_DISQUALIFIED_MARKER = "[[DESQUALIFICADO]]";

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY não configurado no ambiente.");
  }
  return new Anthropic({ apiKey });
}

/**
 * Gera a mensagem de oferta personalizada pra um contato, usando os dados
 * da empresa que vieram no CSV. `promptInstructions` é o texto escrito pelo
 * usuário na tela de Contatos (o que a IA deve considerar/como deve escrever);
 * a IA devolve só a mensagem final, pronta pra mandar no WhatsApp.
 */
export async function generatePersonalizedOffer(params: {
  promptInstructions: string;
  contactName: string | null;
  niche: string | null;
  companyData: Record<string, unknown> | null;
}): Promise<string> {
  const client = getClient();
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;

  const dadosEmpresa = params.companyData
    ? JSON.stringify(params.companyData, null, 2)
    : "(nenhum dado de empresa disponível para esse contato)";

  const response = await client.messages.create({
    model,
    max_tokens: 400,
    system:
      "Você escreve mensagens de WhatsApp curtas, diretas e personalizadas para prospecção " +
      "comercial B2B. Adapte o tom e os termos ao nicho do lead informado. Responda SOMENTE com o " +
      "texto final da mensagem, sem aspas, sem explicações, sem saudação formal genérica — direto " +
      "o conteúdo que será enviado.",
    messages: [
      {
        role: "user",
        content:
          `Instruções de como personalizar a mensagem:\n${params.promptInstructions}\n\n` +
          `Nicho do lead: ${params.niche ?? "(não informado)"}\n` +
          `Nome do contato: ${params.contactName ?? "(desconhecido)"}\n` +
          `Dados da empresa (JSON vindo da planilha, use o que for relevante):\n${dadosEmpresa}`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Resposta da IA não trouxe texto.");
  }
  return textBlock.text.trim();
}

/**
 * Gera uma resposta de IA conversacional (passo `ai_reply`) — usada quando o
 * lead responde e a conversa fica aberta, com a IA assumindo a partir daí.
 * `history` é o histórico recente (mais antiga primeiro), a última entrada
 * sendo a mensagem que o lead acabou de mandar.
 */
export async function generateAiReply(params: {
  promptInstructions: string;
  contactName: string | null;
  niche: string | null;
  companyData: Record<string, unknown> | null;
  history: { direction: "in" | "out"; body: string }[];
}): Promise<string> {
  const client = getClient();
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;

  const dadosEmpresa = params.companyData
    ? JSON.stringify(params.companyData, null, 2)
    : "(nenhum dado de empresa disponível para esse contato)";

  const messages = params.history.map((h) => ({
    role: h.direction === "in" ? ("user" as const) : ("assistant" as const),
    content: h.body,
  }));

  const response = await client.messages.create({
    model,
    max_tokens: 400,
    system:
      "Você é um atendente de WhatsApp conversando em nome de uma empresa, seguindo as instruções " +
      `abaixo pro nicho "${params.niche ?? "geral"}". Responda de forma natural, curta, como ` +
      "alguém digitando no WhatsApp — não como um e-mail. Responda SOMENTE com o texto da mensagem, " +
      "sem aspas, sem meta-comentário. Quando a resposta precisar de mais de uma frase curta, " +
      "quebre em 2 a 4 mensagens separadas por uma linha em branco (duas quebras de linha), como " +
      "alguém mandando várias mensagens seguidas no WhatsApp em vez de um texto corrido só. Não " +
      "numere nem use marcadores nas mensagens.\n\n" +
      "Quando a conversa chegar numa conclusão natural, adicione UM dos marcadores abaixo sozinho " +
      `numa linha extra no final da sua resposta (depois da última mensagem): "${AI_REPLY_QUALIFIED_MARKER}" ` +
      "se o lead confirmou interesse real (ex: topou agendar a reunião/conversa) ou " +
      `"${AI_REPLY_DISQUALIFIED_MARKER}" se o lead deixou claro que não tem interesse ou não é o ` +
      "público certo. Na grande maioria das respostas a conversa ainda está em andamento — NÃO " +
      "inclua marcador nenhum nesses casos, só continue a conversa normalmente.\n\n" +
      `Instruções: ${params.promptInstructions}\n\n` +
      `Nome do contato: ${params.contactName ?? "(desconhecido)"}\n` +
      `Dados da empresa (JSON, use o que for relevante):\n${dadosEmpresa}`,
    messages: messages.length > 0 ? messages : [{ role: "user", content: "(sem mensagem anterior)" }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Resposta da IA não trouxe texto.");
  }
  return textBlock.text.trim();
}
