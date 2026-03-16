$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $root "dist"
New-Item -ItemType Directory -Force -Path $dist | Out-Null

Push-Location $root
try {
  Write-Host "Bundling app (esbuild)..."
  npx --yes esbuild index.mjs --bundle --platform=node --format=cjs --target=node18 --outfile dist/sea-main.cjs | Out-Null

  Write-Host "Generating SEA blob..."
  $nodePath = $env:SEA_NODE_BIN
  if (-not $nodePath) { $nodePath = (Get-Command node).Source }
  if (-not (Test-Path $nodePath)) { throw "node not found. Set SEA_NODE_BIN or ensure node is in PATH." }
  & $nodePath --experimental-sea-config sea-config.json | Out-Null

  $exeOut = Join-Path $dist "bot.exe"
  Copy-Item -Force $nodePath $exeOut

  $blob = Join-Path $dist "sea-prep.blob"
  if (-not (Test-Path $blob)) { throw "missing blob: $blob" }

  Write-Host "Injecting blob (requires postject via npx)..."
  npx --yes postject $exeOut NODE_SEA_BLOB $blob `
    --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 `
    --overwrite | Out-Null

  Write-Host "Done: $exeOut"
  Write-Host "Run in dist/ with config.json: .\\bot.exe"
} finally {
  Pop-Location
}
