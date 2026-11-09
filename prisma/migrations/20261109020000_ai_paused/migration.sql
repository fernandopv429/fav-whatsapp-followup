-- AlterTable: pausa manual da IA por contato (não mexe no estado do fluxo, só silencia a IA)
ALTER TABLE "Contact" ADD COLUMN "aiPaused" BOOLEAN NOT NULL DEFAULT false;
