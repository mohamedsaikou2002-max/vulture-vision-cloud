import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from crawler import Crawler, open_cache, canonical, feed_items, structured_items, iso_date, public_url

class CrawlerTests(unittest.TestCase):
    def test_rss_and_atom(self):
        rss='<rss><channel><item><title>Markets &amp; banks</title><link>https://example.com/a</link><pubDate>Mon, 12 Oct 2026 03:00:00 GMT</pubDate></item></channel></rss>'
        atom='<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>New story</title><link href="/b"/><published>2026-10-12T03:00:00Z</published></entry></feed>'
        self.assertEqual(feed_items(rss,'https://example.com')[0]['title'],'Markets & banks')
        self.assertEqual(feed_items(atom,'https://example.com')[0]['link'],'https://example.com/b')
    def test_xxe_is_rejected(self):
        with self.assertRaises(Exception): feed_items('<!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]><rss>&e;</rss>','https://example.com')
    def test_private_ip_and_foreign_host(self):
        resolver=lambda *a:[(2,1,6,'',('127.0.0.1',443))]
        with self.assertRaises(ValueError): public_url('https://example.com/a',{'example.com'},resolver)
        with self.assertRaises(ValueError): public_url('https://foreign.test/a',{'example.com'},resolver)
        with self.assertRaises(ValueError): canonical('https://user:password@example.com/a')
    def test_no_invented_timestamp(self):
        self.assertIsNone(iso_date('not a date'))
        self.assertIsNone(iso_date('2026-10-12T03:00:00'))
    def test_html_extracts_metadata_not_body(self):
        html='<script type="application/ld+json">{"@graph":[{"@type":"NewsArticle","headline":"Public headline","url":"/a","articleBody":"PRIVATE BODY","datePublished":"2026-10-12T03:00:00Z"}]}</script>'
        found=structured_items(html,'https://example.com')
        self.assertEqual(found[0]['link'],'https://example.com/a')
        self.assertNotIn('PRIVATE BODY',str(found))
    def test_robots_denial_happens_before_http_request(self):
        from unittest.mock import patch
        from urllib.robotparser import RobotFileParser
        db=open_cache(':memory:')
        bot=Crawler({'homepage':'https://example.com','id':'test'},db)
        policy=RobotFileParser();policy.parse(['User-agent: *','Disallow: /private'])
        bot.robots['https://example.com']=policy
        with patch('crawler.public_url',side_effect=lambda u,h:canonical(u)), patch.object(bot.session,'get') as get:
            with self.assertRaisesRegex(ValueError,'disallows'):bot.fetch('https://example.com/private')
            get.assert_not_called()
        db.close()
    def test_registry_covers_every_named_market_twice(self):
        import json
        r=json.loads(Path(__file__).resolve().parents[1].joinpath('sources.json').read_text())
        self.assertEqual(len(r['markets']),40)
        self.assertEqual(len(r['sources']),80)
        for market in r['markets']:
            self.assertEqual(sum(s['source_country']==market['code'] for s in r['sources']),2)
if __name__=='__main__':unittest.main()

