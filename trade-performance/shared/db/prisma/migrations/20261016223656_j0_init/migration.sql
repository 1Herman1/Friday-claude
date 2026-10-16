-- CreateEnum
CREATE TYPE "OrgRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');

-- CreateEnum
CREATE TYPE "VenueKind" AS ENUM ('EXCHANGE', 'PROP_FIRM', 'TESTNET', 'BROKER', 'PAPER');

-- CreateEnum
CREATE TYPE "AccountKind" AS ENUM ('LIVE', 'DEMO', 'PROP_CHALLENGE', 'PROP_FUNDED', 'PAPER', 'BACKTEST');

-- CreateEnum
CREATE TYPE "OwnerType" AS ENUM ('HUMAN', 'AGENT');

-- CreateEnum
CREATE TYPE "InstrumentKind" AS ENUM ('SPOT', 'PERPETUAL', 'FUTURE', 'CFD');

-- CreateEnum
CREATE TYPE "TradeSide" AS ENUM ('LONG', 'SHORT');

-- CreateEnum
CREATE TYPE "OrderSide" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "Executor" AS ENUM ('HUMAN', 'AGENT');

-- CreateEnum
CREATE TYPE "DataOrigin" AS ENUM ('MANUAL', 'VOICE', 'IMPORT', 'ENGINE');

