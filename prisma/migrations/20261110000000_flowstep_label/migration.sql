-- AlterTable: nome livre pro passo, exibido no diagrama e na lista (não afeta a lógica do motor)
ALTER TABLE "FlowStep" ADD COLUMN "label" TEXT;
