-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "NumberStatus" AS ENUM ('warming_up', 'active', 'paused', 'banned');

-- CreateEnum
CREATE TYPE "ContactStage" AS ENUM ('novo', 'aguardando_resposta', 'resposta_imediata', 'potencial_cliente', 'em_drip', 'qualificado', 'oferta_enviada', 'convertido', 'perdido');

-- CreateEnum
CREATE TYPE "LogDirection" AS ENUM ('out', 'in');

-- CreateEnum
CREATE TYPE "LogStatus" AS ENUM ('queued', 'sent', 'delivered', 'failed');

-- CreateEnum
CREATE TYPE "DripStatus" AS ENUM ('ativo', 'pausado', 'concluido', 'convertido');

-- CreateTable
CREATE TABLE "WhatsappNumber" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "evolutionInstanceName" TEXT NOT NULL,
    "evolutionInstanceToken" TEXT,
    "phoneNumber" TEXT,
    "status" "NumberStatus" NOT NULL DEFAULT 'warming_up',
    "dailyCap" INTEGER NOT NULL DEFAULT 20,
    "sentToday" INTEGER NOT NULL DEFAULT 0,
    "lastSentAt" TIMESTAMP(3),
    "nextEligibleAt" TIMESTAMP(3),
    "capResetAt" TIMESTAMP(3),
    "warmupStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappNumber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "sourceBatch" TEXT,
    "companyData" JSONB,
    "stage" "ContactStage" NOT NULL DEFAULT 'novo',
    "assignedNumberId" TEXT,
    "initialSentAt" TIMESTAMP(3),
    "firstReplyAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageLog" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "numberId" TEXT,
    "direction" "LogDirection" NOT NULL,
    "templateKey" TEXT,
    "body" TEXT NOT NULL,
    "evolutionMessageId" TEXT,
    "status" "LogStatus" NOT NULL DEFAULT 'queued',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "MessageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DripState" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "currentDay" INTEGER NOT NULL DEFAULT 0,
    "lastSentAt" TIMESTAMP(3),
    "nextDueAt" TIMESTAMP(3),
    "status" "DripStatus" NOT NULL DEFAULT 'ativo',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DripState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "responseThresholdMinutes" INTEGER NOT NULL DEFAULT 60,
    "dripTotalDays" INTEGER NOT NULL DEFAULT 7,
    "sendWindowStart" INTEGER NOT NULL DEFAULT 8,
    "sendWindowEnd" INTEGER NOT NULL DEFAULT 20,
    "minDelaySeconds" INTEGER NOT NULL DEFAULT 45,
    "maxDelaySeconds" INTEGER NOT NULL DEFAULT 180,
    "warmupDailyCapStart" INTEGER NOT NULL DEFAULT 20,
    "warmupDailyCapMax" INTEGER NOT NULL DEFAULT 150,
    "warmupRampDays" INTEGER NOT NULL DEFAULT 14,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappNumber_evolutionInstanceName_key" ON "WhatsappNumber"("evolutionInstanceName");

-- CreateIndex
CREATE INDEX "Contact_stage_idx" ON "Contact"("stage");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_phone_key" ON "Contact"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "MessageTemplate_key_key" ON "MessageTemplate"("key");

-- CreateIndex
CREATE INDEX "MessageLog_status_idx" ON "MessageLog"("status");

-- CreateIndex
CREATE INDEX "MessageLog_contactId_idx" ON "MessageLog"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "DripState_contactId_key" ON "DripState"("contactId");

-- CreateIndex
CREATE INDEX "DripState_status_nextDueAt_idx" ON "DripState"("status", "nextDueAt");

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_assignedNumberId_fkey" FOREIGN KEY ("assignedNumberId") REFERENCES "WhatsappNumber"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_numberId_fkey" FOREIGN KEY ("numberId") REFERENCES "WhatsappNumber"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DripState" ADD CONSTRAINT "DripState_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

