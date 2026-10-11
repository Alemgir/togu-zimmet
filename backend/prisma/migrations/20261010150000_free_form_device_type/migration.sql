-- Cihaz türü: sabit enum yerine serbest metin (yerleşik kodlar + özel tür adları).
ALTER TABLE "Device" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "Device" ALTER COLUMN "type" TYPE TEXT USING "type"::text;
ALTER TABLE "Device" ALTER COLUMN "type" SET DEFAULT 'OTHER';
DROP TYPE "DeviceType";
