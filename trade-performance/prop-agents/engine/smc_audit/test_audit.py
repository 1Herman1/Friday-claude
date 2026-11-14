"""SYNTHETIC_TEST_ONLY fixtures; no performance evidence."""
import importlib.util
from pathlib import Path
import unittest
import pandas as pd
import numpy as np

HERE = Path(__file__).resolve().parent

def module():
    spec = importlib.util.spec_from_file_location('audit', HERE / 'audit.py')
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m

class AuditTests(unittest.TestCase):
    def test_legacy_instrumentation_preserves_trades_and_exports_skips(self):
        self.assertTrue((HERE/'audit.py').exists(), 'Missing isolated audit runner')
        m = module()
        legacy = m.load_legacy()
        idx = pd.date_range('2026-01-04', periods=108, freq='15min', tz='UTC')
        rows = [(105,109,70,105)] * 96 + [
            (100,101,99,100),(101,104,100,103),(103,105,102,104),
            (104,106,103,105),(105,108,104,106),(106,110,104,106),
            (106,107,103,105),(105,106,102,104),(104,105,99,100),
            (100,102,98,101),(101,103,99,102),(102,104,100,103)]
        data = pd.DataFrame(rows, columns=list('ohlc'), index=idx)
        legacy.load = lambda *args: data
        original = legacy.run('SYNTHETIC_TEST_ONLY', '1h', 'all')
        traced, records = m.instrumented_run(legacy, 'SYNTHETIC_TEST_ONLY', '1h', 'all')
        pd.testing.assert_frame_equal(original, traced)
        self.assertTrue(records)
        self.assertTrue(all('reason' in r for r in records))
        taken = [r for r in records if r['reason']=='LEGACY_TAKEN']
        self.assertEqual(len(taken),len(original))
        self.assertGreater(len(taken),0)
        for r in taken:
            self.assertAlmostEqual(r['legacy_r_net'] + r['cost_total_R'], r['legacy_gross_R'])
            self.assertGreater(pd.Timestamp(r['entry_close']),pd.Timestamp(r['entry_bar_open']))

    def test_causal_target_does_not_use_rest_of_signal_candle(self):
        m=module()
        lt=pd.date_range('2026-01-01',periods=4,freq='15min',tz='UTC').asi8
        # A 1h high/low would discard target because of the third bar,
        # but that bar is not closed when entry confirms at 00:15.
        self.assertEqual(m.causal_target(lt,np.array([110]*4),np.array([100,100,70,100]),
            [(80.,'pd','lo',lt[0],lt[-1]+3600*10**9)],'lo',lt[1],90.,1),80.)

    def test_drawdown_includes_initial_capital(self):
        m=module()
        self.assertTrue(hasattr(m,'closed_trade_dd'), 'Missing initial-equity DD correction')
        self.assertAlmostEqual(m.closed_trade_dd([-1.],risk=.005),-.005)

    def test_provisional_15m_sweep_5m_entry_adapter_and_prefix(self):
        m=module()
        self.assertTrue(hasattr(m,'preview_adapter'), 'Missing provisional timeframe adapter')
        p=m.preview_adapter('15m')
        idx=pd.date_range('2026-01-09',periods=9,freq='5min',tz='UTC')
        data=pd.DataFrame([(100,101,99,100),(101,104,100,103),(103,105,102,104),
            (104,106,103,105),(105,110,104,106),(106,107,103,104),
            (104,105,99,100),(100,102,98,101),(101,103,99,102)],index=idx,columns=list('ohlc'))
        row=p.evaluate_setup(data,idx[3],{'price':109.,'side':'hi','kind':'pd'})
        self.assertEqual(row['reason'],'IFVG_CLOSE')
        self.assertEqual(row['entry_time'],'2026-01-09T00:35:00+00:00')
        self.assertGreater(row['sl'],110.)
        self.assertAlmostEqual(row['tp1'],80.)
        prefix=pd.DataFrame([(105,109,70,105)]*2304,index=pd.date_range('2026-01-01',periods=2304,freq='5min',tz='UTC'),columns=list('ohlc'))
        full=pd.concat([prefix,data])
        report=p.replay(full,'SYNTHETIC_TEST_ONLY','all',full.index[-1]+p.STEP)
        self.assertEqual(report['counts']['production_eligible'],0)
        self.assertTrue(p.verify_prefixes(full,'SYNTHETIC_TEST_ONLY','all',[idx[6]+p.STEP])['passed'])
        with self.assertRaisesRegex(ValueError,'GAP'):
            p.closed_candles(full.drop(full.index[1]),full.index[-1]+p.STEP)

    def test_inventory_cli_uses_saved_files_and_confines_outputs(self):
        m=module()
        self.assertTrue(hasattr(m,'main'), 'Missing offline audit CLI')
        import tempfile,json
        with tempfile.TemporaryDirectory(dir=HERE) as directory:
            m.main(['--phase','inventory','--output-dir',directory])
            inventory=json.loads((Path(directory)/'inventory.json').read_text())
            self.assertEqual(len(inventory['saved_csvs']),9)
            self.assertEqual(inventory['spot']['count'],1920)
            self.assertTrue(all(r['rows_match_summary'] for r in inventory['saved_csvs']))
        with self.assertRaisesRegex(ValueError,'OUTPUT_MUST_BE_INSIDE_AUDIT'):
            m.main(['--phase','inventory','--output-dir',str(HERE.parent/'forbidden')])

    def test_legacy_stale_ifvg_and_exact_extreme_stop_are_observable(self):
        m=module();legacy=m.load_legacy()
        idx=pd.date_range('2026-01-04',periods=108,freq='15min',tz='UTC')
        rows=[(105,109,70,105)]*96+[
            (100,101,99,100),(101,104,100,103),(103,105,102,104),
            (104,106,103,105),(105,108,104,106),(106,110,104,106),
            (106,107,103,105),(100,106,99,100),(100,105,99,100),
            (100,102,98,101),(101,103,99,102),(102,104,100,103)]
        data=pd.DataFrame(rows,index=idx,columns=list('ohlc'))
        legacy.load=lambda *args:data
        trades,records=m.instrumented_run(legacy,'SYNTHETIC_TEST_ONLY','1h','all')
        stale=[r for r in records if r['reason']=='LEGACY_TAKEN' and r['no_fresh_ifvg_cross']]
        self.assertTrue(stale)
        self.assertEqual(stale[0]['stop'],110.)
        self.assertFalse(stale[0]['stop_is_strictly_beyond_extreme'])
        preview=m.preview_adapter('1h').evaluate_setup(data,idx[100],{'price':109.,'kind':'pd','side':'hi'})
        self.assertEqual(preview['reason'],'PENDING_IFVG')

if __name__ == '__main__': unittest.main()
