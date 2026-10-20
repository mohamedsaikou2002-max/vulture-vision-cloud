"""Bounded publisher metadata crawler. Never follows arbitrary user-supplied URLs."""
import argparse
import hashlib
import ipaddress
import json
import os
import socket
import sqlite3
import time
import threading
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.parse import urljoin, urlsplit, urlunsplit
from urllib.robotparser import RobotFileParser

import requests
from bs4 import BeautifulSoup
from defusedxml import ElementTree as ET

AGENT = 'VultureVisionNewsBot/0.1'
MAX_BYTES = 1_500_000
HOST_THROTTLE_LOCK = threading.Lock()
HOST_NEXT_REQUEST = {}

def throttle_host(host, interval):
    with HOST_THROTTLE_LOCK:
        now=time.monotonic()
        reserved=max(now,HOST_NEXT_REQUEST.get(host,0))
        HOST_NEXT_REQUEST[host]=reserved+interval
    time.sleep(max(0,reserved-time.monotonic()))



def canonical(url):
    p = urlsplit(url)
    if p.scheme not in ('http', 'https') or not p.hostname or p.username or p.password or p.port not in (None, 80, 443):
        raise ValueError('Unsupported URL')
    return urlunsplit((p.scheme, p.netloc.lower(), p.path or '/', p.query, ''))


def public_url(url, hosts, resolver=socket.getaddrinfo):
    url = canonical(url)
    host = urlsplit(url).hostname
    if host not in hosts:
        raise ValueError('Host outside publisher allowlist')
    answers = resolver(host, 443)
    if not answers or any(not ipaddress.ip_address(a[4][0]).is_global for a in answers):
        raise ValueError('Non-public address rejected')
    return url


def iso_date(value):
    if not value:
        return None
    try:
        d = datetime.fromisoformat(value.strip().replace('Z', '+00:00'))
    except ValueError:
        try:
            d = parsedate_to_datetime(value)
        except (ValueError, TypeError, OverflowError):
            return None
    if d.tzinfo is None:
        return None  # Do not invent a timezone for publisher timestamps.
    return d.astimezone(timezone.utc).isoformat()


def feed_items(text, base):
    root = ET.fromstring(text)
    out = []
    for node in root.iter():
        if node.tag.split('}')[-1] not in ('item', 'entry'):
            continue
        values = {}; link = ''
        for child in node:
            tag = child.tag.split('}')[-1]
            if tag == 'link' and (child.get('rel') in (None, 'alternate')):
                link = child.get('href') or child.text or link
            values[tag] = ''.join(child.itertext()).strip()
        title = BeautifulSoup(values.get('title', ''), 'html.parser').get_text(' ', strip=True)
        if title and link:
            out.append(dict(title=title[:600], link=urljoin(base, link.strip()), time=iso_date(values.get('pubDate') or values.get('published') or values.get('updated'))))
    return out


def structured_items(html, base):
    soup = BeautifulSoup(html, 'html.parser'); out = []
    def visit(value):
        if isinstance(value, list):
            for x in value: visit(x)
        elif isinstance(value, dict):
            types = value.get('@type', []); types = [types] if isinstance(types, str) else types
            if any(t in ('NewsArticle', 'Article', 'ReportageNewsArticle') for t in types):
                title = value.get('headline'); link = value.get('url') or value.get('mainEntityOfPage')
                if isinstance(link, dict): link = link.get('@id')
                if isinstance(title, str):
                    out.append(dict(title=title[:600], link=urljoin(base, link if isinstance(link, str) else base), time=iso_date(value.get('datePublished'))))
            if '@graph' in value: visit(value['@graph'])
            if 'itemListElement' in value: visit(value['itemListElement'])
            if 'item' in value: visit(value['item'])
    for script in soup.select('script[type="application/ld+json"]'):
        try: visit(json.loads(script.string or script.get_text()))
        except (ValueError, TypeError, RecursionError): continue
    return out


