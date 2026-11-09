#!/usr/bin/env bash
# Portable Vulture Vision backend bootstrap for bash / WSL / macOS.
# Run from extracted backend root: bash scripts/setup-personal-supabase.sh
# After review, rerun: bash scripts/setup-personal-supabase.sh --apply
set -euo pipefail
cd "$(dirname "$0")/.."
PROJECT_REF="sqxnulqhmykvlgxxvhmt"
if [[ "${1:-}" != "" && "${1:-}" != "--apply" ]]; then
  echo "Only --apply is supported. Target is fixed to the user's personal Supabase project." >&2
  exit 2
fi
echo "Target: https://${PROJECT_REF}.supabase.co"
echo "No secret credentials, Lovable database rows, or production payments are included."
npx --yes supabase --version
npx supabase login
npx supabase link --project-ref "${PROJECT_REF}"
npx supabase migration list --remote
npx supabase db push --dry-run --remote
if [[ "${1:-}" != "--apply" ]]; then
  echo "Dry run complete. Review all migrations, RLS and target. Re-run with --apply only after approval."
  exit 0
fi
read -r -p "To apply reviewed migrations type exactly 'APPLY ${PROJECT_REF}': " CONFIRM
if [[ "$CONFIRM" != "APPLY ${PROJECT_REF}" ]]; then
  echo "Confirmation did not match; stopping." >&2
  exit 1
fi
npx supabase db push --remote
echo "Migrations submitted. Deploy Edge Functions separately and test access control."
