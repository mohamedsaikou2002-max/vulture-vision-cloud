"""One bounded, concurrent sweep; no upload unless explicitly configured/requested."""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
import json
from pathlib import Path
from catalog import load_sources
from crawler import Crawler, open_cache, upload, upload_report

def sweep(sources, cache, limit=20, workers=4):
    def one(source):
        db = None
        try:
            db = open_cache(cache)
            return Crawler(source, db).crawl(limit=limit)
        except Exception as exc:
            return [], dict(source_id=source['id'], source=source['name'], status='skipped', checked_at=datetime.now(timezone.utc).isoformat(), error=f'{type(exc).__name__}: {exc}')
        finally:
            if db is not None: db.close()
    items, reports = {}, []
    with ThreadPoolExecutor(max_workers=max(1,min(8,workers))) as pool:
        for future in as_completed([pool.submit(one,s) for s in sources]):
            found, report = future.result()
            reports.append(report)
            for item in found: items[item['id']] = item
    failed = sum(r['status']=='skipped' for r in reports)
    return dict(checked_at=datetime.now(timezone.utc).isoformat(),status='unavailable' if failed==len(reports) else 'degraded' if failed else 'available',items=list(items.values()),sources=reports)

def main():
    p=argparse.ArgumentParser();p.add_argument('--global-only',action='store_true');p.add_argument('--upload',action='store_true');p.add_argument('--workers',type=int,default=4);p.add_argument('--cache',default='crawler-cache.sqlite');p.add_argument('--output',default='crawl-result.json');args=p.parse_args()
    sources=load_sources()
    if args.global_only: sources=[s for s in sources if s['id'].startswith('global-extra-')]
    result=sweep(sources,args.cache,workers=args.workers)
    Path(args.output).write_text(json.dumps(result,ensure_ascii=False,indent=2))
    if args.upload:
        upload(result['items'])
        for report in result['sources']: upload_report(report)
    print(json.dumps({'status':result['status'],'sources_checked':len(result['sources']),'articles':len(result['items']),'uploaded':bool(args.upload and result['items'])}))
    return 2 if result['status']=='unavailable' else 0
if __name__=='__main__':raise SystemExit(main())
