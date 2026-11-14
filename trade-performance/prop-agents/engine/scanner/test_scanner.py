import unittest
from decimal import Decimal
import scanner


class UniverseTests(unittest.TestCase):
    def test_all_active_usdt_even_when_ticker_missing(self):
        contracts = [{"symbol": "A-USDT", "status": 1, "currency": "USDT"},
                     {"symbol": "B-USDT", "status": 1, "currency": "USDT"},
                     {"symbol": "C-USDT", "status": 25, "currency": "USDT"}]
        result = scanner.build_snapshot(contracts, [{"symbol": "A-USDT", "lastPrice": "1", "priceChangePercent": "25", "quoteVolume": "100"}], [], {}, "2026-11-14T22:00:00+00:00")
        self.assertEqual(result["coverage"]["universe_count"], 2)
        self.assertEqual(result["coverage"]["ticker_missing"], ["B-USDT"])
        self.assertIsNone(result["markets"][1]["last_price"])
        self.assertIn("pump_24h_threshold", result["markets"][0]["flags"])
        self.assertIsNone(result["markets"][0]["volume_anomaly"])
        self.assertEqual(result["markets"][0]["history_status"], "not_collected")
        self.assertIsNone(result["markets"][0]["open_interest"])
        self.assertIsNone(result["markets"][0]["funding_rate"])


class PublicClientTests(unittest.TestCase):
    def test_only_allowlisted_get_endpoints(self):
        client = scanner.PublicClient()
        with self.assertRaises(ValueError):
            client.get('order')
        with self.assertRaises(ValueError):
            client.get('ticker', {'signature': 'not-allowed'})

    def test_curl_has_hard_deadline_and_no_credentials(self):
        import json
        from unittest.mock import patch
        from subprocess import CompletedProcess
        with patch('scanner.subprocess.run', return_value=CompletedProcess([], 0, '{"code":0,"data":[]}', '')) as run:
            self.assertEqual(scanner.PublicClient().get('ticker'), [])
            args = run.call_args
            self.assertEqual(args[0][0][1], '--disable')
            self.assertIn('--max-time', args[0][0])
            self.assertIn('--connect-timeout', args[0][0])
            self.assertEqual(args[1]['timeout'], 27)
            self.assertNotIn('-H', args[0][0])

    def test_api_error_is_not_empty_market(self):
        from unittest.mock import patch
        from subprocess import CompletedProcess
        with patch('scanner.subprocess.run', return_value=CompletedProcess([], 0, '{"code":100001,"msg":"bad"}', '')):
            with self.assertRaises(RuntimeError):
                scanner.PublicClient(retries=0).get('ticker')


class EnrichmentTests(unittest.TestCase):
    def test_volume_outlier_is_cross_sectional_not_history(self):
        contracts = [{'symbol': '%s-USDT' % x, 'status': 1, 'currency': 'USDT'} for x in range(5)]
        tickers = [{'symbol': x['symbol'], 'quoteVolume': str(v), 'lastPrice': '1', 'priceChangePercent': '0'} for x, v in zip(contracts, [10, 10, 10, 10, 1000])]
        result = scanner.build_snapshot(contracts, tickers, [], {}, '2026-11-14T22:00:00+00:00')
        self.assertIn('high_cross_sectional_turnover', result['markets'][-1]['flags'])
        self.assertIsNone(result['markets'][-1]['volume_anomaly'])
        self.assertEqual(result['markets'][-1]['volume_vs_universe_median'], '100')

    def test_trade_flow_uses_live_buyer_maker_field(self):
        result = scanner.trade_flow([{'isBuyerMaker': False, 'quoteQty': '30', 'time': 1000},
                                     {'isBuyerMaker': True, 'quoteQty': '10', 'time': 2000},
                                     {'quoteQty': '99', 'time': 2000}])
        self.assertEqual(result['taker_buy_quote'], '30')
        self.assertEqual(result['taker_buy_fraction'], '0.75')
        self.assertEqual(result['unclassified_trades'], 1)
        self.assertEqual(result['window_ms'], [1000, 2000])
        self.assertIsNone(scanner.trade_flow([])['taker_buy_fraction'])

    def test_unknown_and_nonfinite_are_never_zero(self):
        for value in (None, '', 'nan', 'inf', 'not a number'):
            self.assertIsNone(scanner.number(value))
        self.assertEqual(scanner.number('0'), Decimal('0'))

    def test_report_contains_all_rows_and_escaped_content(self):
        report = scanner.render_report({'generated_at': '<script>', 'coverage': {'universe_count': 1}, 'failures': [], 'markets': [{'symbol': '<bad>', 'flags': []}]})
        self.assertIn('&lt;bad&gt;', report)
        self.assertNotIn('<bad>', report)
        self.assertIn('unknown', report)


