"""Continuously ingest news and publish background prompts. Run on a supervised backend."""
from concurrent.futures import ThreadPoolExecutor
import json
import os
import threading
import time
from pathlib import Path
import requests
from crawler import Crawler, open_cache, upload


def refresh_context():
    base=os.environ.get('SUPABASE_URL','');key=os.environ.get('SUPABASE_SERVICE_ROLE_KEY','');token=os.environ.get('NEWS_CONTEXT_WORKER_TOKEN','')
    if not base.startswith('https://') or not key or not token: raise ValueError('Configure backend Supabase URL, service credential and context worker token')
    response=requests.post(base.rstrip('/')+'/functions/v1/vv-news-context',headers={'Authorization':'Bearer '+key,'apikey':key,'x-news-worker-token':token},json={},timeout=120)
    if not response.ok: raise RuntimeError('Context refresh failed: HTTP '+str(response.status_code))
    return response.json()


def context_loop(stop):
    while not stop.is_set():
        try:
            result=refresh_context()
            if result.get('status')=='published': print(json.dumps(result),flush=True)
        except Exception as e: print(json.dumps({'context_status':'retrying','error':str(e)}),flush=True)
        stop.wait(2)


def crawl_source(source):
    db=None
    try:
        db=open_cache(os.environ.get('NEWS_CRAWLER_CACHE','crawler-cache.sqlite'))
        items,report=Crawler(source,db).crawl(limit=20)
        upload(items)
        print(json.dumps({'source':source['id'],'items':len(items),'status':report['status']}),flush=True)
    except Exception as e:
        print(json.dumps({'source':source['id'],'status':'skipped','error':str(e)}),flush=True)
    finally:
        if db is not None:db.close()


def ingest_loop(stop):
    registry=json.loads(Path(__file__).with_name('sources.json').read_text())['sources']
    selected=set(os.environ.get('NEWS_SOURCE_IDS','').split(','))- {''}
    sources=[s for s in registry if s['enabled'] and (not selected or s['id'] in selected)]
    interval=max(15,int(os.environ.get('NEWS_CRAWL_INTERVAL_SECONDS','60')))
    workers=max(1,min(8,int(os.environ.get('NEWS_CRAWL_WORKERS','4'))))
    due={s['id']:0.0 for s in sources};pending={}
    with ThreadPoolExecutor(max_workers=workers) as pool:
        while not stop.is_set():
            for source_id,future in list(pending.items()):
                if future.done():
                    try:future.result()
                    except Exception as e:
                        print(json.dumps({'source':source_id,'status':'retrying','error':str(e)}),flush=True)
                        due[source_id]=time.monotonic()+interval
                    finally:del pending[source_id]
            # Oldest due source first; one slow publisher cannot stall the global sweep.
            for source in sorted(sources,key=lambda s:due[s['id']]):
                if len(pending)>=workers:break
                source_id=source['id']
                if source_id not in pending and due[source_id]<=time.monotonic():
                    due[source_id]=time.monotonic()+interval
                    pending[source_id]=pool.submit(crawl_source,source)
            stop.wait(0.5)


def main():
    stop=threading.Event();worker=threading.Thread(target=context_loop,args=(stop,),daemon=True);worker.start()
    try:ingest_loop(stop)
    except KeyboardInterrupt:stop.set();worker.join(timeout=125)
if __name__=='__main__':main()
