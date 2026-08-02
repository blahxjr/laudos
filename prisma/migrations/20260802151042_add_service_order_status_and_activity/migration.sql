/*
  Warnings:

  - The `status` column on the `service_orders` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "ServiceOrderStatus" AS ENUM ('ABERTA', 'EM_DIAGNOSTICO', 'AGUARDANDO_CLIENTE', 'CONCLUIDA', 'SEM_CONSERTO');

-- AlterTable
ALTER TABLE "service_orders" DROP COLUMN "status",
ADD COLUMN     "status" "ServiceOrderStatus" NOT NULL DEFAULT 'ABERTA';

-- CreateTable
CREATE TABLE "service_order_activities" (
    "id" TEXT NOT NULL,
    "serviceOrderId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'NOTE',
    "message" TEXT NOT NULL,
    "author" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_order_activities_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "service_order_activities" ADD CONSTRAINT "service_order_activities_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "service_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
