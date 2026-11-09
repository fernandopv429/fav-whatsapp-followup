-- DropTable (DripState + sua FK/índices saem junto)
DROP TABLE "DripState";
DROP TYPE "DripStatus";

-- Contact: troca o enum fixo "stage" por ponteiro de execução genérico
DROP INDEX "Contact_stage_idx";
ALTER TABLE "Contact" DROP COLUMN "stage";
DROP TYPE "ContactStage";

ALTER TABLE "Contact"
  ADD COLUMN "currentFlowId" TEXT,
  ADD COLUMN "currentStepId" TEXT,
  ADD COLUMN "stepEnteredAt" TIMESTAMP(3),
  ADD COLUMN "flowStartedAt" TIMESTAMP(3),
  ADD COLUMN "rotateIndex" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "stageLabel" TEXT;

-- Settings: limiares agora vivem em cada passo delay_branch, não mais globais
ALTER TABLE "Settings" DROP COLUMN "msg1ThresholdMinutes";
ALTER TABLE "Settings" DROP COLUMN "msg2ThresholdMinutes";

-- CreateEnum
CREATE TYPE "FlowStepType" AS ENUM ('send', 'delay_branch', 'ai_offer', 'end');

-- CreateEnum
CREATE TYPE "NumberStrategy" AS ENUM ('same', 'specific', 'rotate');

-- CreateTable
CREATE TABLE "Flow" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Flow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlowStep" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "type" "FlowStepType" NOT NULL,
    "position" INTEGER NOT NULL,
    "templateKey" TEXT,
    "numberStrategy" "NumberStrategy",
    "numberId" TEXT,
    "nextStepId" TEXT,
    "thresholdMinutes" INTEGER,
    "onReplyGotoStepId" TEXT,
    "onReplySendTemplateKey" TEXT,
    "onTimeoutGotoStepId" TEXT,
    "endLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlowStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FlowStep_flowId_idx" ON "FlowStep"("flowId");

-- CreateIndex
CREATE INDEX "Contact_currentStepId_idx" ON "Contact"("currentStepId");

-- AddForeignKey
ALTER TABLE "FlowStep" ADD CONSTRAINT "FlowStep_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "Flow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_currentFlowId_fkey" FOREIGN KEY ("currentFlowId") REFERENCES "Flow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_currentStepId_fkey" FOREIGN KEY ("currentStepId") REFERENCES "FlowStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;
