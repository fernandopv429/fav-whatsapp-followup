-- AlterTable: limite diário global de novos contatos iniciados (independente do cap por número)
ALTER TABLE "Settings" ADD COLUMN "newContactsDailyCap" INTEGER NOT NULL DEFAULT 20;
