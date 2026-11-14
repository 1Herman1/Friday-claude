# Primary sources and live observations

Retrieved during the live run on 2026-11-14 UTC (local session date: 2026-11-15 MSK).

## Official sources

- BingX official API documentation: https://bingx-api.github.io/docs/#/swapV2/introduce
- Official documentation repository redirect, downloaded as `evidence/official-docs-readme.md`: https://raw.githubusercontent.com/BingX-API/BingX-swap-api-doc/master/README.md
- BingX official market-data API reference, downloaded as `evidence/official-api-reference.md`: https://raw.githubusercontent.com/BingX-API/api-ai-skills/main/skills/swap-market/api-reference.md
- Official primary/fallback host list, downloaded as `evidence/official-base-urls.md`: https://raw.githubusercontent.com/BingX-API/api-ai-skills/main/skills/references/base-urls.md

## Public GET endpoints actually exercised

Primary host: `https://open-api.bingx.com`.
Fallback `.pro` was probed successfully during discovery but is not used by this MVP.
All paths below start with `/openApi/swap/v2/quote/`.

- `contracts` without symbol: all perpetual contract specifications. `status == 1`, settlement `currency == USDT` and `-USDT` suffix define the universe. Do not silently use ticker rows as the contract universe.
- `ticker` without symbol: bulk rolling-24h prices, percentage price change, base volume and quote turnover. Quote turnover is USDT, not base quantity. `priceChangePercent` is already percent, not a decimal fraction.
- `premiumIndex` without symbol: bulk funding/mark/index data. Funding `lastFundingRate` is a decimal; `fundingIntervalHours` is returned per contract. Snapshot preserves update and next-settlement timestamps. No annualization.
- `openInterest?symbol=...`: per-contract only (symbol required in official docs, documented 1 request/s/IP). The reference labels OI as base asset, but live BTC value was ~627 million at a ~65k price: units were not independently reconciled. Hence `oi_unit=exchange_native_unverified`; do NOT multiply by price or compare notionals across contracts. Missing OI is null.
- `trades?symbol=...&limit=1000`: recent sampled executions. Live response uses `isBuyerMaker`, `fillId`, `time`, `quoteQty`; reference mentions `buyerMaker` and `id`. Both maker-field variants are supported. `isBuyerMaker == false` is taker buy. Window start/end are measured from returned trades, not presumed fixed. During the initial probe, `limit=3` still returned a much larger batch: do not assume limit is enforced. Dedupe returned trade identifiers. Buy quote share is NOT market-wide buying, capital inflow, or accumulation.

Documented ticker/contracts/trades/OI quotas: 1/s per endpoint/IP. This single-process client spaces calls to each endpoint by at least 1.05 s, including retries. It does not coordinate quotas with unrelated processes. Funding has a higher documented quota; MVP still uses conservative spacing. Every request: connect deadline 8 s, total curl deadline 25 s, parent subprocess deadline 27 s, bounded retries (default 1). TLS verification is enabled; curl configuration is disabled and redirects are not followed.

## Evidence

- Initial successful response bodies: `evidence/probe_*.json`.
- Final live normalized snapshot + timestamped raw bodies: `artifacts/20261114T214901Z/`.
- Request attempts, failures and timestamps: `snapshot.json` → `request_audit`.
- CLI output: `evidence/live-cli-result.json`.
- Independent universe/raw/HTML checks: `evidence/verification.json`.

No authentication, private account endpoints, POST requests, orders or transfers were used. No source claims are a profitability claim or recommendation to trade.
