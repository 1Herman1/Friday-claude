import unittest
from decimal import Decimal as D
import probe


class ProbeTests(unittest.TestCase):
    def test_vwap_consumes_actual_depth_exactly(self):
        self.assertEqual(probe.vwap([["100", "0.1"], ["101", "0.2"]], D("0.3")), D("100.6666666666666666666666667"))
        with self.assertRaisesRegex(ValueError, "depth"):
            probe.vwap([["100", "0.1"]], D("0.2"))

    def test_comparison_uses_ask_buy_bid_sell_and_never_approves(self):
        buy = {"asks": [["100", "1"], ["102", "2"]], "bids": [["99", "3"]], "ts": 10000}
        sell = {"asks": [["106", "3"]], "bids": [["105", "1"], ["103", "2"]], "ts": 10100}
        r = probe.compare(buy, sell, D("2"), 10200, None, None)
        self.assertEqual(r["buy_vwap"], D("101"))
        self.assertEqual(r["sell_vwap"], D("104"))
        self.assertEqual(r["gross_entry_quote"], D("6"))
        self.assertEqual(r["top_spread_bps"], D("500"))
        self.assertEqual(r["status"], "HOLD")
        self.assertIn("FEES_UNKNOWN", r["blockers"])
        r = probe.compare(buy, sell, D("2"), 10200, D("0.001"), D("0.002"))
        self.assertEqual(r["entry_fee_quote"], D("0.618"))
        self.assertEqual(r["entry_after_fees_quote"], D("5.382"))
        self.assertIn("NOT_EXECUTABLE_SNAPSHOT", r["blockers"])
    def test_staleness_skew_and_clock_error_fail_closed(self):
        b = {"asks": [["100", "2"]], "bids": [["99", "2"]], "ts": 10000}
        s = dict(b, ts=12000)
        r = probe.compare(b, s, D("1"), 20000)
        self.assertIn("STALE_BOOK", r["blockers"])
        self.assertIn("BOOK_SKEW", r["blockers"])
        r = probe.compare(b, s, D("1"), 5000)
        self.assertIn("FUTURE_TIMESTAMP_OR_CLOCK_ERROR", r["blockers"])

    def test_funding_normalizes_only_explicit_known_intervals(self):
        self.assertEqual(probe.funding(D("0.0008"), 8)["rate_per_hour"], D("0.0001"))
        self.assertIsNone(probe.funding(D("0.0008"), None)["rate_per_hour"])
        self.assertIsNone(probe.funding(D("0.0008"), 0)["rate_per_hour"])

    def test_raw_json_numbers_and_book_quantities_are_decimal(self):
        raw = probe.loads('{"code":"00000","data":{"a":[[100.10,0.02]],"b":[[99.90,0.03]],"ts":"10000"}}')
        b = probe.book("bitget", raw)
        self.assertIsInstance(b["asks"][0][0], D)
        self.assertEqual(b["asks"][0][1], D("0.02"))
        self.assertEqual(b["ts"], 10000)
        with self.assertRaisesRegex(ValueError, "API"):
            probe.book("bitget", {"code": "40000", "data": {}})
    def test_depth_requests_respect_documented_bingx_one_per_second(self):
        import time
        stamps = []
        def unavailable(url):
            if 'bingx.com' in url and '/depth?' in url:
                stamps.append(time.monotonic())
            return {"url": url, "error": "unavailable", "raw": None, "received_ms": 10000}
        probe.run_probe(unavailable, {"BTC": D("0.01"), "ETH": D("0.1")}, {}, now_ms=10000)
        self.assertGreaterEqual(stamps[1]-stamps[0], 1)

    def test_report_collects_partial_failures_without_synthetic_books(self):
        def unavailable(url):
            return {"url": url, "error": "network unavailable", "raw": None, "received_ms": 10000}
        r = probe.run_probe(unavailable, {"BTC": D("0.01"), "ETH": D("0.1")}, {}, now_ms=10000)
        self.assertEqual(len(r["instruments"]), 2)
        self.assertEqual(r["status"], "HOLD")
        self.assertTrue(r["errors"])
        for instrument in r["instruments"]:
            self.assertFalse(instrument["identity_verified"])
            self.assertEqual(instrument["comparisons"], [])
    def test_funding_provenance_distinguishes_update_from_settlement(self):
        import runner
        from pathlib import Path
        r = probe.loads((Path(__file__).parent / "fixture_public.json").read_text())
        replay = runner.run_probe(lambda url: next(v for v in r["requests"].values() if v["url"] == url),
                                 {"BTC": D("0.01"), "ETH": D("0.1")}, {}, now_ms=r["evaluated_at_ms"])
        for i in replay["instruments"]:
            self.assertEqual(i["funding"]["bitget"]["next_time_semantics"], "funding_rate_next_update_not_guaranteed_settlement")
            self.assertIn("source_age_ms", i["funding"]["bingx"])
    def test_book_and_funding_reject_nonfinite_and_negative_depth(self):
        for price, qty in (("NaN", "1"), ("100", "-1"), ("-1", "2")):
            raw = {"code":"00000", "data":{"a":[[price,qty]], "b":[["99","1"]], "ts":"10000"}}
            with self.assertRaises(ValueError):
                probe.book("bitget", raw)
        with self.assertRaises(ValueError):
            probe.funding(D("NaN"), 8)


if __name__ == "__main__":
    unittest.main()
