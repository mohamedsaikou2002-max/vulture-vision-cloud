import json
import sys
import threading
import unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import live_pipeline

class SchedulingTests(unittest.TestCase):
    def test_slow_source_does_not_block_other_publishers(self):
        stop=threading.Event()
        release=threading.Event()
        fast=threading.Event()
        sources=[{'id':'slow','enabled':True},{'id':'fast','enabled':True}]
        def crawl(source):
            if source['id']=='slow':release.wait(5)
            else:fast.set()
        with patch.object(live_pipeline.Path,'read_text',return_value=json.dumps({'sources':sources})),patch.object(live_pipeline,'crawl_source',side_effect=crawl),patch.dict(live_pipeline.os.environ,{'NEWS_CRAWL_WORKERS':'2','NEWS_SOURCE_IDS':''}):
            thread=threading.Thread(target=live_pipeline.ingest_loop,args=(stop,))
            thread.start()
            try:self.assertTrue(fast.wait(3),'Fast publisher blocked by slow publisher')
            finally:
                stop.set()
                release.set()
                thread.join(3)
            self.assertFalse(thread.is_alive())
