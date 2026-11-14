"""Independent acceptance checks of saved REAL-candle audit artifacts.
Run only after audit.py --phase all (or legacy and preview separately).
"""
import json
from collections import Counter
from pathlib import Path
import unittest
import hashlib
import numpy as np
import pandas as pd

HERE=Path(__file__).resolve().parent
OUT=HERE/'results'
ROOT=HERE.parents[1]

class SavedArtifactTests(unittest.TestCase):
    def test_all_nine_legacy_exports_reconcile_with_saved_originals(self):
        summaries=json.loads((OUT/'legacy_summary.json').read_text())
        self.assertEqual(len(summaries),9)
        for summary in summaries:
            name=summary['name']
            rows=[json.loads(x) for x in (OUT/(name+'.jsonl')).read_text().splitlines()]
            self.assertEqual(len(rows),summary['first_breaches'])
            self.assertEqual(len(pd.read_csv(OUT/(name+'.csv'))),len(rows))
            self.assertEqual(len(set(r['key'] for r in rows)),len(rows))
            self.assertEqual(dict(Counter(r['reason'] for r in rows)),summary['by_reason'])
            taken=sorted([r for r in rows if r['reason']=='LEGACY_TAKEN'],key=lambda r:r['entry_close'])
            self.assertEqual(len(taken),summary['taken'])
            self.assertEqual(len(pd.read_csv(OUT/(name+'_trades.csv'))),len(taken))
            saved=pd.read_csv(ROOT/'engine/backtest/cache'/('smc02_'+name[len('legacy_'):]+'.csv'))
            np.testing.assert_allclose([r['legacy_r_net'] for r in taken],saved.r_net,rtol=1e-10)
            np.testing.assert_allclose([r['legacy_gross_R'] for r in taken],saved.r_gross,rtol=1e-10,atol=1e-10)
            for r in taken:
                self.assertAlmostEqual(r['legacy_gross_R']-r['cost_fee_R']-r['cost_slippage_proxy_R'],r['legacy_r_net'],places=8)
                self.assertAlmostEqual(r['cost_total_R'],r['cost_fee_R']+r['cost_slippage_proxy_R'],places=10)
                self.assertGreater(pd.Timestamp(r['entry_close']),pd.Timestamp(r['entry_bar_open']))
                self.assertEqual(r['funding_R'],None)
            for r in rows:
                self.assertFalse(r['production_eligible'])
                if r['reason']!='LEGACY_TAKEN':
                    self.assertIsNone(r['cost_total_R'])
                    self.assertNotIn('entry_close',r)

    def test_all_nine_preview_exports_and_all_prefix_cuts_reconcile(self):
        summaries=json.loads((OUT/'preview_summary.json').read_text())
        self.assertEqual(len(summaries),9)
        for summary in summaries:
            name=summary['name']
            report=json.loads((OUT/(name+'.json')).read_text())
            rows=[json.loads(x) for x in (OUT/(name+'.jsonl')).read_text().splitlines()]
            self.assertEqual(rows,report['candidates'])
            self.assertEqual(len(rows),summary['counts']['total'])
            self.assertEqual(len(pd.read_csv(OUT/(name+'.csv'))),len(rows))
            self.assertEqual(dict(Counter(r['reason'] for r in rows)),summary['counts']['by_reason'])
            self.assertEqual(sum(r['preview_eligible'] for r in rows),summary['counts']['preview_eligible'])
            self.assertEqual(len({r['key'] for r in rows}),len(rows))
            verification=report['prefix_verification']
            self.assertTrue(verification['passed'])
            cuts={pd.Timestamp(c['cut']) for c in verification['checks']}
            self.assertEqual(len(cuts),summary['prefix_checks'])
            step=pd.Timedelta(minutes=5 if summary['timeframes']['entry']=='5m' else 15)
            lo=pd.Timestamp(report['candles']['evaluation_from'])+step
            hi=pd.Timestamp(report['candles']['latest_close'])
            required={pd.Timestamp(r[k]) for r in rows for k in ('decision_time','sweep_close') if r.get(k) and lo<=pd.Timestamp(r[k])<=hi}
            self.assertTrue(required<=cuts)
            for r in rows:
                self.assertFalse(r['production_eligible'])
                self.assertIsNone(r['cost_total_R'])
                self.assertIn('UNAPPROVED_CONTEXT',r['warnings'])
                if r['preview_eligible']:
                    self.assertAlmostEqual(abs(r['tp1']-r['entry'])/abs(r['sl']-r['entry']),2.)
                    self.assertGreater(pd.Timestamp(r['entry_time']),pd.Timestamp(r['sweep_close']))
                    if r['side']=='short': self.assertGreater(r['sl'],r['sweep_extreme'])
                    else: self.assertLess(r['sl'],r['sweep_extreme'])

    def test_protected_sources_and_successful_completion_markers(self):
        inventory=json.loads((OUT/'inventory.json').read_text())
        for path,digest in inventory['protected_files'].items():
            self.assertEqual(hashlib.sha256((ROOT/path).read_bytes()).hexdigest(),digest)
        for phase in ('legacy','preview'):
            completed=json.loads((OUT/('completed_'+phase+'.json')).read_text())
            self.assertTrue(completed['protected_files_unchanged'])
            self.assertFalse(completed['live_switch'])
            self.assertFalse(completed['network_orders'])

if __name__=='__main__': unittest.main()
