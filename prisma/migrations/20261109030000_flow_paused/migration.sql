-- AlterTable: pausa o disparo/avanço de um fluxo inteiro (não mexe em contatos individuais)
ALTER TABLE "Flow" ADD COLUMN "paused" BOOLEAN NOT NULL DEFAULT false;
