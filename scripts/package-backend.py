#!/usr/bin/env python3
"""Produce a backend-only, source-complete Vulture Vision workspace ZIP.

This is an EXPORT of backend source, not an export of database rows or secrets.
Run from repository root:
    python scripts/package-backend.py

The archive can be extracted over a checked-out Vulture Vision frontend repository.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "artifacts" / "VultureVision-Standalone-Backend.zip"
PREFIX = "VultureVision-Standalone-Backend/"
DIRS = (
    "supabase",
    "news-crawler",
    "deployment",
    "drizzle",
)
SCRIPTS = (
    "scripts/check-backend.mjs",
    "scripts/check-migrations.mjs",
    "scripts/package-backend.py",
    "scripts/setup-personal-supabase.ps1",
    "scripts/setup-personal-supabase.sh",
    "scripts/load/workspace.js",
)
DOCS = (
    "docs/AUTH_STRIPE_LAUNCH.md",
    "docs/VERCEL_RELEASE.md",
    "docs/BACKEND_STANDALONE.md",
    "docs/LIVE_ERROR_REPAIR.md",
    "docs/warwatch-geopolitical-context.md",
    "docs/osiris-news-only-integration.md",
    "docs/nasdaq-analytics.md",
)
EXTRAS = (
    "backend.env.example",
)
DISALLOWED_SEGMENTS = {".git", "__pycache__", "node_modules", ".venv", "venv", "dist", ".next", "artifacts"}
DISALLOWED_NAMES = {".env", ".env.local", ".env.production", ".env.development", "service-role.json", "credentials.json"}
DISALLOWED_SUFFIXES = {".pem", ".key", ".p12", ".pfx"}


def allowed(path: Path) -> bool:
    relative = path.relative_to(ROOT)
    if not path.is_file() or path.is_symlink() or any(p in DISALLOWED_SEGMENTS for p in relative.parts):
        return False
    if path.name in DISALLOWED_NAMES or path.name.startswith(".env.") or path.suffix.lower() in DISALLOWED_SUFFIXES:
        return False
    return True


paths = []
for directory in DIRS:
    paths.extend(p for p in (ROOT / directory).rglob("*") if allowed(p))
for name in SCRIPTS + DOCS + EXTRAS:
    file = ROOT / name
    if not file.exists() or not allowed(file):
        raise SystemExit(f"Required package component missing or excluded: {name}")
    paths.append(file)
paths = sorted(set(paths), key=lambda p: p.relative_to(ROOT).as_posix())
OUTPUT.parent.mkdir(exist_ok=True)
manifest = {
    "package": "Vulture Vision standalone backend (source only)",
    "target_supabase_project": "sqxnulqhmykvlgxxvhmt",
    "contents": [],
    "caution": "No database rows, access tokens, secrets, hosting, production deployment or paid data licenses are included.",
}
with zipfile.ZipFile(OUTPUT, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for path in paths:
        data = path.read_bytes()
        relative = path.relative_to(ROOT).as_posix()
        info = zipfile.ZipInfo(PREFIX + relative, (2026, 11, 9, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        archive.writestr(info, data, compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
        manifest["contents"].append({"path": relative, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()})
    info = zipfile.ZipInfo(PREFIX + "BACKEND_MANIFEST.json", (2026, 11, 9, 0, 0, 0))
    archive.writestr(info, json.dumps(manifest, indent=2) + "\n")
print(f"Created {OUTPUT} ({len(paths)} source files, {OUTPUT.stat().st_size} compressed bytes)")
