import unittest
import monitor as m

class NormalizationTests(unittest.TestCase):
    def test_decimal_sign_missing_and_unknown_interval(self):
        for raw, expected in [('0.02','0.02'),('-0.01','-0.01'),('0','0'),('',None),(None,None),('NaN',None)]:
            o=m.observation('Test','ALTUSDT','ALT',raw,None,None,'now','url')
            self.assertEqual(o['funding_rate'],expected)
            self.assertIsNone(o['rate_per_hour'])
            self.assertIsNone(o['interval_hours'])
            self.assertEqual(o['liquidity_class'],'UNKNOWN')

class PairTests(unittest.TestCase):
    def test_sign_interval_timing_and_exact_identity(self):
        def o(v,b,r,h,t): return m.observation(v,b+'USDT',b,r,h,t,'now','url')
        obs=[o('A','PEPE','-0.01','8',1000),o('B','PEPE','0.02','4',2000),o('C','1000PEPE','0.1','1',1000),o('D','MISS',None,None,None)]
        pairs=m.make_pairs(obs)
        self.assertEqual(len(pairs),1)
        p=pairs[0]
        self.assertEqual((p['long_venue'],p['short_venue']),('A','B'))
        self.assertEqual(p['indicative_diff_per_hour'],'0.00625')
        self.assertEqual(p['status'],'HOLD')
        self.assertIn('UNEQUAL_INTERVALS',p['reasons'])
        self.assertIn('UNEQUAL_SETTLEMENT_TIMES',p['reasons'])
        obs[1]['interval_hours']=None
        self.assertIsNone(m.make_pairs(obs)[0]['indicative_diff_per_hour'])

    def test_pair_direction_uses_same_time_horizon_not_raw_settlement_rate(self):
        # SYNTHETIC UNIT TEST: 1.6%/8h < 0.4%/1h despite a larger raw rate.
        obs=[m.observation('A','ALTUSDT','ALT','0.016','8',1000,'now','url'),
             m.observation('B','ALTUSDT','ALT','0.004','1',2000,'now','url')]
        pair=m.make_pairs(obs)[0]
        self.assertEqual((pair['long_venue'],pair['short_venue']),('A','B'))
        self.assertEqual(pair['indicative_diff_per_hour'],'0.002')
        self.assertEqual(pair['status'],'HOLD')

class AdapterTests(unittest.TestCase):
    def test_saved_live_feeds_filter_active_usdt_and_preserve_units(self):
        import json
        from pathlib import Path
        for venue in ['BingX','Gate','Binance','OKX']:
            raw={k.stem:json.loads(k.read_text()) for k in Path('research').glob('*.json')}
            obs,stats=m.normalize(venue,raw,'now')
            self.assertGreater(len(obs),100)
            self.assertTrue(all(o['market_type']=='USDT_PERPETUAL' for o in obs))
            if venue=='Gate': self.assertEqual(obs[0]['interval_hours'],'8')
            if venue=='OKX': self.assertTrue(all(o['symbol'].endswith('-USDT-SWAP') for o in obs))

class CollectionTests(unittest.TestCase):
    def test_progress_atomic_output_errors_and_replay(self):
        import json,tempfile
        from pathlib import Path
        raw={k.stem:json.loads(k.read_text()) for k in Path('research').glob('*.json')}
        with tempfile.TemporaryDirectory(dir='.') as td:
            out=Path(td)
            calls=[]
            m.atomic(out/'latest.json',{'completed_at':'PREVIOUS_COMPLETE','observations':[{'preserved':True}]})
            def fetch(url):
                self.assertEqual(json.loads((out/'latest.json').read_text())['completed_at'],'PREVIOUS_COMPLETE')
                self.assertEqual(json.loads((out/'progress.json').read_text())['previous_snapshot_at'],'PREVIOUS_COMPLETE')
                calls.append(json.loads((out/'progress.json').read_text()))
                if 'gateio' in url: raise OSError('test outage')
                key=next(k for k,u in m.ENDPOINTS['BingX'] if u==url)
                return json.dumps(raw[key]).encode()
            result=m.collect(out,venues=['BingX','Gate'],fetch=fetch)
            self.assertEqual(result['status'],'partial')
            self.assertGreater(len(result['observations']),100)
            self.assertTrue(any(c['running'] for c in calls))
            self.assertTrue((out/'events.jsonl').exists())
            replay=m.replay(out/'raw'/result['run_id'])
            self.assertEqual(result['observations'],replay['observations'])
            self.assertEqual(result['pairs'],replay['pairs'])

if __name__ == '__main__': unittest.main()
