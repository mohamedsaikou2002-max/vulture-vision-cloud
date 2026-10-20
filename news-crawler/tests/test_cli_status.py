import io
import json
import socket
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import crawler


class CliStatusTests(unittest.TestCase):
    def run_cli(self, directory, sources='gb-1'):
        output = Path(directory) / 'result.json'
        args = ['crawler.py', '--sources', sources, '--cache', str(Path(directory) / 'cache.sqlite'), '--output', str(output)]
        stream = io.StringIO()
        with patch.object(sys, 'argv', args), redirect_stdout(stream):
            code = crawler.main()
        return code, json.loads(stream.getvalue()), json.loads(output.read_text())

    def test_dns_failure_returns_nonzero_and_retains_diagnostics(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(crawler.Crawler, 'crawl', side_effect=socket.gaierror('DNS unavailable')):
            code, summary, result = self.run_cli(directory)
        self.assertEqual(code, 2)
        self.assertEqual(summary['status'], 'unavailable')
        self.assertFalse(summary['uploaded'])
        self.assertIn('DNS unavailable', result['sources'][0]['error'])

    def test_no_matching_sources_is_not_a_success(self):
        with tempfile.TemporaryDirectory() as directory:
            code, summary, _ = self.run_cli(directory, 'unknown-source')
        self.assertEqual(code, 2)
        self.assertEqual(summary['sources_checked'], 0)

    def test_legitimate_empty_feed_completes_successfully(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(crawler.Crawler, 'crawl', return_value=([], {'source_id': 'gb-1', 'status': 'no_articles'})):
            code, summary, _ = self.run_cli(directory)
        self.assertEqual(code, 0)
        self.assertEqual(summary['status'], 'completed')
