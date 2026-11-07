# SMC Telegram monitor audit — 2026-11-08, MSK

## Scope and evidence

User requested a short operating report, an explanation of low signal frequency, and migration to SMC v0.3 discussed in Т1. Audit used local cron job `2632e3d7c432`, `clusters/smc-btc/out/seen.json`, `setups_live.json`, config/source, Hermes state.db cron sessions and Т1 conversation history. No strategy or risk parameters changed in this audit.

## Operating period vs historical replay

- Job created 2026-10-10 01:51:54 MSK; inspected 2026-11-08 ~00:09 MSK. This is a calendar interval, NOT verified continuous uptime.
- Live deduplication state contains **21 unique registered pending candidates: 8 long, 13 short**, signal dates 12 October–6 November (UTC). About 0.73 registered candidates per calendar day since job creation. `seen` is not a delivery receipt and does not include every historical setup.
- Hermes DB contains **11 generated signal reviews: 5 TAKE, 6 SKIP**, plus one startup/no-fresh-signals response. Successful Telegram receipt of all reviews is not independently established. The difference between 21 registered candidates and 11 stored reviews must not be called 10 proven delivery failures without further evidence.
- Rolling historical replay, 24 October ~21:05 UTC–7 November 21:00 UTC: **17 setups; 3 win, 7 loss, 6 cancelled before fill, 1 expired, zero open/pending**. Closed trades = 10; WR 30%; gross result −1R at fixed 2R take-profit, before fees/slippage/funding. These are retrospective detector simulations, NOT the results of the five LLM TAKE decisions and NOT a full-lifetime report.
- Current live config remains **v0.1, BTCUSDT, MEXC spot candles, 5m, 1h EMA50 filter**. No execution/trading is enabled.

## Why candidates/messages are few

1. One instrument, one model: confirmed swing (3 bars each side) → wick sweep → CHoCH within 24 bars → qualifying FVG (minimum 0.03%) → HTF alignment → stop distance 0.10–0.80%.
2. `--live` only emits setups still pending at a polling run. A setup filled or cancelled between polls is not emitted. Frequency of these misses is not measured by this audit.
3. EMA and setup conditions reduce eligible candidates; exact per-filter attrition is not recorded and must not be invented.
4. LLM reviews can reject candidates (6/11 stored reviews).
5. A real model-auth failure is recorded at 2026-11-06 15:59:37 MSK (missing Anthropic credential). On 8 November, a separate test of gpt-6.1-sol/openai-codex returned SMC_MODEL_OK and the job was explicitly pinned to that provider/model. A subsequent monitor run succeeded, no fresh setup, no model invocation required.
6. Reliability defect identified in code: detector writes keys to seen before LLM review/delivery; monitor emits only the latest key; unchanged key suppresses a retry. A failed review can therefore be permanently skipped. Do not confuse a no-change monitor status with end-to-end model/delivery health.
7. Historical review from 23 October itself reports ~16 minutes between detection and analysis. Earlier chat's claim that all apparent latency was just UTC/MSK was incomplete. Market-close timestamp, detected_at, review time, delivery time must be distinguished.

## v0.3 recovery and deployment gate

- Found existing `engine/backtest/smc_v02.py` and `reports/backtests/2026-10-27/SMC-v02.md`, not a finished v0.3 implementation.
- Т1 assistant proposed v0.3 as v0.2 plus HTF premium/discount and an unmitigated 4h/D FVG or OB zone. No complete numerical rule card or completed implementation was found.
- Т1 user reply of 29 October requested stop beyond swept liquidity, fee explanation, full v0.3 rules and per-trade diagnostics; the following response was an unprocessed-request error. Do not describe this as an already approved/finished v0.3.
- Known v0.2 framework: 15m sweep / 5m IFVG entry or 1h sweep / 15m entry; session/previous-day/previous-week/confirmed-swing liquidity; stop beyond sweep extreme; TP1 2R on half, break-even remainder, TP2 next liquidity/imbalance (otherwise full exit at 2R). NY/crypto/all window variants were tested separately.
- Before replacing the signal strategy, confirm the v0.3 numerical card/variant with the user; do not relabel v0.1 as v0.3 or invent agreed HTF-zone rules. Existing v0.1 demo monitor remains active meanwhile. Next implementation must include durable pending delivery/retry, candle freshness/entry-staleness checks, versioned keys, MSK display, and skip-reason records; then replay tests and forward demo, without real orders.
