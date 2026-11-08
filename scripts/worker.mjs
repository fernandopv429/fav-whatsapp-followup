import cron from "node-cron";

const PORT = process.env.PORT ?? "3000";
const BASE_URL = `http://127.0.0.1:${PORT}`;
const SECRET = process.env.INTERNAL_SECRET;

if (!SECRET) {
  console.error("[worker] INTERNAL_SECRET não configurado — abortando.");
  process.exit(1);
}

let running = false;

async function runTick() {
  if (running) {
    console.log("[worker] tick anterior ainda rodando, pulando esse ciclo.");
    return;
  }
  running = true;
  try {
    const res = await fetch(`${BASE_URL}/api/internal/tick`, {
      method: "POST",
      headers: { "x-internal-secret": SECRET },
    });
    const body = await res.json();
    if (!res.ok) {
      console.error("[worker] tick falhou:", res.status, body);
    } else if (body.sent > 0 || body.erros > 0) {
      console.log("[worker] tick:", body);
    }
  } catch (err) {
    console.error("[worker] erro ao chamar /api/internal/tick:", err);
  } finally {
    running = false;
  }
}

console.log(`[worker] agendado para rodar a cada minuto contra ${BASE_URL}`);
cron.schedule("* * * * *", runTick);

// primeira execução logo na subida, sem esperar o primeiro minuto cheio
runTick();
