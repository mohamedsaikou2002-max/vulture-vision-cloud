#!/usr/bin/env python3
"""Read-only source auditor. No crawling, login, anti-bot bypass or commercial licensing grant."""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import ipaddress
import json
from pathlib import Path
import socket
import time
from urllib.parse import urljoin, urlsplit
from urllib.robotparser import RobotFileParser

import requests
from bs4 import BeautifulSoup

USER_AGENT = 'VultureVisionSourceAudit/0.1'
MAX_BYTES = 300_000
TIMEOUT = (4, 9)
ALLOWED_SCHEMES = {'https'}


def public_url(url: str) -> bool:
    """Reject localhost/private addresses. DNS is checked but users should still enforce network egress policy."""
    try:
        p = urlsplit(url)
        if p.scheme not in ALLOWED_SCHEMES or not p.hostname or p.username or p.password:
            return False
        host = p.hostname.strip().rstrip('.')
        if host in {'localhost', 'localhost.localdomain'} or host.endswith(('.local', '.internal')):
            return False
        ips = socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)
        return bool(ips) and all(ipaddress.ip_address(x[4][0]).is_global for x in ips)
    except Exception:
        return False


def safe_get(session, url, max_redirects=3):
    for _ in range(max_redirects + 1):
        if not public_url(url):
            raise RuntimeError('non_public_or_unresolved_host')
        with session.get(url, headers={'User-Agent': USER_AGENT, 'Accept': 'text/html,application/rss+xml,application/atom+xml,application/xml,text/plain;q=0.8'},
                         stream=True, allow_redirects=False, timeout=TIMEOUT) as r:
            if r.status_code in (301, 302, 303, 307, 308):
                nxt = r.headers.get('Location')
                if not nxt: raise RuntimeError('redirect_missing_location')
                url = urljoin(url, nxt)
                continue
            data = bytearray()
            for part in r.iter_content(chunk_size=16384):
                data.extend(part)
                if len(data) >= MAX_BYTES:
                    data = data[:MAX_BYTES]
                    break
            return r.status_code, r.headers.get('Content-Type',''), bytes(data), url
    raise RuntimeError('redirect_limit')


def robots_for(session, url):
    p = urlsplit(url)
    robots_url = f'{p.scheme}://{p.netloc}/robots.txt'
    try:
        status,ctype,data,final_url = safe_get(session, robots_url)
        if status == 404 or status == 410:
            return 'not_found', None
        if status != 200:
            return 'unknown_http_'+str(status), None
        rp = RobotFileParser()
        rp.parse(data.decode('utf8',errors='replace').splitlines())
        return 'available', rp
    except Exception as ex:
        return 'unknown_'+str(ex)[:100], None


def audit_one(source):
    t = time.time()
    homepage = source['homepage']
    result = {'id':source['id'],'name':source['name'],'source_country':source['source_country'],
              'homepage':homepage, 'robots':'unknown', 'homepage_status':'not_checked',
              'crawl_path_allowed':False,'candidate_feed_urls':list(source.get('feed_urls') or []),
              'feed_checks':[], 'permission':'commercial_rights_not_reviewed',
              'crawl_decision':'disabled_pending_verification'}
    session=requests.Session()
    session.trust_env=False   # do not silently use ambient proxy variables
    try:
        robots_status,rp = robots_for(session, homepage)
        result['robots']=robots_status
        if robots_status.startswith('unknown'):
            result['crawl_decision']='defer_robots_unavailable';return result
        if rp is not None and not rp.can_fetch(USER_AGENT, homepage):
            result['crawl_decision']='blocked_by_robots';return result
        result['crawl_path_allowed']=True
        try:
            status,ctype,data,final=safe_get(session,homepage)
        except Exception as ex:
            result['homepage_status']='error_'+str(ex)[:120]
            return result
        result['homepage_status']='http_'+str(status)
        result['resolved_homepage']=final
        if status in (401,403,429):
            result['crawl_decision']='blocked_or_rate_limited';return result
        if status != 200:
            return result
        if 'html' not in ctype.lower():
            result['crawl_decision']='unexpected_content_type';return result
        soup=BeautifulSoup(data,'html.parser')
        for tag in soup.find_all('link',rel=True,href=True):
            rel=tag.get('rel') or []
            typ=(tag.get('type') or '').lower()
            if any(x.lower()=='alternate' for x in rel) and any(x in typ for x in ('rss','atom','xml')):
                link=urljoin(final,tag['href'])
                if link not in result['candidate_feed_urls']:
                    result['candidate_feed_urls'].append(link)
        result['candidate_feed_urls']=result['candidate_feed_urls'][:12]
        for feed in result['candidate_feed_urls']:
            check={'url':feed, 'result':'not_checked'}
            feed_robots,feed_rp=robots_for(session,feed)
            check['robots']=feed_robots
            if feed_robots.startswith('unknown'):
                check['result']='robots_unknown'
            elif feed_rp is not None and not feed_rp.can_fetch(USER_AGENT,feed):
                check['result']='robots_disallowed'
            else:
                try:
                    status,ctype,body,final_feed=safe_get(session,feed)
                    check['http_status']=status
                    check['content_type']=ctype
                    check['result']='possible_feed' if status==200 and ('xml' in ctype or 'rss' in ctype or b'<rss' in body[:4000] or b'<feed' in body[:4000]) else 'not_confirmed_feed'
                except Exception as ex:
                    check['result']='error_'+str(ex)[:100]
            result['feed_checks'].append(check)
        result['crawl_decision']='technical_candidate_pending_terms_review'
        return result
    finally:
        session.close()
        result['elapsed_seconds']=round(time.time()-t,2)


def main():
    parser=argparse.ArgumentParser(description='Read-only robots and feed audit, never grants commercial crawl permission.')
    parser.add_argument('--input',default='global_blog_candidates.json')
    parser.add_argument('--output',default='crawl_audit_results.json')
    parser.add_argument('--limit',type=int,default=0,help='0 means all sources; start with 10.')
    parser.add_argument('--workers',type=int,default=3)
    args=parser.parse_args()
    if not 1<=args.workers<=8: parser.error('--workers must be 1..8')
    entries=json.loads(Path(args.input).read_text(encoding='utf8'))['sources']
    if args.limit:entries=entries[:args.limit]
    out=[]
    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        pending={executor.submit(audit_one,x):x for x in entries}
        for future in as_completed(pending):
            try: result=future.result()
            except Exception as exc:
                x=pending[future];result={'id':x['id'],'name':x['name'],'crawl_decision':'error','error':str(exc)[:150]}
            out.append(result)
            print(result.get('source_country','??'),result['name'],result['crawl_decision'],result.get('homepage_status',''))
    out.sort(key=lambda x:x['id'])
    Path(args.output).write_text(json.dumps({'checked_at_utc':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),
      'checked_count':len(out), 'note':'Technical checks only, not legal permission; all candidates stay disabled until manual approval.',
      'results':out},ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    print('Saved',args.output)

if __name__=='__main__':main()
