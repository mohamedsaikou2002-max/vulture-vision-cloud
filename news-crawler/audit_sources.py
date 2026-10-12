"""Bounded read-only registry check; independently rate-limited per publisher."""
import concurrent.futures
import json
import tempfile
from pathlib import Path
from crawler import Crawler, open_cache

sources=json.loads(Path(__file__).with_name('sources.json').read_text())['sources']
def check(source):
    with tempfile.TemporaryDirectory() as tmp:
        db=open_cache(str(Path(tmp)/'cache.sqlite'))
        try:
            _,report=Crawler(source,db).crawl(audit_only=True)
            return report
        except Exception as e:
            return dict(source_id=source['id'],source=source['name'],homepage=source['homepage'],status='skipped',error=f'{type(e).__name__}: {e}')
        finally: db.close()
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
    reports=list(pool.map(check,sources))
Path(__file__).with_name('source-checks.json').write_text(json.dumps(reports,indent=2,ensure_ascii=False))
print(json.dumps({'sources':len(reports),'reachable':sum(r['status']=='reachable' for r in reports),'skipped':sum(r['status']=='skipped' for r in reports)}))
