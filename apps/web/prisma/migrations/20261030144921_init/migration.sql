-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PATIENT', 'DOCTOR');

-- CreateEnum
CREATE TYPE "LinkStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REFUSED');

-- CreateEnum
CREATE TYPE "MeasureSource" AS ENUM ('MANUAL', 'DEVICE');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('NORMAL', 'HYPERTENSIVE', 'SEVERE_PENDING', 'SEVERE_CONFIRMED', 'SEVERE_NOT_CONFIRMED', 'SEVERE_EXPIRED');

-- CreateEnum
CREATE TYPE "RiskCategory" AS ENUM ('LOW', 'MODERATE', 'HIGH');

-- CreateEnum
CREATE TYPE "AlertLevel" AS ENUM ('EMERGENCY', 'SEVERE', 'HIGH', 'WATCH', 'SILENT');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'CLOSED');

-- CreateTable
CREATE TABLE "Profile" (
    "id" UUID NOT NULL,
    "role" "Role" NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Doctor" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,

    CONSTRAINT "Doctor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "lmpDate" TIMESTAMP(3),
    "firstPregnancy" BOOLEAN NOT NULL,
    "multiplePregnancy" BOOLEAN NOT NULL,
    "chronicHypertension" BOOLEAN NOT NULL,
    "previousPreeclampsia" BOOLEAN NOT NULL,
    "preexistingDiabetes" BOOLEAN NOT NULL,
    "gestationalDiabetes" BOOLEAN NOT NULL,
    "kidneyDisease" BOOLEAN NOT NULL,
    "autoimmuneDisease" BOOLEAN NOT NULL,
    "familyPreeclampsia" BOOLEAN NOT NULL,
    "familyHypertension" BOOLEAN NOT NULL,
    "ivfPregnancy" BOOLEAN NOT NULL,
    "heightCm" INTEGER,
    "weightKg" DOUBLE PRECISION,
    "treatments" TEXT,
    "expectedSessionsPerDay" INTEGER NOT NULL DEFAULT 2,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "aiSummary" TEXT,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InviteCode" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "doctorId" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InviteCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinkRequest" (
    "id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "doctorId" UUID NOT NULL,
    "status" "LinkStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "LinkRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BpSession" (
    "id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "sys" INTEGER NOT NULL,
    "dia" INTEGER NOT NULL,
    "pulse" INTEGER,
    "takenAt" TIMESTAMP(3) NOT NULL,
    "source" "MeasureSource" NOT NULL DEFAULT 'MANUAL',
    "status" "SessionStatus" NOT NULL,
    "confirmedBySessionId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BpSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Questionnaire" (
    "id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "answers" JSONB NOT NULL,
    "answeredAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Questionnaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskAssessment" (
    "id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "category" "RiskCategory" NOT NULL,
    "factors" JSONB NOT NULL,
    "trigger" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "level" "AlertLevel" NOT NULL,
    "evidence" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "sourceId" UUID,
    "status" "AlertStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ackAt" TIMESTAMP(3),

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorNote" (
    "id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "doctorId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DoctorNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" UUID NOT NULL,
    "linkId" UUID NOT NULL,
    "senderId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Doctor_profileId_key" ON "Doctor"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_profileId_key" ON "Patient"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "InviteCode_code_key" ON "InviteCode"("code");

-- CreateIndex
CREATE INDEX "BpSession_patientId_takenAt_idx" ON "BpSession"("patientId", "takenAt");

-- CreateIndex
CREATE INDEX "Questionnaire_patientId_answeredAt_idx" ON "Questionnaire"("patientId", "answeredAt");

-- CreateIndex
CREATE INDEX "Alert_patientId_status_idx" ON "Alert"("patientId", "status");

-- CreateIndex
CREATE INDEX "Message_linkId_createdAt_idx" ON "Message"("linkId", "createdAt");

-- AddForeignKey
ALTER TABLE "Doctor" ADD CONSTRAINT "Doctor_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InviteCode" ADD CONSTRAINT "InviteCode_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkRequest" ADD CONSTRAINT "LinkRequest_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkRequest" ADD CONSTRAINT "LinkRequest_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BpSession" ADD CONSTRAINT "BpSession_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Questionnaire" ADD CONSTRAINT "Questionnaire_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskAssessment" ADD CONSTRAINT "RiskAssessment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorNote" ADD CONSTRAINT "DoctorNote_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorNote" ADD CONSTRAINT "DoctorNote_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "LinkRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
