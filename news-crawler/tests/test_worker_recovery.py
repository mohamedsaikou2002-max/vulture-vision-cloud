import sys
import unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import live_pipeline
class WorkerRecoveryTests(unittest.TestCase):
 def test_cache_failure_is_contained(self):
  with patch.object(live_pipeline,'open_cache',side_effect=OSError('Disk unavailable')),patch.object(live_pipeline,'upload') as upload:
   live_pipeline.crawl_source({'id':'publisher'})
   upload.assert_not_called()
