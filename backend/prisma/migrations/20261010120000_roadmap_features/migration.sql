-- CreateEnum
CREATE TYPE "FaultStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED');

-- CreateEnum
CREATE TYPE "CountStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('FAULT_REPORTED', 'FAULT_UPDATED', 'ASSIGNED', 'RETURNED', 'WARRANTY_EXPIRING', 'ASSIGNMENT_DUE', 'ASSIGNMENT_OVERDUE');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'UNIT_MANAGER';

-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN     "dueAt" TIMESTAMP(3),
ADD COLUMN     "receiptNo" SERIAL NOT NULL;

-- CreateTable
CREATE TABLE "FaultTicket" (
    "id" TEXT NOT NULL,
    "ticketNo" SERIAL NOT NULL,
    "deviceId" TEXT NOT NULL,
    "reportedById" TEXT,
    "handledById" TEXT,
    "status" "FaultStatus" NOT NULL DEFAULT 'OPEN',
    "description" TEXT NOT NULL,
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "FaultTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CountSession" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "status" "CountStatus" NOT NULL DEFAULT 'OPEN',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "CountSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CountItem" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "expected" BOOLEAN NOT NULL DEFAULT true,
    "scannedAt" TIMESTAMP(3),
    "scannedById" TEXT,

    CONSTRAINT "CountItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "dedupeKey" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FaultTicket_ticketNo_key" ON "FaultTicket"("ticketNo");

-- CreateIndex
CREATE INDEX "FaultTicket_status_idx" ON "FaultTicket"("status");

-- CreateIndex
CREATE INDEX "FaultTicket_deviceId_status_idx" ON "FaultTicket"("deviceId", "status");

-- CreateIndex
CREATE INDEX "CountSession_status_createdAt_idx" ON "CountSession"("status", "createdAt");

-- CreateIndex
CREATE INDEX "CountItem_sessionId_scannedAt_idx" ON "CountItem"("sessionId", "scannedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CountItem_sessionId_deviceId_key" ON "CountItem"("sessionId", "deviceId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_userId_dedupeKey_key" ON "Notification"("userId", "dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "Assignment_receiptNo_key" ON "Assignment"("receiptNo");

-- AddForeignKey
ALTER TABLE "FaultTicket" ADD CONSTRAINT "FaultTicket_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FaultTicket" ADD CONSTRAINT "FaultTicket_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FaultTicket" ADD CONSTRAINT "FaultTicket_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CountSession" ADD CONSTRAINT "CountSession_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CountItem" ADD CONSTRAINT "CountItem_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CountSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CountItem" ADD CONSTRAINT "CountItem_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CountItem" ADD CONSTRAINT "CountItem_scannedById_fkey" FOREIGN KEY ("scannedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Bir cihazın aynı anda yalnızca bir çözülmemiş arıza kaydı olabilir.
CREATE UNIQUE INDEX "FaultTicket_one_active_per_device"
  ON "FaultTicket" ("deviceId") WHERE status <> 'RESOLVED';

-- Mevcut arızalı cihazlar için açık kayıt oluştur (tutarlılık).
INSERT INTO "FaultTicket" ("id", "deviceId", "status", "description", "createdAt", "updatedAt")
SELECT 'ft_' || md5(random()::text || d."id"), d."id", 'OPEN', 'Mevcut arızalı cihaz (sistem tarafından kayda alındı)', now(), now()
FROM "Device" d WHERE d."status" = 'FAULTY';
