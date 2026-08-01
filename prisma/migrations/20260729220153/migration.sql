-- CreateEnum
CREATE TYPE "ClientType" AS ENUM ('PF', 'PJ');

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ClientType" NOT NULL,
    "document" TEXT,
    "accountStatus" TEXT NOT NULL DEFAULT 'ATIVO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "model" TEXT,
    "serialNumber" TEXT,
    "physicalState" TEXT NOT NULL DEFAULT 'ATIVO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_orders" (
    "id" TEXT NOT NULL,
    "protocol" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'MEDIA',
    "assignedUserId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "service_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technical_reports" (
    "id" TEXT NOT NULL,
    "serviceOrderId" TEXT NOT NULL,
    "companyName" TEXT,
    "companyDocument" TEXT,
    "companyContact" TEXT,
    "companyAddress" TEXT,
    "companyEmail" TEXT,
    "companySite" TEXT,
    "technicianName" TEXT,
    "technicianRegistry" TEXT,
    "cityDate" TIMESTAMP(3),
    "clientReport" TEXT,
    "testsExecuted" TEXT,
    "powerStageStatus" TEXT,
    "usageTimeEstimate" TEXT,
    "probableCause" TEXT,
    "technicalConclusion" TEXT,
    "noRepair" BOOLEAN NOT NULL DEFAULT false,
    "noRepairReason" TEXT,
    "partsValue" DECIMAL(65,30),
    "laborValue" DECIMAL(65,30),
    "totalValue" DECIMAL(65,30),
    "version" INTEGER NOT NULL DEFAULT 1,
    "htmlSnapshot" TEXT,
    "printedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "technical_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_components" (
    "id" TEXT NOT NULL,
    "technicalReportId" TEXT NOT NULL,
    "description" TEXT,
    "quantity" INTEGER,
    "unitPrice" DECIMAL(65,30),
    "price" DECIMAL(65,30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_photos" (
    "id" TEXT NOT NULL,
    "technicalReportId" TEXT NOT NULL,
    "storagePath" TEXT,
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "service_orders_protocol_key" ON "service_orders"("protocol");

-- CreateIndex
CREATE UNIQUE INDEX "technical_reports_serviceOrderId_key" ON "technical_reports"("serviceOrderId");

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_reports" ADD CONSTRAINT "technical_reports_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "service_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_components" ADD CONSTRAINT "report_components_technicalReportId_fkey" FOREIGN KEY ("technicalReportId") REFERENCES "technical_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_photos" ADD CONSTRAINT "report_photos_technicalReportId_fkey" FOREIGN KEY ("technicalReportId") REFERENCES "technical_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
