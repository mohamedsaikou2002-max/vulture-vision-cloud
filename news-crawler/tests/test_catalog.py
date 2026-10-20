import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from catalog import load_sources
from run_catalog import sweep

class CatalogTests(unittest.TestCase):
    def test_all_207_are_selected_without_mutating_research_catalog(self):
        sources=load_sources()
        self.assertEqual(len([s for s in sources if s['id'].startswith('global-extra-')]),207)
        self.assertEqual(len({s['id'] for s in sources}),len(sources))
        self.assertEqual(len(load_sources(False)),80)

    def test_partial_sweep_keeps_other_publishers_and_deduplicates(self):
        def crawl(worker,limit):
            if worker.source['id']=='bad':raise OSError('DNS unavailable')
            return [{'id':'same'}],dict(source_id=worker.source['id'],status='reachable')
        sources=[dict(id=i,homepage='https://example.com',name=i) for i in ['good','duplicate','bad']]
        with tempfile.TemporaryDirectory() as directory,patch('crawler.Crawler.crawl',autospec=True,side_effect=crawl):
            result=sweep(sources,str(Path(directory)/'cache.sqlite'),workers=2)
        self.assertEqual(result['status'],'degraded')
        self.assertEqual(len(result['items']),1)
        self.assertEqual(len(result['sources']),3)
