"""Execute acceptance tests and save real outputs plus recounted artifact totals."""
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
import subprocess
import sys

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
OUT=HERE/'results'
commands=[
    [sys.executable,'-B','-m','unittest','discover','-s','engine/smc_audit','-p','test_*.py','-v'],
    [sys.executable,'-B','-m','unittest','discover','-s','tests','-v'],
]
runs=[]
for command in commands:
    result=subprocess.run(command,cwd=ROOT,text=True,capture_output=True)
    runs.append(dict(command=command,exit_code=result.returncode,stdout=result.stdout,stderr=result.stderr))
    if result.returncode:
        print(result.stdout+result.stderr)
        raise SystemExit(result.returncode)
legacy=[]
for file in sorted(OUT.glob('legacy_*.jsonl')):
    legacy.extend(json.loads(line) for line in file.read_text().splitlines())
previews=[]
for file in sorted(OUT.glob('preview_*.jsonl')):
    previews.extend(json.loads(line) for line in file.read_text().splitlines())
summary=json.loads((OUT/'preview_summary.json').read_text())
flags=Counter()
for row in legacy:
    if row['reason']=='LEGACY_TAKEN':
        for key in ['no_fresh_ifvg_cross','fvg_previously_closed_beyond','target_aggregation_lookahead_difference',
                    'target_equality_touch_difference','tp1_then_be_ohlc_ambiguous']:
            flags[key]+=int(row.get(key,False))
report=dict(verified_at_utc=datetime.now(timezone.utc).isoformat(),test_runs=runs,
            legacy_rows=len(legacy),legacy_taken=sum(r['reason']=='LEGACY_TAKEN' for r in legacy),
            legacy_skipped=sum(r['reason']!='LEGACY_TAKEN' for r in legacy),legacy_flags=dict(flags),
            preview_rows=len(previews),preview_eligible=sum(r['preview_eligible'] for r in previews),
            production_eligible=sum(r['production_eligible'] for r in previews),
            prefix_checks=sum(r['prefix_checks'] for r in summary),
            reused_preview_gaps=sum(r['reused_previously_inverted_gap'] for r in summary),
            profitable_strategy_claim=False,network_fetches=0,network_orders=0,commits=0)
(OUT/'verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k!='test_runs'},ensure_ascii=False,indent=2))
