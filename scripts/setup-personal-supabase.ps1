# Portable Vulture Vision backend bootstrap for Windows / VS Code.
# From extracted backend root:
#   powershell -ExecutionPolicy Bypass -File scripts/setup-personal-supabase.ps1
# Inspect the dry-run, then separately rerun with -Apply ONLY after approving it.
param(
    [string]$ProjectRef = "sqxnulqhmykvlgxxvhmt",
    [switch]$Apply
)

$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)
$ExpectedRef = "sqxnulqhmykvlgxxvhmt"
$BlockedRefs = @("wfxjufhqdgzajidciwxb", "kfqyprcxnqiofzmwhxgg")
if ($ProjectRef -ne $ExpectedRef -or $BlockedRefs -contains $ProjectRef) {
    throw "Refusing unknown or legacy project: $ProjectRef. Expected personal project $ExpectedRef."
}
Write-Host "Personal Supabase target: https://$ProjectRef.supabase.co"
Write-Host "This operation does not export Lovable data or copy project secrets."
Write-Host "Review SQL and confirm this target in your own Supabase dashboard."
npx --yes supabase --version
if ($LASTEXITCODE -ne 0) { throw "Supabase CLI not available" }
Write-Host "Supabase authentication might open a browser. Sign in to your personal account."
npx supabase login
if ($LASTEXITCODE -ne 0) { throw "Supabase login failed" }
npx supabase link --project-ref $ProjectRef
if ($LASTEXITCODE -ne 0) { throw "Project link failed" }
npx supabase migration list --remote
if ($LASTEXITCODE -ne 0) { throw "Could not inspect remote migrations; stopping" }
npx supabase db push --dry-run --remote
if ($LASTEXITCODE -ne 0) { throw "Dry-run failed; stopping without applying" }
if (-not $Apply) {
    Write-Host "DRY RUN ONLY. Inspect SQL, RLS and target project. Rerun with -Apply to apply approved migrations."
    exit 0
}
$confirm = Read-Host "To apply migrations type exactly: APPLY $ExpectedRef"
if ($confirm -ne "APPLY $ExpectedRef") { throw "Not confirmed; no remote migration was applied" }
npx supabase db push --remote
if ($LASTEXITCODE -ne 0) { throw "Migration application failed; inspect logs before retrying" }
Write-Host "Migrations submitted. Deploy Edge Functions separately, then run security advisors and tests."
