"""Verify saved raw SHA256 replay and emit exact snapshot statistics."""
import json
from pathlib import Path
from decimal import Decimal
import monitor

root=Path(__file__).resolve().parent/'out'
snapshot=json.loads((root/'latest.json').read_text())
result=monitor.replay(root/'raw'/snapshot['run_id'])
assert result['observations']==snapshot['observations'], 'Observation replay differs'
assert result['pairs']==snapshot['pairs'], 'Pair replay differs'
assert all(p['status']=='HOLD' for p in result['pairs'])
assert not json.loads((root/'progress.json').read_text())['running']
report={
 'run_id':snapshot['run_id'], 'started_at':snapshot['started_at'], 'completed_at':snapshot['completed_at'],
 'status':snapshot['status'],'observations':len(result['observations']),'pairs':len(result['pairs']),
 'sources':snapshot['sources'],'replay_exact':True,
 'extreme_abs_at_least_1pct':sum(abs(Decimal(o['funding_rate']))>=Decimal('.01') for o in result['observations'] if o['funding_rate'] is not None),
 'top_absolute_settlement':[{k:o[k] for k in ('symbol','venue','funding_rate','interval_hours','rate_per_hour')} for o in result['observations'][:10]],
 'top_absolute_hourly':[{k:o[k] for k in ('symbol','venue','funding_rate','interval_hours','rate_per_hour')} for o in sorted((o for o in result['observations'] if o['rate_per_hour'] is not None),key=lambda o:abs(Decimal(o['rate_per_hour'])),reverse=True)[:10]],
}
monitor.atomic(root/'verification.json',report)
print(json.dumps(report,indent=2))
