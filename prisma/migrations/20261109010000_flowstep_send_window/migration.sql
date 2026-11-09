-- AlterTable: janela de envio por passo (sobrepõe a janela do fluxo quando definida)
ALTER TABLE "FlowStep" ADD COLUMN "sendWindowStart" INTEGER;
ALTER TABLE "FlowStep" ADD COLUMN "sendWindowEnd" INTEGER;
