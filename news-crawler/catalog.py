"""Runtime metadata registry. Global catalog is explicitly enabled by the app owner."""
import json
from pathlib import Path

def load_sources(include_global=True):
    base = Path(__file__).parent
    sources = [s for s in json.loads((base / 'sources.json').read_text())['sources'] if s['enabled']]
    if include_global:
        # User requested all 207 candidates. Crawler still enforces robots/access rules.
        sources += [dict(s, enabled=True) for s in json.loads((base / 'source-pack/global_blog_candidates.json').read_text())['sources']]
    by_id = {s['id']: s for s in sources}
    return list(by_id.values())
