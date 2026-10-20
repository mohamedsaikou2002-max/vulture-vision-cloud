#!/usr/bin/env python3
"""Safely merge explicitly approved new sources without changing the original registry."""
import argparse, json
from pathlib import Path
from urllib.parse import urlsplit


def hostname(url):return (urlsplit(url).hostname or '').lower().removeprefix('www.')

p=argparse.ArgumentParser(description='Only insert candidates explicitly approved after permissions review.')
p.add_argument('--existing',required=True,help='Path to original news-crawler/sources.json')
p.add_argument('--candidates',default='global_blog_candidates.json')
p.add_argument('--approval',required=True,help='JSON with {"approved_ids":["global-extra-001",...]}; human reviewed source rights and robots')
p.add_argument('--audit',required=True,help='crawl_audit_results.json from the host that will crawl')
p.add_argument('--output',default='sources.expanded.review.json')
a=p.parse_args()
old=json.loads(Path(a.existing).read_text(encoding='utf8'))
new=json.loads(Path(a.candidates).read_text(encoding='utf8'))
review=json.loads(Path(a.approval).read_text(encoding='utf8'))
checked=json.loads(Path(a.audit).read_text(encoding='utf8'))
ids=set(review.get('approved_ids') or [])
results={x['id']:x for x in checked.get('results',[])}
existing_hosts={hostname(x['homepage']) for x in old['sources']}
added=[];skipped=[]
for c in new['sources']:
    if c['id'] not in ids:continue
    result=results.get(c['id'])
    if not result or result.get('crawl_decision')!='technical_candidate_pending_terms_review':
        skipped.append((c['id'],'not_technically_eligible'));continue
    host=hostname(c['homepage'])
    if host in existing_hosts:
        skipped.append((c['id'],'duplicate_domain'));continue
    entry={k:c[k] for k in ('id','name','homepage','source_country','language','feed_urls','allowed_hosts','html_metadata','redistribution','api_status')}
    usable=[x['url'] for x in result.get('feed_checks',[]) if x.get('result')=='possible_feed']
    entry['feed_urls']=usable
    entry['enabled']=True
    entry['status']='reviewed_candidate'  # Manual approval still must cover robots, ToS and intended use.
    entry['office_evidence_url']='' # Do not assert a BlackRock office in a new country.
    old['sources'].append(entry)
    existing_hosts.add(host)
    added.append(c['id'])
Path(a.output).write_text(json.dumps(old,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print('Added',len(added),'Skipped',skipped,'Output',a.output)