class Crawler:
    def __init__(self, source, cache, delay=3):
        self.source = source; self.cache = cache; self.delay = max(3, delay)
        self.hosts = set(source.get('allowed_hosts', []))
        for u in [source['homepage'], *source.get('feed_urls', [])]:
            h = urlsplit(u).hostname
            self.hosts.update([h, h[4:] if h.startswith('www.') else 'www.' + h])
        self.session = requests.Session(); self.session.headers['User-Agent'] = AGENT
        self.robots = {}; self.last = {}; self.errors = []

    def request(self, url, robots=False):
        cache_page = getattr(self, "_cache_page", False)
        for _ in range(4):
            url = public_url(url, self.hosts); p = urlsplit(url); origin = f'{p.scheme}://{p.netloc}'
            if not robots:
                if origin not in self.robots: self.load_robots(origin)
                policy = self.robots[origin]
                if not policy.can_fetch(AGENT, url): raise ValueError('robots.txt disallows URL')
                interval = max(self.delay, policy.crawl_delay(AGENT) or 0)
                rate = policy.request_rate(AGENT)
                if rate and rate.requests > 0: interval = max(interval, rate.seconds / rate.requests)
            else: interval = self.delay
            throttle_host(p.hostname,interval)
            row = self.cache.execute('SELECT etag,modified,body FROM http_cache WHERE url=?', (url,)).fetchone()
            headers = {}
            if row:
                if row[0]: headers['If-None-Match'] = row[0]
                if row[1]: headers['If-Modified-Since'] = row[1]
            self.last[p.hostname] = time.monotonic()
            with self.session.get(url, headers=headers, timeout=(5, 15), allow_redirects=False, stream=True) as r:
                if r.status_code in (301, 302, 303, 307, 308):
                    url = urljoin(url, r.headers.get('Location', '')); continue
                if r.status_code == 304 and row: return row[2], url, 304
                if robots and r.status_code in (404, 410): return '', url, r.status_code
                if r.status_code in (401,403,429): raise ValueError(f'Publisher access denied/rate limited: {r.status_code}')
                r.raise_for_status()
                raw = bytearray()
                for chunk in r.iter_content(8192):
                    raw.extend(chunk)
                    if len(raw) > MAX_BYTES: raise ValueError('Response too large')
                r._content = bytes(raw); text = r.text
                # Persist only robots/index/feed pages for conditional requests; article bodies are not retained.
                if robots or cache_page:
                    self.cache.execute('INSERT OR REPLACE INTO http_cache VALUES(?,?,?,?)', (url,r.headers.get('ETag'),r.headers.get('Last-Modified'),text)); self.cache.commit()
                return text,url,r.status_code
        raise ValueError('Redirect limit exceeded')

    def load_robots(self, origin):
        self._cache_page = False
        text, _, status = self.request(origin + '/robots.txt', robots=True)
        policy = RobotFileParser(); policy.set_url(origin + '/robots.txt')
        policy.parse(text.splitlines() if status not in (404,410) else ['User-agent: *','Allow: /'])
        self.robots[origin] = policy

    def fetch(self, url, cache=True):
        self._cache_page = cache
        result = self.request(url)
        return result

    def crawl(self, limit=20, audit_only=False):
        self._cache_page = True
        html, base, status = self.fetch(self.source['homepage'])
        soup = BeautifulSoup(html,'html.parser')
        feeds = list(self.source.get('feed_urls', []))
        for link in soup.select('link[rel~="alternate"]'):
            if link.get('type') in ('application/rss+xml','application/atom+xml') and link.get('href'):
                feeds.append(urljoin(base,link['href']))
        report = dict(source_id=self.source['id'], source=self.source['name'], homepage=self.source['homepage'], homepage_status=status, checked_at=datetime.now(timezone.utc).isoformat(), title=soup.title.get_text(strip=True) if soup.title else '', discovered_feeds=list(dict.fromkeys(feeds)), articles=0, status='reachable', errors=self.errors)
        if audit_only: return [], report
        items=[]
        for feed in list(dict.fromkeys(feeds))[:2]:
            try:
                xml, feed_url, _ = self.fetch(feed)
                items.extend(feed_items(xml,feed_url))
            except Exception as e: self.errors.append(f'Feed skipped: {type(e).__name__}: {e}')
        if not items and self.source.get('html_metadata'):
            items.extend(structured_items(html,base))
            links=[]
            for a in soup.select('article a[href], h2 a[href], h3 a[href], a[href]:has(h2), a[href]:has(h3)'):
                target=urljoin(base,a['href'])
                try:
                    public_url(target,self.hosts)
                    if canonical(target) != canonical(base): links.append(target)
                except (ValueError,OSError): continue
            for target in list(dict.fromkeys(links))[:2]:
                try:
                    text, final, _ = self.fetch(target,cache=False)
                    items.extend(structured_items(text,final))
                except Exception as e: self.errors.append(f'Article skipped: {type(e).__name__}: {e}')
        normalized={}
        for item in items:
            try: link=public_url(item['link'],self.hosts)
            except (ValueError,OSError): continue
            normalized[link]=dict(id=hashlib.sha256(link.encode()).hexdigest(), title=item['title'], source=self.source['name'], canonical_url=link, published_at=item['time'], fetched_at=report['checked_at'], source_country=self.source['source_country'], language=self.source['language'], ingestion_method='publisher_metadata',source_id=self.source['id'])
        out=list(normalized.values())[:limit];report['articles']=len(out)
        if not out: report['status']='no_articles'
        return out, report


