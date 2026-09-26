-- CreateEnum
CREATE TYPE "RegistryKind" AS ENUM ('legal', 'individual');

-- CreateTable
CREATE TABLE "registry_profiles" (
    "inn" TEXT NOT NULL,
    "ogrn" TEXT NOT NULL,
    "kind" "RegistryKind" NOT NULL,
    "name" TEXT NOT NULL,
    "okvedMain" TEXT,
    "okveds" TEXT[],
    "releaseDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registry_profiles_pkey" PRIMARY KEY ("inn")
);

-- CreateTable
CREATE TABLE "registry_releases" (
    "id" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "releaseDate" TIMESTAMP(3) NOT NULL,
    "scanned" INTEGER NOT NULL,
    "matched" INTEGER NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registry_releases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "registry_profiles_ogrn_idx" ON "registry_profiles"("ogrn");

-- CreateIndex
CREATE INDEX "registry_profiles_releaseDate_idx" ON "registry_profiles"("releaseDate");

-- CreateIndex
CREATE INDEX "registry_releases_releaseDate_idx" ON "registry_releases"("releaseDate");