-- CreateEnum
CREATE TYPE "TradeStatus" AS ENUM ('PLANNED', 'OPEN', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('MARKET', 'LIMIT', 'STOP_MARKET', 'STOP_LIMIT', 'TAKE_PROFIT', 'TRAILING_STOP', 'OTHER');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('NEW', 'PARTIALLY_FILLED', 'FILLED', 'CANCELED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "LedgerKind" AS ENUM ('FUNDING', 'FEE', 'REBATE', 'DEPOSIT', 'WITHDRAWAL', 'TRANSFER_IN', 'TRANSFER_OUT', 'LIQUIDATION_FEE', 'INSURANCE', 'ADJUSTMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "SignalMode" AS ENUM ('LIVE', 'BACKTEST', 'SHADOW');

-- CreateEnum
CREATE TYPE "SignalSourceKind" AS ENUM ('SCANNER', 'DETECTOR', 'TELEGRAM_CHANNEL', 'MANUAL');

-- CreateEnum
CREATE TYPE "SignalStatus" AS ENUM ('PENDING', 'OPEN', 'WIN', 'LOSS', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DecisionAction" AS ENUM ('TAKE', 'SKIP', 'HOLD');

-- CreateEnum
CREATE TYPE "RiskVerdict" AS ENUM ('APPROVED', 'REDUCED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RiskScope" AS ENUM ('GLOBAL', 'ORGANIZATION', 'USER', 'ACCOUNT', 'AGENT', 'CLUSTER');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('INFO', 'WARN', 'CRITICAL');

-- CreateEnum
CREATE TYPE "VersionStatus" AS ENUM ('DRAFT', 'SHADOW', 'ACTIVE', 'RETIRED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AgentMode" AS ENUM ('LIVE', 'SHADOW', 'BASELINE', 'PAPER');

-- CreateEnum
CREATE TYPE "RunState" AS ENUM ('RUNNING', 'PAUSED', 'STOPPED');

-- CreateEnum
CREATE TYPE "LlmBilling" AS ENUM ('API', 'SUBSCRIPTION', 'FREE');

-- CreateEnum
CREATE TYPE "NoteKind" AS ENUM ('TEXT', 'VOICE');

-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('WEB', 'TELEGRAM', 'API', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AttachmentKind" AS ENUM ('SCREENSHOT', 'CHART', 'VOICE', 'EXPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'RUNNING', 'DONE', 'FAILED', 'DEAD');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('USER', 'AGENT', 'SYSTEM');

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'personal',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "telegram_user_id" BIGINT,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Moscow',
    "locale" TEXT NOT NULL DEFAULT 'ru',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "OrgRole" NOT NULL DEFAULT 'OWNER',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_identities" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_tokens" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID,
    "name" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "scopes" TEXT[],
    "last_used_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "actor_type" "ActorType" NOT NULL,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT,
    "before" JSONB,
    "after" JSONB,
    "at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venues" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "VenueKind" NOT NULL,
    "has_api" BOOLEAN NOT NULL DEFAULT false,
    "meta" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "venues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instruments" (
    "id" UUID NOT NULL,
    "venue_id" UUID NOT NULL,
    "symbol" TEXT NOT NULL,
    "kind" "InstrumentKind" NOT NULL,
    "base_asset" TEXT NOT NULL,
    "quote_asset" TEXT NOT NULL,
    "settle_asset" TEXT,
    "is_inverse" BOOLEAN NOT NULL DEFAULT false,
    "contract_size" DECIMAL(38,18),
    "tick_size" DECIMAL(38,18),
    "step_size" DECIMAL(38,18),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "meta" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "instruments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prop_profiles" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "venue_id" UUID NOT NULL,
    "program" TEXT NOT NULL,
    "phase" TEXT,
    "account_size" DECIMAL(38,18) NOT NULL,
    "profit_target_pct" DECIMAL(20,8),
    "daily_loss_pct" DECIMAL(20,8),
    "daily_loss_method" TEXT,
    "daily_reset_tz" TEXT,
    "daily_reset_time" TEXT,
    "max_drawdown_pct" DECIMAL(20,8),
    "drawdown_type" TEXT,
    "max_leverage" DECIMAL(20,8),
    "stop_loss_required" BOOLEAN NOT NULL DEFAULT false,
    "min_trading_days" INTEGER,
    "consistency_rule_pct" DECIMAL(20,8),
    "news_trading_allowed" BOOLEAN,
    "weekend_hold_allowed" BOOLEAN,
    "bot_policy" TEXT NOT NULL DEFAULT 'unknown',
    "bot_permission_ref" TEXT,
    "forbidden_practices" TEXT[],
    "extra" JSONB,
    "source_url" TEXT,
    "verified_at" TIMESTAMPTZ(6),
    "valid_from" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_to" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prop_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "venue_id" UUID NOT NULL,
    "prop_profile_id" UUID,
    "owner_type" "OwnerType" NOT NULL DEFAULT 'HUMAN',
    "user_id" UUID,
    "name" TEXT NOT NULL,
    "kind" "AccountKind" NOT NULL,
    "base_asset" TEXT NOT NULL DEFAULT 'USDT',
    "external_account_id" TEXT,
    "credential_ref" TEXT,
    "starting_balance" DECIMAL(38,18),
    "day_boundary_tz" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "opened_at" TIMESTAMPTZ(6),
    "closed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_credentials" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "key_hint" TEXT NOT NULL,
    "ciphertext" BYTEA NOT NULL,
    "enc_key_id" TEXT NOT NULL,
    "read_only" BOOLEAN NOT NULL DEFAULT true,
    "scopes" TEXT[],
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rotated_at" TIMESTAMPTZ(6),

    CONSTRAINT "exchange_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_snapshots" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "taken_at" TIMESTAMPTZ(6) NOT NULL,
    "balance" DECIMAL(38,18) NOT NULL,
    "equity" DECIMAL(38,18) NOT NULL,
    "unrealized_pnl" DECIMAL(38,18),
    "margin_used" DECIMAL(38,18),
    "origin" "DataOrigin" NOT NULL,
    "raw" JSONB,

    CONSTRAINT "account_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "instrument_id" UUID NOT NULL,
    "trade_id" UUID,
    "decision_id" UUID,
    "risk_evaluation_id" UUID,
    "external_order_id" TEXT,
    "client_order_id" TEXT,
    "purpose" TEXT,
    "side" "OrderSide" NOT NULL,
    "type" "OrderType" NOT NULL,
    "time_in_force" TEXT,
    "reduce_only" BOOLEAN NOT NULL DEFAULT false,
    "price" DECIMAL(38,18),
    "stop_price" DECIMAL(38,18),
    "qty" DECIMAL(38,18) NOT NULL,
    "filled_qty" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "avg_fill_price" DECIMAL(38,18),
    "leverage" DECIMAL(20,8),
    "status" "OrderStatus" NOT NULL,
    "origin" "DataOrigin" NOT NULL,
    "placed_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "closed_at" TIMESTAMPTZ(6),
    "raw" JSONB,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "executions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "instrument_id" UUID NOT NULL,
    "order_id" UUID,
    "trade_id" UUID,
    "external_id" TEXT NOT NULL,
    "side" "OrderSide" NOT NULL,
    "position_side" TEXT,
    "price" DECIMAL(38,18) NOT NULL,
    "qty" DECIMAL(38,18) NOT NULL,
    "qty_contracts" DECIMAL(38,18),
    "quote_qty" DECIMAL(38,18),
    "fee" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "fee_asset" TEXT,
    "fee_quote" DECIMAL(38,18),
    "is_maker" BOOLEAN,
    "realized_pnl" DECIMAL(38,18),
    "executed_at" TIMESTAMPTZ(6) NOT NULL,
    "origin" "DataOrigin" NOT NULL,
    "raw_record_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trades" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "instrument_id" UUID NOT NULL,
    "executor" "Executor" NOT NULL,
    "origin" "DataOrigin" NOT NULL,
    "agent_id" UUID,
    "strategy_version_id" UUID,
    "signal_id" UUID,
    "decision_id" UUID,
    "playbook_id" UUID,
    "status" "TradeStatus" NOT NULL,
    "side" "TradeSide" NOT NULL,
    "timeframe" TEXT,
    "opened_at" TIMESTAMPTZ(6),
    "closed_at" TIMESTAMPTZ(6),
    "planned_entry" DECIMAL(38,18),
    "planned_stop" DECIMAL(38,18),
    "planned_take_profits" DECIMAL(38,18)[],
    "planned_risk_quote" DECIMAL(38,18),
    "stop_is_liquidation" BOOLEAN NOT NULL DEFAULT false,
    "leverage" DECIMAL(20,8),
    "margin_mode" TEXT,
    "margin_used" DECIMAL(38,18),
    "liquidation_price" DECIMAL(38,18),
    "actual_stop" DECIMAL(38,18),
    "max_qty" DECIMAL(38,18),
    "entry_avg" DECIMAL(38,18),
    "exit_avg" DECIMAL(38,18),
    "pnl_asset" TEXT,
    "gross_pnl" DECIMAL(38,18),
    "fees" DECIMAL(38,18),
    "funding" DECIMAL(38,18),
    "net_pnl" DECIMAL(38,18),
    "net_pnl_usd" DECIMAL(38,18),
    "return_pct" DECIMAL(20,8),
    "r_multiple" DECIMAL(20,8),
    "mfe" DECIMAL(38,18),
    "mae" DECIMAL(38,18),
    "recomputed_at" TIMESTAMPTZ(6),
    "entry_reason" TEXT,
    "emotion_before" TEXT,
    "emotion_after" TEXT,
    "confidence" INTEGER,
    "followed_plan" BOOLEAN,
    "external_position_id" TEXT,
    "idempotency_key" TEXT,
    "possible_duplicate_of_id" UUID,
    "merged_into_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "trades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "instrument_id" UUID,
    "trade_id" UUID,
    "kind" "LedgerKind" NOT NULL,
    "external_id" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "amount" DECIMAL(38,18) NOT NULL,
    "amount_quote" DECIMAL(38,18),
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "origin" "DataOrigin" NOT NULL,
    "raw_record_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playbooks" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "playbooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rules" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID,
    "playbook_id" UUID,
    "code" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'rule',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trade_rule_violations" (
    "trade_id" UUID NOT NULL,
    "rule_id" UUID NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trade_rule_violations_pkey" PRIMARY KEY ("trade_id","rule_id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trade_tags" (
    "trade_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,

    CONSTRAINT "trade_tags_pkey" PRIMARY KEY ("trade_id","tag_id")
);

-- CreateTable
CREATE TABLE "notes" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "trade_id" UUID,
    "day_date" DATE,
    "kind" "NoteKind" NOT NULL,
    "channel" "Channel" NOT NULL,
    "text" TEXT,
    "transcript" TEXT,
    "audio_attachment_id" UUID,
    "duration_sec" INTEGER,
    "parsed" JSONB,
    "parse_status" TEXT,
    "telegram_chat_id" BIGINT,
    "telegram_message_id" BIGINT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "kind" "AttachmentKind" NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "trade_id" UUID,
    "note_id" UUID,
    "uploaded_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_journals" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "mood" TEXT,
    "discipline_score" INTEGER,
    "plan" TEXT,
    "summary" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "daily_journals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_summaries" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "day_tz" TEXT NOT NULL,
    "start_balance" DECIMAL(38,18),
    "end_balance" DECIMAL(38,18),
    "start_equity" DECIMAL(38,18),
    "end_equity" DECIMAL(38,18),
    "realized_pnl" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "fees" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "funding" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "net_pnl" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "net_flows" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "max_drawdown_pct" DECIMAL(20,8),
    "trades_count" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "computed_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "daily_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_reviews" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID,
    "agent_id" UUID,
    "trade_id" UUID,
    "kind" TEXT NOT NULL,
    "period_from" TIMESTAMPTZ(6),
    "period_to" TIMESTAMPTZ(6),
    "status" TEXT NOT NULL DEFAULT 'queued',
    "content_md" TEXT,
    "findings" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clusters" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "repo_path" TEXT NOT NULL,
    "telegram_chat_id" BIGINT,
    "telegram_thread_id" BIGINT,
    "state" "RunState" NOT NULL DEFAULT 'RUNNING',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clusters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "strategy_versions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "cluster_id" UUID NOT NULL,
    "version" TEXT NOT NULL,
    "status" "VersionStatus" NOT NULL DEFAULT 'DRAFT',
    "config" JSONB NOT NULL,
    "config_hash" TEXT NOT NULL,
    "git_commit" TEXT,
    "parent_id" UUID,
    "changelog" TEXT,
    "created_by" "ActorType" NOT NULL,
    "approved_by_id" UUID,
    "approved_at" TIMESTAMPTZ(6),
    "promoted_at" TIMESTAMPTZ(6),
    "retired_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "strategy_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "cluster_id" UUID NOT NULL,
    "strategy_version_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "experiment_id" UUID,
    "name" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "mode" "AgentMode" NOT NULL,
    "replica" INTEGER NOT NULL DEFAULT 1,
    "state" "RunState" NOT NULL DEFAULT 'RUNNING',
    "telegram_thread_id" BIGINT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stopped_at" TIMESTAMPTZ(6),

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "experiments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "hypothesis" TEXT,
    "config" JSONB,
    "started_at" TIMESTAMPTZ(6) NOT NULL,
    "ended_at" TIMESTAMPTZ(6),

    CONSTRAINT "experiments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shadow_evaluations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "candidate_version_id" UUID NOT NULL,
    "baseline_version_id" UUID NOT NULL,
    "period_from" TIMESTAMPTZ(6) NOT NULL,
    "period_to" TIMESTAMPTZ(6) NOT NULL,
    "metrics" JSONB NOT NULL,
    "verdict" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shadow_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "detector_runs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "strategy_version_id" UUID NOT NULL,
    "instrument_id" UUID NOT NULL,
    "mode" "SignalMode" NOT NULL,
    "timeframe" TEXT NOT NULL,
    "range_from" TIMESTAMPTZ(6) NOT NULL,
    "range_to" TIMESTAMPTZ(6) NOT NULL,
    "candles" INTEGER NOT NULL,
    "stats" JSONB,
    "chart_attachment_id" UUID,
    "started_at" TIMESTAMPTZ(6) NOT NULL,
    "finished_at" TIMESTAMPTZ(6),
    "error" TEXT,

    CONSTRAINT "detector_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signals" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "cluster_id" UUID,
    "strategy_version_id" UUID,
    "external_message_id" TEXT,
    "raw_text" TEXT,
    "edited_at" TIMESTAMPTZ(6),
    "deleted_in_source_at" TIMESTAMPTZ(6),
    "detector_run_id" UUID,
    "instrument_id" UUID NOT NULL,
    "timeframe" TEXT NOT NULL,
    "mode" "SignalMode" NOT NULL,
    "side" "TradeSide" NOT NULL,
    "setup_time" TIMESTAMPTZ(6) NOT NULL,
    "detected_at" TIMESTAMPTZ(6) NOT NULL,
    "entry" DECIMAL(38,18) NOT NULL,
    "stop_loss" DECIMAL(38,18) NOT NULL,
    "take_profits" DECIMAL(38,18)[],
    "stop_pct" DECIMAL(20,8) NOT NULL,
    "status" "SignalStatus" NOT NULL,
    "status_changed_at" TIMESTAMPTZ(6) NOT NULL,
    "filled_at" TIMESTAMPTZ(6),
    "exit_at" TIMESTAMPTZ(6),
    "simulated_r" DECIMAL(20,8),
    "htf_bias" INTEGER,
    "price_at_detect" DECIMAL(38,18),
    "payload" JSONB NOT NULL,
    "chart_attachment_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signal_events" (
    "id" UUID NOT NULL,
    "signal_id" UUID NOT NULL,
    "status" "SignalStatus" NOT NULL,
    "at" TIMESTAMPTZ(6) NOT NULL,
    "data" JSONB,

    CONSTRAINT "signal_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_decisions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "signal_id" UUID NOT NULL,
    "agent_id" UUID,
    "strategy_version_id" UUID NOT NULL,
    "action" "DecisionAction" NOT NULL,
    "confidence" DECIMAL(5,4),
    "proposed_entry" DECIMAL(38,18),
    "proposed_stop" DECIMAL(38,18),
    "proposed_takes" DECIMAL(38,18)[],
    "reasons" JSONB,
    "raw_output" JSONB,
    "schema_valid" BOOLEAN NOT NULL,
    "total_tokens" INTEGER,
    "total_cost_usd" DECIMAL(20,10),
    "telegram_message_id" BIGINT,
    "human_action" "DecisionAction",
    "human_user_id" UUID,
    "human_at" TIMESTAMPTZ(6),
    "decided_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "agent_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "llm_calls" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "decision_id" UUID,
    "ai_review_id" UUID,
    "note_id" UUID,
    "role" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "billing" "LlmBilling" NOT NULL,
    "prompt_version" TEXT,
    "prompt_hash" TEXT,
    "prompt" TEXT,
    "response" TEXT,
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "cache_tokens" INTEGER,
    "cost_usd" DECIMAL(20,10),
    "latency_ms" INTEGER,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "started_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "llm_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_policies" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "scope" "RiskScope" NOT NULL,
    "account_id" UUID,
    "agent_id" UUID,
    "cluster_id" UUID,
    "risk_per_trade_pct" DECIMAL(20,8),
    "daily_loss_pct" DECIMAL(20,8),
    "total_loss_pct" DECIMAL(20,8),
    "max_leverage" DECIMAL(20,8),
    "min_rr" DECIMAL(20,8),
    "loss_streak_pause" INTEGER,
    "max_open_positions" INTEGER,
    "whitelist" TEXT[],
    "extra" JSONB,
    "approved_by_id" UUID NOT NULL,
    "valid_from" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_to" TIMESTAMPTZ(6),

    CONSTRAINT "risk_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_evaluations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "agent_id" UUID,
    "signal_id" UUID,
    "decision_id" UUID,
    "risk_policy_id" UUID,
    "prop_profile_id" UUID,
    "verdict" "RiskVerdict" NOT NULL,
    "requested_qty" DECIMAL(38,18),
    "approved_qty" DECIMAL(38,18),
    "requested_leverage" DECIMAL(20,8),
    "approved_leverage" DECIMAL(20,8),
    "rule_codes" TEXT[],
    "explanation" TEXT,
    "snapshot" JSONB,
    "evaluated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "risk_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_events" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "scope" "RiskScope" NOT NULL,
    "account_id" UUID,
    "agent_id" UUID,
    "cluster_id" UUID,
    "trade_id" UUID,
    "kind" TEXT NOT NULL,
    "severity" "Severity" NOT NULL,
    "action_taken" TEXT,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "resolved_at" TIMESTAMPTZ(6),
    "resolved_by_id" UUID,

    CONSTRAINT "risk_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_jobs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "mode" TEXT NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'QUEUED',
    "streams" TEXT[],
    "requested_by" TEXT,
    "fetched" INTEGER NOT NULL DEFAULT 0,
    "inserted" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "duplicates" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "error_log" JSONB,
    "started_at" TIMESTAMPTZ(6),
    "finished_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_cursors" (
    "account_id" UUID NOT NULL,
    "stream" TEXT NOT NULL,
    "cursor" JSONB NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "import_cursors_pkey" PRIMARY KEY ("account_id","stream")
);

-- CreateTable
CREATE TABLE "raw_records" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "stream" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "first_job_id" UUID,
    "last_job_id" UUID,
    "first_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "raw_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" UUID NOT NULL,
    "queue" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "dedupe_key" TEXT,
    "run_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "locked_at" TIMESTAMPTZ(6),
    "locked_by" TEXT,
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(6),

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signal_sources" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "kind" "SignalSourceKind" NOT NULL,
    "name" TEXT NOT NULL,
    "handle" TEXT,
    "telegram_chat_id" BIGINT,
    "is_vip" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "signals_total" INTEGER NOT NULL DEFAULT 0,
    "signals_resolved" INTEGER NOT NULL DEFAULT 0,
    "win_rate" DECIMAL(20,8),
    "avg_r" DECIMAL(20,8),
    "expectancy_r" DECIMAL(20,8),
    "avg_delay_sec" INTEGER,
    "edited_count" INTEGER NOT NULL DEFAULT 0,
    "deleted_count" INTEGER NOT NULL DEFAULT 0,
    "rated_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "signal_sources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_telegram_user_id_key" ON "users"("telegram_user_id");

-- CreateIndex
CREATE INDEX "memberships_user_id_idx" ON "memberships"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_organization_id_user_id_key" ON "memberships"("organization_id", "user_id");

-- CreateIndex
CREATE INDEX "auth_identities_user_id_idx" ON "auth_identities"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "auth_identities_provider_provider_user_id_key" ON "auth_identities"("provider", "provider_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "api_tokens_token_hash_key" ON "api_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "api_tokens_organization_id_idx" ON "api_tokens"("organization_id");

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_at_idx" ON "audit_logs"("organization_id", "at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entity_id_idx" ON "audit_logs"("entity", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "venues_slug_key" ON "venues"("slug");

-- CreateIndex
CREATE INDEX "instruments_base_asset_idx" ON "instruments"("base_asset");

-- CreateIndex
CREATE UNIQUE INDEX "instruments_venue_id_symbol_kind_key" ON "instruments"("venue_id", "symbol", "kind");

-- CreateIndex
CREATE INDEX "prop_profiles_venue_id_idx" ON "prop_profiles"("venue_id");

-- CreateIndex
CREATE INDEX "prop_profiles_organization_id_idx" ON "prop_profiles"("organization_id");

-- CreateIndex
CREATE INDEX "accounts_organization_id_idx" ON "accounts"("organization_id");

-- CreateIndex
CREATE INDEX "accounts_user_id_idx" ON "accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_venue_id_external_account_id_key" ON "accounts"("venue_id", "external_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "exchange_credentials_account_id_key" ON "exchange_credentials"("account_id");

-- CreateIndex
CREATE INDEX "exchange_credentials_organization_id_idx" ON "exchange_credentials"("organization_id");

-- CreateIndex
CREATE INDEX "account_snapshots_organization_id_idx" ON "account_snapshots"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "account_snapshots_account_id_taken_at_key" ON "account_snapshots"("account_id", "taken_at");

-- CreateIndex
CREATE INDEX "orders_organization_id_placed_at_idx" ON "orders"("organization_id", "placed_at");

-- CreateIndex
CREATE INDEX "orders_trade_id_idx" ON "orders"("trade_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_account_id_external_order_id_key" ON "orders"("account_id", "external_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_account_id_client_order_id_key" ON "orders"("account_id", "client_order_id");

-- CreateIndex
CREATE INDEX "executions_organization_id_executed_at_idx" ON "executions"("organization_id", "executed_at");

-- CreateIndex
CREATE INDEX "executions_account_id_instrument_id_executed_at_idx" ON "executions"("account_id", "instrument_id", "executed_at");

-- CreateIndex
CREATE INDEX "executions_trade_id_idx" ON "executions"("trade_id");

-- CreateIndex
CREATE UNIQUE INDEX "executions_account_id_external_id_key" ON "executions"("account_id", "external_id");

-- CreateIndex
CREATE INDEX "trades_organization_id_closed_at_idx" ON "trades"("organization_id", "closed_at");

-- CreateIndex
CREATE INDEX "trades_organization_id_opened_at_idx" ON "trades"("organization_id", "opened_at");

-- CreateIndex
CREATE INDEX "trades_account_id_instrument_id_opened_at_idx" ON "trades"("account_id", "instrument_id", "opened_at");

-- CreateIndex
CREATE INDEX "trades_agent_id_idx" ON "trades"("agent_id");

-- CreateIndex
CREATE INDEX "trades_signal_id_idx" ON "trades"("signal_id");

-- CreateIndex
CREATE INDEX "trades_playbook_id_idx" ON "trades"("playbook_id");

-- CreateIndex
CREATE UNIQUE INDEX "trades_account_id_external_position_id_key" ON "trades"("account_id", "external_position_id");

-- CreateIndex
CREATE UNIQUE INDEX "trades_organization_id_idempotency_key_key" ON "trades"("organization_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "ledger_entries_organization_id_occurred_at_idx" ON "ledger_entries"("organization_id", "occurred_at");

-- CreateIndex
CREATE INDEX "ledger_entries_trade_id_idx" ON "ledger_entries"("trade_id");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_entries_account_id_kind_external_id_key" ON "ledger_entries"("account_id", "kind", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "playbooks_organization_id_name_key" ON "playbooks"("organization_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "rules_organization_id_code_key" ON "rules"("organization_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "tags_organization_id_name_key" ON "tags"("organization_id", "name");

-- CreateIndex
CREATE INDEX "trade_tags_tag_id_idx" ON "trade_tags"("tag_id");

-- CreateIndex
CREATE UNIQUE INDEX "notes_audio_attachment_id_key" ON "notes"("audio_attachment_id");

-- CreateIndex
CREATE INDEX "notes_organization_id_created_at_idx" ON "notes"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "notes_trade_id_idx" ON "notes"("trade_id");

-- CreateIndex
CREATE UNIQUE INDEX "notes_telegram_chat_id_telegram_message_id_key" ON "notes"("telegram_chat_id", "telegram_message_id");

-- CreateIndex
CREATE UNIQUE INDEX "attachments_storage_key_key" ON "attachments"("storage_key");

-- CreateIndex
CREATE INDEX "attachments_organization_id_created_at_idx" ON "attachments"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "attachments_trade_id_idx" ON "attachments"("trade_id");

-- CreateIndex
CREATE INDEX "attachments_sha256_idx" ON "attachments"("sha256");

-- CreateIndex
CREATE INDEX "daily_journals_organization_id_date_idx" ON "daily_journals"("organization_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_journals_user_id_date_key" ON "daily_journals"("user_id", "date");

-- CreateIndex
CREATE INDEX "daily_summaries_organization_id_date_idx" ON "daily_summaries"("organization_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_summaries_account_id_date_key" ON "daily_summaries"("account_id", "date");

-- CreateIndex
CREATE INDEX "ai_reviews_organization_id_created_at_idx" ON "ai_reviews"("organization_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "clusters_organization_id_slug_key" ON "clusters"("organization_id", "slug");

-- CreateIndex
CREATE INDEX "strategy_versions_organization_id_idx" ON "strategy_versions"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "strategy_versions_cluster_id_version_key" ON "strategy_versions"("cluster_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "strategy_versions_cluster_id_config_hash_key" ON "strategy_versions"("cluster_id", "config_hash");

-- CreateIndex
CREATE UNIQUE INDEX "agents_account_id_key" ON "agents"("account_id");

-- CreateIndex
CREATE INDEX "agents_organization_id_idx" ON "agents"("organization_id");

-- CreateIndex
CREATE INDEX "agents_cluster_id_idx" ON "agents"("cluster_id");

-- CreateIndex
CREATE INDEX "agents_experiment_id_idx" ON "agents"("experiment_id");

-- CreateIndex
CREATE INDEX "experiments_organization_id_idx" ON "experiments"("organization_id");

-- CreateIndex
CREATE INDEX "shadow_evaluations_organization_id_idx" ON "shadow_evaluations"("organization_id");

-- CreateIndex
CREATE INDEX "detector_runs_organization_id_started_at_idx" ON "detector_runs"("organization_id", "started_at");

-- CreateIndex
CREATE INDEX "signals_source_id_detected_at_idx" ON "signals"("source_id", "detected_at");

-- CreateIndex
CREATE INDEX "signals_organization_id_detected_at_idx" ON "signals"("organization_id", "detected_at");

-- CreateIndex
CREATE INDEX "signals_cluster_id_status_idx" ON "signals"("cluster_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "signals_strategy_version_id_instrument_id_timeframe_mode_si_key" ON "signals"("strategy_version_id", "instrument_id", "timeframe", "mode", "side", "setup_time");

-- CreateIndex
CREATE UNIQUE INDEX "signals_source_id_external_message_id_key" ON "signals"("source_id", "external_message_id");

-- CreateIndex
CREATE UNIQUE INDEX "signal_events_signal_id_status_key" ON "signal_events"("signal_id", "status");

-- CreateIndex
CREATE INDEX "agent_decisions_organization_id_decided_at_idx" ON "agent_decisions"("organization_id", "decided_at");

-- CreateIndex
CREATE INDEX "agent_decisions_signal_id_idx" ON "agent_decisions"("signal_id");

-- CreateIndex
CREATE INDEX "agent_decisions_agent_id_idx" ON "agent_decisions"("agent_id");

-- CreateIndex
CREATE INDEX "llm_calls_organization_id_started_at_idx" ON "llm_calls"("organization_id", "started_at");

-- CreateIndex
CREATE INDEX "llm_calls_decision_id_idx" ON "llm_calls"("decision_id");

-- CreateIndex
CREATE INDEX "llm_calls_model_started_at_idx" ON "llm_calls"("model", "started_at");

-- CreateIndex
CREATE INDEX "risk_policies_organization_id_scope_idx" ON "risk_policies"("organization_id", "scope");

-- CreateIndex
CREATE INDEX "risk_evaluations_organization_id_evaluated_at_idx" ON "risk_evaluations"("organization_id", "evaluated_at");

-- CreateIndex
CREATE INDEX "risk_evaluations_account_id_evaluated_at_idx" ON "risk_evaluations"("account_id", "evaluated_at");

-- CreateIndex
CREATE INDEX "risk_events_organization_id_occurred_at_idx" ON "risk_events"("organization_id", "occurred_at");

-- CreateIndex
CREATE INDEX "risk_events_kind_occurred_at_idx" ON "risk_events"("kind", "occurred_at");

-- CreateIndex
CREATE INDEX "import_jobs_organization_id_created_at_idx" ON "import_jobs"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "import_jobs_account_id_status_idx" ON "import_jobs"("account_id", "status");

-- CreateIndex
CREATE INDEX "raw_records_organization_id_idx" ON "raw_records"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "raw_records_account_id_stream_external_id_key" ON "raw_records"("account_id", "stream", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_dedupe_key_key" ON "jobs"("dedupe_key");

-- CreateIndex
CREATE INDEX "jobs_queue_status_run_at_idx" ON "jobs"("queue", "status", "run_at");

-- CreateIndex
CREATE INDEX "signal_sources_organization_id_active_idx" ON "signal_sources"("organization_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "signal_sources_organization_id_kind_name_key" ON "signal_sources"("organization_id", "kind", "name");

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_identities" ADD CONSTRAINT "auth_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instruments" ADD CONSTRAINT "instruments_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prop_profiles" ADD CONSTRAINT "prop_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prop_profiles" ADD CONSTRAINT "prop_profiles_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_prop_profile_id_fkey" FOREIGN KEY ("prop_profile_id") REFERENCES "prop_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_credentials" ADD CONSTRAINT "exchange_credentials_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_credentials" ADD CONSTRAINT "exchange_credentials_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_snapshots" ADD CONSTRAINT "account_snapshots_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_snapshots" ADD CONSTRAINT "account_snapshots_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_instrument_id_fkey" FOREIGN KEY ("instrument_id") REFERENCES "instruments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_trade_id_fkey" FOREIGN KEY ("trade_id") REFERENCES "trades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_decision_id_fkey" FOREIGN KEY ("decision_id") REFERENCES "agent_decisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_risk_evaluation_id_fkey" FOREIGN KEY ("risk_evaluation_id") REFERENCES "risk_evaluations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "executions" ADD CONSTRAINT "executions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "executions" ADD CONSTRAINT "executions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "executions" ADD CONSTRAINT "executions_instrument_id_fkey" FOREIGN KEY ("instrument_id") REFERENCES "instruments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "executions" ADD CONSTRAINT "executions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "executions" ADD CONSTRAINT "executions_trade_id_fkey" FOREIGN KEY ("trade_id") REFERENCES "trades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "executions" ADD CONSTRAINT "executions_raw_record_id_fkey" FOREIGN KEY ("raw_record_id") REFERENCES "raw_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_instrument_id_fkey" FOREIGN KEY ("instrument_id") REFERENCES "instruments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_strategy_version_id_fkey" FOREIGN KEY ("strategy_version_id") REFERENCES "strategy_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_signal_id_fkey" FOREIGN KEY ("signal_id") REFERENCES "signals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_decision_id_fkey" FOREIGN KEY ("decision_id") REFERENCES "agent_decisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_playbook_id_fkey" FOREIGN KEY ("playbook_id") REFERENCES "playbooks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_possible_duplicate_of_id_fkey" FOREIGN KEY ("possible_duplicate_of_id") REFERENCES "trades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_merged_into_id_fkey" FOREIGN KEY ("merged_into_id") REFERENCES "trades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_instrument_id_fkey" FOREIGN KEY ("instrument_id") REFERENCES "instruments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_trade_id_fkey" FOREIGN KEY ("trade_id") REFERENCES "trades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_raw_record_id_fkey" FOREIGN KEY ("raw_record_id") REFERENCES "raw_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playbooks" ADD CONSTRAINT "playbooks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playbooks" ADD CONSTRAINT "playbooks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rules" ADD CONSTRAINT "rules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rules" ADD CONSTRAINT "rules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rules" ADD CONSTRAINT "rules_playbook_id_fkey" FOREIGN KEY ("playbook_id") REFERENCES "playbooks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_rule_violations" ADD CONSTRAINT "trade_rule_violations_trade_id_fkey" FOREIGN KEY ("trade_id") REFERENCES "trades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_rule_violations" ADD CONSTRAINT "trade_rule_violations_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_tags" ADD CONSTRAINT "trade_tags_trade_id_fkey" FOREIGN KEY ("trade_id") REFERENCES "trades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_tags" ADD CONSTRAINT "trade_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_trade_id_fkey" FOREIGN KEY ("trade_id") REFERENCES "trades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_audio_attachment_id_fkey" FOREIGN KEY ("audio_attachment_id") REFERENCES "attachments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_trade_id_fkey" FOREIGN KEY ("trade_id") REFERENCES "trades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "notes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_journals" ADD CONSTRAINT "daily_journals_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_journals" ADD CONSTRAINT "daily_journals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_summaries" ADD CONSTRAINT "daily_summaries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_summaries" ADD CONSTRAINT "daily_summaries_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_reviews" ADD CONSTRAINT "ai_reviews_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_reviews" ADD CONSTRAINT "ai_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_reviews" ADD CONSTRAINT "ai_reviews_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_reviews" ADD CONSTRAINT "ai_reviews_trade_id_fkey" FOREIGN KEY ("trade_id") REFERENCES "trades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clusters" ADD CONSTRAINT "clusters_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strategy_versions" ADD CONSTRAINT "strategy_versions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strategy_versions" ADD CONSTRAINT "strategy_versions_cluster_id_fkey" FOREIGN KEY ("cluster_id") REFERENCES "clusters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strategy_versions" ADD CONSTRAINT "strategy_versions_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "strategy_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_cluster_id_fkey" FOREIGN KEY ("cluster_id") REFERENCES "clusters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_strategy_version_id_fkey" FOREIGN KEY ("strategy_version_id") REFERENCES "strategy_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_experiment_id_fkey" FOREIGN KEY ("experiment_id") REFERENCES "experiments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experiments" ADD CONSTRAINT "experiments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shadow_evaluations" ADD CONSTRAINT "shadow_evaluations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shadow_evaluations" ADD CONSTRAINT "shadow_evaluations_candidate_version_id_fkey" FOREIGN KEY ("candidate_version_id") REFERENCES "strategy_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shadow_evaluations" ADD CONSTRAINT "shadow_evaluations_baseline_version_id_fkey" FOREIGN KEY ("baseline_version_id") REFERENCES "strategy_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detector_runs" ADD CONSTRAINT "detector_runs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detector_runs" ADD CONSTRAINT "detector_runs_strategy_version_id_fkey" FOREIGN KEY ("strategy_version_id") REFERENCES "strategy_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detector_runs" ADD CONSTRAINT "detector_runs_instrument_id_fkey" FOREIGN KEY ("instrument_id") REFERENCES "instruments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detector_runs" ADD CONSTRAINT "detector_runs_chart_attachment_id_fkey" FOREIGN KEY ("chart_attachment_id") REFERENCES "attachments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signals" ADD CONSTRAINT "signals_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signals" ADD CONSTRAINT "signals_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "signal_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signals" ADD CONSTRAINT "signals_cluster_id_fkey" FOREIGN KEY ("cluster_id") REFERENCES "clusters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signals" ADD CONSTRAINT "signals_strategy_version_id_fkey" FOREIGN KEY ("strategy_version_id") REFERENCES "strategy_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signals" ADD CONSTRAINT "signals_detector_run_id_fkey" FOREIGN KEY ("detector_run_id") REFERENCES "detector_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signals" ADD CONSTRAINT "signals_instrument_id_fkey" FOREIGN KEY ("instrument_id") REFERENCES "instruments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signals" ADD CONSTRAINT "signals_chart_attachment_id_fkey" FOREIGN KEY ("chart_attachment_id") REFERENCES "attachments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signal_events" ADD CONSTRAINT "signal_events_signal_id_fkey" FOREIGN KEY ("signal_id") REFERENCES "signals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_decisions" ADD CONSTRAINT "agent_decisions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_decisions" ADD CONSTRAINT "agent_decisions_signal_id_fkey" FOREIGN KEY ("signal_id") REFERENCES "signals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_decisions" ADD CONSTRAINT "agent_decisions_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_decisions" ADD CONSTRAINT "agent_decisions_strategy_version_id_fkey" FOREIGN KEY ("strategy_version_id") REFERENCES "strategy_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_calls" ADD CONSTRAINT "llm_calls_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_calls" ADD CONSTRAINT "llm_calls_decision_id_fkey" FOREIGN KEY ("decision_id") REFERENCES "agent_decisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_calls" ADD CONSTRAINT "llm_calls_ai_review_id_fkey" FOREIGN KEY ("ai_review_id") REFERENCES "ai_reviews"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_calls" ADD CONSTRAINT "llm_calls_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "notes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_policies" ADD CONSTRAINT "risk_policies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_policies" ADD CONSTRAINT "risk_policies_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_policies" ADD CONSTRAINT "risk_policies_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_policies" ADD CONSTRAINT "risk_policies_cluster_id_fkey" FOREIGN KEY ("cluster_id") REFERENCES "clusters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_evaluations" ADD CONSTRAINT "risk_evaluations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_evaluations" ADD CONSTRAINT "risk_evaluations_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_evaluations" ADD CONSTRAINT "risk_evaluations_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_evaluations" ADD CONSTRAINT "risk_evaluations_signal_id_fkey" FOREIGN KEY ("signal_id") REFERENCES "signals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_evaluations" ADD CONSTRAINT "risk_evaluations_decision_id_fkey" FOREIGN KEY ("decision_id") REFERENCES "agent_decisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_evaluations" ADD CONSTRAINT "risk_evaluations_risk_policy_id_fkey" FOREIGN KEY ("risk_policy_id") REFERENCES "risk_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_evaluations" ADD CONSTRAINT "risk_evaluations_prop_profile_id_fkey" FOREIGN KEY ("prop_profile_id") REFERENCES "prop_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_events" ADD CONSTRAINT "risk_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_events" ADD CONSTRAINT "risk_events_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_events" ADD CONSTRAINT "risk_events_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_events" ADD CONSTRAINT "risk_events_cluster_id_fkey" FOREIGN KEY ("cluster_id") REFERENCES "clusters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_events" ADD CONSTRAINT "risk_events_trade_id_fkey" FOREIGN KEY ("trade_id") REFERENCES "trades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_cursors" ADD CONSTRAINT "import_cursors_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_records" ADD CONSTRAINT "raw_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_records" ADD CONSTRAINT "raw_records_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_records" ADD CONSTRAINT "raw_records_first_job_id_fkey" FOREIGN KEY ("first_job_id") REFERENCES "import_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_records" ADD CONSTRAINT "raw_records_last_job_id_fkey" FOREIGN KEY ("last_job_id") REFERENCES "import_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signal_sources" ADD CONSTRAINT "signal_sources_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
