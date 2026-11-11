"""Synthetic detector fixtures only; never exchange or performance evidence."""
import importlib.util
from pathlib import Path
import unittest

import pandas as pd

MODULE = Path(__file__).resolve().parents[1] / 'clusters/smc-btc/v03_preview.py'


def load_module():
    spec = importlib.util.spec_from_file_location('v03_preview', MODULE)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def fixture():
    index = pd.date_range('2026-01-05', periods=12, freq='15min', tz='UTC')
    # Upward FVG: bar 2 low=102 > bar 0 high=101. Sweep at hour 1.
    rows = [(100,101,99,100), (101,104,100,103), (103,105,102,104),
            (104,106,103,105), (105,108,104,106), (106,110,104,106),
            (106,107,103,105), (105,106,102,104), (104,105,99,100),
            (100,102,98,101), (101,103,99,102), (102,104,100,103)]
    return pd.DataFrame(rows, columns=list('ohlc'), index=index)


class PreviewTests(unittest.TestCase):
    def test_hourly_sweep_then_ifvg_close_uses_excursion_stop(self):
        self.assertTrue(MODULE.exists(), 'Missing standalone preview detector')
        m = load_module()
        result = m.evaluate_setup(fixture(), pd.Timestamp('2026-01-05T01:00Z'),
                                  {'price':109., 'kind':'pd', 'side':'hi'})
        self.assertEqual(result['reason'], 'IFVG_CLOSE')
        self.assertEqual(result['entry'], 100.)
        self.assertEqual(result['entry_time'], '2026-01-05T02:15:00+00:00')
        self.assertGreater(result['sl'], 110.)
        self.assertEqual(result['sweep_extreme'], 110.)
        self.assertAlmostEqual(result['tp1'], 80.)
        self.assertFalse(result['production_eligible'])
        self.assertIn('UNAPPROVED_CONTEXT', result['warnings'])

    def test_close_already_below_gap_is_not_a_new_ifvg_cross(self):
        data = fixture()
        data.iloc[7] = (100, 106, 99, 100)
        data.iloc[8] = (100, 105, 99, 100)
        result = load_module().evaluate_setup(data, data.index[4],
                                             {'price':109., 'kind':'pd', 'side':'hi'})
        self.assertEqual(result['reason'], 'PENDING_IFVG')

    def test_closed_complete_aggregates_exclude_partial_hours(self):
        m = load_module()
        self.assertTrue(hasattr(m, 'closed_candles'), 'Missing candle validation')
        data = fixture()
        closed = m.closed_candles(data, pd.Timestamp('2026-01-05T02:35Z'), min_bars=8)
        self.assertEqual(len(closed), 10)
        hours = m.complete_bars(closed, '1h')
        self.assertEqual(list(hours.index), list(data.index[[0, 4]]))
        with self.assertRaisesRegex(ValueError, 'GAP'):
            m.closed_candles(data.drop(data.index[2]), data.index[-1] + m.STEP, min_bars=8)
        with self.assertRaisesRegex(ValueError, 'WARMUP'):
            m.closed_candles(data.iloc[:3], data.index[-1] + m.STEP, min_bars=8)

    def test_replay_has_stable_causal_candidates_and_opposite_tp2(self):
        m = load_module()
        self.assertTrue(hasattr(m, 'replay'), 'Missing causal preview replay')
        prefix = pd.DataFrame([(105,109,70,105)] * 768, columns=list('ohlc'),
                              index=pd.date_range('2025-12-28', periods=768, freq='15min', tz='UTC'))
        data = pd.concat([prefix, fixture()])
        report = m.replay(data, symbol='BTCUSDT', variant='all', as_of=data.index[-1] + m.STEP)
        found = [r for r in report['candidates'] if r['reason'] == 'IFVG_CLOSE' and r['level']['kind'] == 'pd']
        self.assertEqual(len(found), 1)
        self.assertEqual(found[0]['tp2'], 70.)
        self.assertEqual(found[0]['tp1_fraction'], .5)
        cut = fixture().index[8] + m.STEP
        earlier = m.replay(data, symbol='BTCUSDT', variant='all', as_of=cut)
        old = [r for r in earlier['candidates'] if r['key'] == found[0]['key']]
        self.assertEqual(old, found)
        self.assertEqual(report['counts']['production_eligible'], 0)
        self.assertEqual(report['counts']['total'], len(report['candidates']))
        self.assertIn('UNAPPROVED_CONTEXT', report['deployment_blockers'])
        self.assertTrue(m.verify_prefixes(data, 'BTCUSDT', 'all', [cut])['passed'])

    def test_cli_replay_saves_isolated_report_and_refuses_live_out(self):
        m = load_module()
        self.assertTrue(hasattr(m, 'main'), 'Missing read-only CLI')
        import json
        import os
        import tempfile
        from contextlib import redirect_stdout
        from io import StringIO
        with tempfile.TemporaryDirectory(dir=os.environ.get('TMPDIR')) as directory:
            root = Path(directory)
            prefix = pd.DataFrame([(105,109,70,105)] * 768, columns=list('ohlc'),
                                  index=pd.date_range('2025-12-28', periods=768, freq='15min', tz='UTC'))
            data = pd.concat([prefix, fixture()])
            source = root / 'synthetic-test-only.json'
            source.write_text(json.dumps({'venue':'MEXC_SPOT', 'symbol':'BTCUSDT',
                              'provenance':'SYNTHETIC_TEST_ONLY', 'candles':[
                                  dict(t=t.isoformat(), **row.to_dict()) for t, row in data.iterrows()]}))
            with redirect_stdout(StringIO()):
                m.main(['--input', str(source), '--variant', 'all', '--output-dir', str(root / 'isolated'),
                        '--as-of', '2026-01-05T03:00Z', '--verify-prefix'])
            report = json.loads((root / 'isolated/report.json').read_text())
            self.assertEqual(report['source']['provenance'], 'SYNTHETIC_TEST_ONLY')
            self.assertEqual(report.get('parameters', {}).get('htf_context', {}).get('status'), 'UNAPPROVED_CONTEXT')
            self.assertTrue(report['prefix_verification']['passed'])
            self.assertIn('2026-01-05T02:15:00+00:00',
                          [check['cut'] for check in report['prefix_verification']['checks']])
            with self.assertRaisesRegex(ValueError, 'PRODUCTION_OUTPUT_FORBIDDEN'):
                m.main(['--input', str(source), '--variant', 'all', '--output-dir', str(MODULE.parent / 'out')])

    def test_outside_window_rejection_never_contains_future_ifvg_fields(self):
        m = load_module()
        prefix = pd.DataFrame([(105,109,70,105)] * 768, columns=list('ohlc'),
                              index=pd.date_range('2025-12-28', periods=768, freq='15min', tz='UTC'))
        data = pd.concat([prefix, fixture()])
        report = m.replay(data, 'BTCUSDT', 'crypto', data.index[-1] + m.STEP)
        row = [r for r in report['candidates'] if r['level']['kind'] == 'pd'][0]
        self.assertEqual(row['reason'], 'OUTSIDE_PROPOSED_WINDOW')
        self.assertNotIn('fvg_formed_close', row)
        self.assertTrue(m.verify_prefixes(data, 'BTCUSDT', 'crypto', [fixture().index[8]])['passed'])

    def test_sweep_extreme_is_recorded_for_cancelled_candidate(self):
        m = load_module()
        data = fixture()
        data.iloc[8] = (104, 113, 103, 111)
        row = m.evaluate_setup(data, data.index[4], {'price':109., 'kind':'pd', 'side':'hi'})
        self.assertEqual(row['reason'], 'BODY_BACK_BEYOND_LEVEL')
        self.assertEqual(row.get('sweep_extreme'), 113.)
        self.assertIsNone(row['entry'])

    def test_long_mirror_records_gap_bounds_and_post_sweep_excursion(self):
        m = load_module()
        source = fixture()
        data = pd.DataFrame({'o':210-source.o, 'h':210-source.l,
                             'l':210-source.h, 'c':210-source.c})
        data.iloc[8, data.columns.get_loc('l')] = 97.
        row = m.evaluate_setup(data, data.index[4], {'price':101., 'kind':'pd', 'side':'lo'})
        self.assertEqual(row['reason'], 'IFVG_CLOSE')
        self.assertEqual(row['entry'], 110.)
        self.assertEqual(row['sweep_extreme'], 97.)
        self.assertLess(row['sl'], 97.)
        self.assertEqual(row.get('fvg_bottom'), 108.)
        self.assertEqual(row.get('fvg_top'), 109.)
        self.assertAlmostEqual(row['tp1'], 136.)


if __name__ == '__main__':
    unittest.main()
