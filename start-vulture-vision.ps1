# Windows PowerShell launcher: .\start-vulture-vision.ps1
# Run from an already downloaded/unzipped Vulture Vision repository.
param([switch]$SkipInstall)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js 22.12+ is required: https://nodejs.org/' }
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw 'npm is missing. Reinstall Node.js 22 LTS.' }
node scripts/setup-local.mjs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
if (-not $SkipInstall) {
  npm ci
  if ($LASTEXITCODE -ne 0) { throw 'npm ci failed; see the error output.' }
}
npm run doctor:local
if ($LASTEXITCODE -ne 0) {
  Write-Host 'Set the two PUBLIC Supabase values in .env.local, verify the project is active, then rerun this script.' -ForegroundColor Yellow
  exit 1
}
Write-Host 'Starting the Vulture Vision local development server...' -ForegroundColor Green
npm run dev -- --host 127.0.0.1 --strictPort
exit $LASTEXITCODE
