CREATE TABLE "whatsapp_connections" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "instanceName" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "qrCodeBase64" TEXT,
  "phoneNumber" TEXT,
  "lastErrorCode" TEXT,
  "lastErrorMessage" TEXT,
  "connectedAt" TIMESTAMP(3),
  "lastSeenAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "whatsapp_connections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "whatsapp_connections_instanceName_key" ON "whatsapp_connections"("instanceName");
