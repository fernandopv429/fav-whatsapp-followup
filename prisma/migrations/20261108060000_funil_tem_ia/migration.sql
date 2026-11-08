-- Recria o enum ContactStage (tabela Contact está vazia em produção, seguro
-- trocar os valores sem migração de dados).
ALTER TABLE "Contact" ALTER COLUMN "stage" DROP DEFAULT;
ALTER TABLE "Contact" ALTER COLUMN "stage" TYPE TEXT USING ("stage"::TEXT);
DROP TYPE "ContactStage";
CREATE TYPE "ContactStage" AS ENUM ('novo', 'aguardando_msg1', 'aguardando_msg2', 'tem_ia', 'em_drip', 'oferta_enviada', 'convertido', 'perdido');
ALTER TABLE "Contact" ALTER COLUMN "stage" TYPE "ContactStage" USING ("stage"::"ContactStage");
ALTER TABLE "Contact" ALTER COLUMN "stage" SET DEFAULT 'novo';

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN "msg2SentAt" TIMESTAMP(3);

-- AlterTable: divide o limiar único em dois (msg1 e msg2)
ALTER TABLE "Settings" RENAME COLUMN "responseThresholdMinutes" TO "msg1ThresholdMinutes";
ALTER TABLE "Settings" ADD COLUMN "msg2ThresholdMinutes" INTEGER NOT NULL DEFAULT 15;
