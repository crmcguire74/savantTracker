# ============================================================================
# Build and publish the tracker to Azure App Service. Windows PowerShell.
# ============================================================================
#
# Method proven in an earlier Azure deployment: build on your machine, ship dist + server + production node_modules in one
# zip, let Azure run it as-is. Azure does NOT build (SCM_DO_BUILD_DURING_DEPLOYMENT
# is false). Letting Azure build fails with "tsc: not found".
#
# Run from any folder, on the corporate network or VPN (the site is private
# after lockdown), signed in with `az login`:
#
#   $env:RESOURCE_GROUP = "SWM-OWLPLAN-EASTUS2"
#   $env:WEBAPP         = "app-owlplan"
#   .\infra\deploy.ps1
#
# Add -SkipTests only for an emergency re-deploy of code that already passed.
# ---------------------------------------------------------------------------
param([switch]$SkipTests)

$ErrorActionPreference = 'Stop'

if (-not $env:RESOURCE_GROUP -or -not $env:WEBAPP) {
  throw 'Set $env:RESOURCE_GROUP and $env:WEBAPP first. See docs/DEPLOYMENT-RUNBOOK.md, Step 7.2.'
}

function Assert-Ok([string]$what) {
  if ($LASTEXITCODE -ne 0) { throw "$what failed (exit code $LASTEXITCODE). Nothing was deployed." }
}

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $root

Write-Host '==> [1/7] Checking the working copy'
$dirty = git status --short
if ($dirty) {
  Write-Warning 'You have uncommitted changes. A release should come from a clean, committed checkout:'
  $dirty | ForEach-Object { Write-Host "    $_" }
  $answer = Read-Host 'Deploy anyway? (y/N)'
  if ($answer -ne 'y') { throw 'Stopped. Commit or stash first.' }
}
Write-Host "    commit: $(git rev-parse --short HEAD)"

Write-Host '==> [2/7] Installing dependencies'
npm ci
Assert-Ok 'npm ci'

Write-Host '==> [3/7] Checking server syntax'
# A syntax error in server code makes the container exit with code 1 on
# startup, and Azure then reports "site startup probe failed". Catch it here.
Get-ChildItem server -Recurse -Filter *.js | ForEach-Object {
  node --check $_.FullName
  Assert-Ok "Syntax check of $($_.Name)"
}

if (-not $SkipTests) {
  Write-Host '==> [4/7] Running tests'
  npm test
  Assert-Ok 'npm test'
} else {
  Write-Warning '[4/7] Tests skipped.'
}

Write-Host '==> [5/7] Building the front end'
npm run build
Assert-Ok 'npm run build'

Write-Host '==> [6/7] Packaging'
$work = Join-Path $root '.deploy'
if (Test-Path $work) { Remove-Item -Recurse -Force $work }
$pkg = Join-Path $work 'pkg'
New-Item -ItemType Directory -Path $pkg | Out-Null
Copy-Item -Recurse (Join-Path $root 'dist') (Join-Path $pkg 'dist')
Copy-Item -Recurse (Join-Path $root 'server') (Join-Path $pkg 'server')
Copy-Item (Join-Path $root 'package.json'), (Join-Path $root 'package-lock.json') $pkg
Push-Location $pkg
try {
  npm ci --omit=dev --no-audit --no-fund
  Assert-Ok 'npm ci --omit=dev'
  $zip = Join-Path $work 'deploy.zip'
  # Windows tar writes a zip when the file name ends in .zip.
  tar -a -c -f $zip dist server node_modules package.json package-lock.json
  Assert-Ok 'Creating deploy.zip'
} finally {
  Pop-Location
}
Write-Host ("    package: {0:N1} MB" -f ((Get-Item $zip).Length / 1MB))

Write-Host '==> [7/7] Deploying'
az webapp config appsettings set -g $env:RESOURCE_GROUP -n $env:WEBAPP `
  --settings SCM_DO_BUILD_DURING_DEPLOYMENT=false --output none
Assert-Ok 'Setting SCM_DO_BUILD_DURING_DEPLOYMENT'
az webapp deploy -g $env:RESOURCE_GROUP -n $env:WEBAPP --src-path $zip --type zip --async true
Assert-Ok 'az webapp deploy'

Write-Host ''
Write-Host 'Upload accepted. Azure now restarts the app. That takes 1 to 2 minutes.'
Write-Host 'Watch it come up (look for "Site startup probe succeeded"). Press Ctrl+C when it does:'
Write-Host "  az webapp log tail -g $env:RESOURCE_GROUP -n $env:WEBAPP"
Write-Host "Then open https://$env:WEBAPP.azurewebsites.net and run the checks in docs/DEPLOYMENT-RUNBOOK.md, Step 7.7."
