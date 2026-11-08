-- AlterTable: ordem de uso do número na sequência de drip (definida pelo usuário)
ALTER TABLE "WhatsappNumber" ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: dripTotalDays vira calculado (qtd. de números ativos), não configurado
ALTER TABLE "Settings" DROP COLUMN "dripTotalDays";