class CollectionTests(unittest.TestCase):
    class FakeClient:
        audit = []
        def get(self, endpoint, params=None):
            if endpoint == 'contracts':
                return [{'symbol': 'A-USDT', 'status': 1, 'currency': 'USDT'}, {'symbol': 'B-USDT', 'status': 1, 'currency': 'USDT'}]
            if endpoint == 'ticker':
                return [{'symbol': 'A-USDT', 'lastPrice': '1', 'priceChangePercent': '21', 'quoteVolume': '100'}]
            if endpoint == 'premiumIndex':
                raise RuntimeError('funding unavailable')
            if endpoint == 'openInterest':
                return {'symbol': params['symbol'], 'openInterest': '7', 'time': 1}
            if endpoint == 'trades':
                return [{'isBuyerMaker': False, 'quoteQty': '30', 'time': 1}]

    def test_partial_enrichment_has_explicit_coverage_and_failures(self):
        result, raw = scanner.collect(self.FakeClient(), oi_limit=1, flow_limit=1)
        self.assertEqual(result['coverage']['universe_count'], 2)
        self.assertEqual(result['coverage']['oi_attempted'], 1)
        self.assertEqual(result['coverage']['oi_not_requested_count'], 1)
        self.assertEqual(result['coverage']['funding_present'], 0)
        self.assertEqual(result['coverage']['buy_flow_present'], 1)
        self.assertTrue(any(f['endpoint'] == 'premiumIndex' for f in result['failures']))
        self.assertTrue(any(f['endpoint'] == 'ticker' for f in result['failures']))
        self.assertIn('contracts', raw)
        self.assertEqual(result['status'], 'partial')

    def test_cli_artifacts_match_snapshot(self):
        from pathlib import Path
        import tempfile
        import json
        result, raw = scanner.collect(self.FakeClient(), oi_limit=0, flow_limit=0)
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as directory:
            paths = scanner.save_artifacts(result, raw, Path(directory))
            self.assertEqual(json.loads(paths['snapshot'].read_text())['coverage']['universe_count'], 2)
            self.assertIn('A-USDT', paths['report'].read_text())
            self.assertTrue(paths['raw'].exists())

    def test_contracts_without_usable_usdt_universe_are_fatal(self):
        class NoUSDT(self.FakeClient):
            def get(self, endpoint, params=None):
                return [{'symbol': 'X-USD', 'status': 1, 'currency': 'USD'}] if endpoint == 'contracts' else super().get(endpoint, params)
        result, _ = scanner.collect(NoUSDT(), oi_limit=0, flow_limit=0)
        self.assertEqual(result['status'], 'failed')

    def test_malformed_trade_rows_are_explicit_failure(self):
        class Malformed(self.FakeClient):
            def get(self, endpoint, params=None):
                return ['bad row'] if endpoint == 'trades' else super().get(endpoint, params)
        result, _ = scanner.collect(Malformed(), oi_limit=0, flow_limit=1)
        self.assertTrue(any(f['endpoint'] == 'trades' for f in result['failures']))

    def test_missing_universe_is_fatal_not_successful_empty_scan(self):
        class Broken:
            audit = []
            def get(self, endpoint, params=None):
                raise RuntimeError('offline')
        result, raw = scanner.collect(Broken(), oi_limit=0, flow_limit=0)
        self.assertEqual(result['status'], 'failed')
        self.assertIsNone(result['coverage']['universe_count'])


if __name__ == "__main__":
    unittest.main()
