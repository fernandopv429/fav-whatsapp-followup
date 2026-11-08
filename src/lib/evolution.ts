/**
 * Cliente para a Evolution API (v2.3.7) já rodando na VPS.
 * Endpoints confirmados contra a documentação pública do Evolution Foundation;
 * `sendText` foi validado com um envio real antes de ser usado em produção.
 */

const BASE_URL = process.env.EVOLUTION_API_URL ?? "";
const GLOBAL_API_KEY = process.env.EVOLUTION_API_KEY ?? "";

function assertConfigured() {
  if (!BASE_URL || !GLOBAL_API_KEY) {
    throw new Error(
      "EVOLUTION_API_URL / EVOLUTION_API_KEY não configurados no ambiente."
    );
  }
}

async function request<T>(
  path: string,
  opts: { method?: string; apiKey?: string; body?: unknown } = {}
): Promise<T> {
  assertConfigured();
  const res = await fetch(`${BASE_URL}${path}`, {
    method: opts.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      apikey: opts.apiKey ?? GLOBAL_API_KEY,
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  });

  const text = await res.text();
  let json: unknown = undefined;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    // resposta não é JSON (raro, mas não deve quebrar o caller)
  }

  if (!res.ok) {
    throw new Error(
      `Evolution API ${opts.method ?? "GET"} ${path} -> ${res.status}: ${text}`
    );
  }
  return json as T;
}

export interface EvolutionInstanceCreateResult {
  instance: { instanceName: string; instanceId: string; status: string };
  hash?: { apikey: string } | string;
  qrcode?: { base64: string; code: string };
}

/** Cria uma nova instance (número) na Evolution API, já com QR code. */
export async function createInstance(instanceName: string) {
  return request<EvolutionInstanceCreateResult>("/instance/create", {
    method: "POST",
    body: {
      instanceName,
      qrcode: true,
      integration: "WHATSAPP-BAILEYS",
    },
  });
}

/** Configura o webhook de uma instance já criada (resposta via Fluxo 2 do plano). */
export async function setWebhook(instanceName: string, webhookUrl: string, apiKey?: string) {
  return request(`/webhook/set/${instanceName}`, {
    method: "POST",
    apiKey,
    body: {
      enabled: true,
      url: webhookUrl,
      webhookByEvents: false,
      webhookBase64: false,
      events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"],
    },
  });
}

export interface EvolutionConnectResult {
  base64?: string;
  code?: string;
  pairingCode?: string;
}

/** Busca (ou gera de novo) o QR code pra conectar uma instance ainda não logada. */
export async function connectInstance(instanceName: string) {
  return request<EvolutionConnectResult>(`/instance/connect/${instanceName}`);
}

export interface EvolutionInstanceInfo {
  name: string;
  connectionStatus: string;
  ownerJid?: string | null;
  profileName?: string | null;
}

/** Lista todas as instances conhecidas pela Evolution API (estado de conexão incluso). */
export async function fetchInstances(): Promise<EvolutionInstanceInfo[]> {
  const raw = await request<unknown>("/instance/fetchInstances");
  // A Evolution API v2 devolve um array de objetos; alguns deploys envolvem em {instance: {...}}
  const arr = Array.isArray(raw) ? raw : [];
  return arr.map((item) => {
    const i = (item as { instance?: Record<string, unknown> }).instance ?? (item as Record<string, unknown>);
    return {
      name: String(i.instanceName ?? i.name ?? ""),
      connectionStatus: String(i.connectionStatus ?? i.state ?? "unknown"),
      ownerJid: (i.ownerJid as string) ?? null,
      profileName: (i.profileName as string) ?? null,
    };
  });
}

export async function logoutInstance(instanceName: string, apiKey?: string) {
  return request(`/instance/logout/${instanceName}`, { method: "DELETE", apiKey });
}

export async function deleteInstance(instanceName: string, apiKey?: string) {
  return request(`/instance/delete/${instanceName}`, { method: "DELETE", apiKey });
}

/**
 * Envia uma mensagem de texto por uma instance específica.
 * `apiKey` deve ser o token da própria instance quando disponível; cai pro
 * token global se não tiver (algumas instalações aceitam o global pra tudo).
 */
export async function sendText(instanceName: string, number: string, text: string, apiKey?: string) {
  return request<{ key?: { id?: string } }>(`/message/sendText/${instanceName}`, {
    method: "POST",
    apiKey,
    body: { number, text },
  });
}