def open_cache(path):
    db=sqlite3.connect(path,timeout=30)
    db.execute('PRAGMA journal_mode=WAL')
    db.execute('CREATE TABLE IF NOT EXISTS http_cache(url TEXT PRIMARY KEY,etag TEXT,modified TEXT,body TEXT)')
    return db


def upload(items):
    base=os.environ.get('SUPABASE_URL');key=os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
    if not base or not key: raise ValueError('Server-side Supabase URL and service-role key are required for upload')
    if not base.startswith('https://') or not urlsplit(base).hostname.endswith('.supabase.co'): raise ValueError('Expected HTTPS Supabase project URL')
    if items:
        r=requests.post(base.rstrip('/')+'/rest/v1/news_articles?on_conflict=id',headers={'apikey':key,'Authorization':'Bearer '+key,'Prefer':'resolution=merge-duplicates,return=minimal'},json=items,timeout=30)
        if not r.ok: raise RuntimeError(f'Ingestion write failed: HTTP {r.status_code}')


def upload_report(report):
    base=os.environ.get('SUPABASE_URL');key=os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
    if not base or not key or not base.startswith('https://') or not urlsplit(base).hostname.endswith('.supabase.co'):
        raise ValueError('Configure server-side Supabase ingestion credentials')
    row=dict(source_id=report['source_id'],source=report['source'],status=report['status'],articles=report.get('articles',0),checked_at=report.get('checked_at',datetime.now(timezone.utc).isoformat()),error_kind=report.get('error','').split(':',1)[0] or None)
    response=requests.post(base.rstrip('/')+'/rest/v1/news_source_status?on_conflict=source_id',headers={'apikey':key,'Authorization':'Bearer '+key,'Prefer':'resolution=merge-duplicates,return=minimal'},json=[row],timeout=15)
    if not response.ok:raise RuntimeError('Source heartbeat write failed: HTTP '+str(response.status_code))


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--sources', help='Comma-separated registry IDs');parser.add_argument('--audit-only',action='store_true');parser.add_argument('--upload',action='store_true');parser.add_argument('--output',default='crawl-result.json');parser.add_argument('--cache',default='crawler-cache.sqlite');parser.add_argument('--limit',type=int,default=20)
    args=parser.parse_args(); registry=json.loads(Path(__file__).with_name('sources.json').read_text())
    ids=set(args.sources.split(',')) if args.sources else None;items=[];reports=[]
    for source in registry['sources']:
        if not source['enabled'] or ids and source['id'] not in ids: continue
        db=open_cache(args.cache)
        try:
            found,report=Crawler(source,db).crawl(max(1,min(100,args.limit)),args.audit_only);items.extend(found);reports.append(report)
        except Exception as e: reports.append(dict(source_id=source['id'],source=source['name'],status='skipped',error=f'{type(e).__name__}: {e}'))
        finally: db.close()
    result=dict(fetched_at=datetime.now(timezone.utc).isoformat(),items=items,sources=reports)
    Path(args.output).write_text(json.dumps(result,indent=2,ensure_ascii=False))
    all_failed = not reports or all(r.get('status') == 'skipped' for r in reports)
    # Preserve diagnostic output, but fail visibly instead of reporting a healthy run.
    if args.upload and not all_failed: upload(items)
    print(json.dumps({'status': 'unavailable' if all_failed else 'degraded' if any(r.get('status') == 'skipped' for r in reports) else 'completed', 'sources_checked':len(reports),'articles':len(items),'output':args.output,'uploaded':args.upload and not all_failed}))
    return 2 if all_failed else 0

if __name__=='__main__': raise SystemExit(main())
