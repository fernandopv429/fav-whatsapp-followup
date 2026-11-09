-- AlterEnum
ALTER TYPE "FlowStepType" ADD VALUE 'ai_reply';

-- AlterTable: janela de envio por fluxo (nulo = usa o padrão global de Settings)
ALTER TABLE "Flow" ADD COLUMN "sendWindowStart" INTEGER;
ALTER TABLE "Flow" ADD COLUMN "sendWindowEnd" INTEGER;

-- AlterTable: anexo de mídia por passo
ALTER TABLE "FlowStep" ADD COLUMN "mediaUrl" TEXT;
ALTER TABLE "FlowStep" ADD COLUMN "mediaType" TEXT;

-- AlterTable: anexo de mídia por mensagem enfileirada
ALTER TABLE "MessageLog" ADD COLUMN "mediaUrl" TEXT;
ALTER TABLE "MessageLog" ADD COLUMN "mediaType" TEXT;
