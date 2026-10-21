-- CreateTable
CREATE TABLE "checklist_runs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID,
    "base_asset" TEXT,
    "side" "TradeSide",
    "answers" JSONB NOT NULL,
    "all_ok" BOOLEAN NOT NULL,
    "verdict" TEXT NOT NULL,
    "tilt_state" JSONB,
    "note" TEXT,
    "trade_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "checklist_runs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "checklist_runs_organization_id_created_at_idx" ON "checklist_runs"("organization_id", "created_at");
ALTER TABLE "checklist_runs" ADD CONSTRAINT "checklist_runs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "checklist_runs" ADD CONSTRAINT "checklist_runs_trade_id_fkey" FOREIGN KEY ("trade_id") REFERENCES "trades"("id") ON DELETE SET NULL ON UPDATE CASCADE;
