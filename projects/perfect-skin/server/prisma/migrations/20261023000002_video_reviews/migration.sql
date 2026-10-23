-- CreateTable
CREATE TABLE "video_reviews" (
    "id" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "caption" TEXT,
    "mp4Url" TEXT,
    "webmUrl" TEXT,
    "posterUrl" TEXT,
    "productId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "consentConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "consentConfirmedAt" TIMESTAMP(3),
    "consentConfirmedById" TEXT,
    "consentDocPath" TEXT,
    "consentTemplateVersion" TEXT,
    "consentAllowSite" BOOLEAN NOT NULL DEFAULT false,
    "consentAllowSocial" BOOLEAN NOT NULL DEFAULT false,
    "consentAllowAds" BOOLEAN NOT NULL DEFAULT false,
    "consentExpiresAt" TIMESTAMP(3),
    "consentRevokedAt" TIMESTAMP(3),
    "consentRevokedById" TEXT,
    "consentNote" TEXT,
    "contentReviewed" BOOLEAN NOT NULL DEFAULT false,
    "contentReviewedAt" TIMESTAMP(3),
    "contentReviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "video_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "video_reviews_isActive_deletedAt_sortOrder_idx" ON "video_reviews"("isActive", "deletedAt", "sortOrder");

-- CreateIndex
CREATE INDEX "video_reviews_productId_idx" ON "video_reviews"("productId");

-- CreateIndex
CREATE INDEX "video_reviews_consentConfirmedById_idx" ON "video_reviews"("consentConfirmedById");

-- CreateIndex
CREATE INDEX "video_reviews_consentRevokedById_idx" ON "video_reviews"("consentRevokedById");

-- CreateIndex
CREATE INDEX "video_reviews_contentReviewedById_idx" ON "video_reviews"("contentReviewedById");

-- AddForeignKey
ALTER TABLE "video_reviews" ADD CONSTRAINT "video_reviews_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_reviews" ADD CONSTRAINT "video_reviews_consentConfirmedById_fkey" FOREIGN KEY ("consentConfirmedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_reviews" ADD CONSTRAINT "video_reviews_consentRevokedById_fkey" FOREIGN KEY ("consentRevokedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_reviews" ADD CONSTRAINT "video_reviews_contentReviewedById_fkey" FOREIGN KEY ("contentReviewedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CHECK: правила, которые Prisma не выражает. Дублируются в prisma/sql/01-constraints.sql.
ALTER TABLE "video_reviews"
  ADD CONSTRAINT "video_review_consent_complete" CHECK (
    NOT "consentConfirmed" OR ("consentConfirmedAt" IS NOT NULL AND "consentConfirmedById" IS NOT NULL)
  ),
  ADD CONSTRAINT "video_review_review_complete" CHECK (
    NOT "contentReviewed" OR ("contentReviewedAt" IS NOT NULL AND "contentReviewedById" IS NOT NULL)
  ),
  -- Публикуемость без срока согласия: срок проверяется в запросах, CHECK по времени невозможен.
  ADD CONSTRAINT "video_review_active_ready" CHECK (
    NOT "isActive" OR (
      "consentConfirmed" AND "consentDocPath" IS NOT NULL AND "consentAllowSite"
      AND "consentRevokedAt" IS NULL AND "contentReviewed"
      AND "mp4Url" IS NOT NULL AND "posterUrl" IS NOT NULL AND "deletedAt" IS NULL
    )
  ),
  ADD CONSTRAINT "video_review_sort_nonneg" CHECK ("sortOrder" >= 0);
