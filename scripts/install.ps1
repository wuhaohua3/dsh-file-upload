# Installs the dsh-file-upload plugin into a DeepSeek Harness web profile.
#
# Usage (run from this release folder):
#   pwsh -File .\install.ps1
#   pwsh -File .\install.ps1 -DshHome "C:\Users\<you>\.dsh"
#
# It is idempotent: re-running repairs the package copy and never duplicates the
# patch row. Restart the Web GUI afterward (or refresh the browser tab).
param(
	[string]$DshHome = $env:DSH_HOME,
	[switch]$NoRestart
)

$ErrorActionPreference = "Stop"
$here = $PSScriptRoot
if (-not $DshHome) { $DshHome = Join-Path $HOME ".dsh" }
$profileDir = Join-Path $DshHome "profiles"
$scoped = Join-Path $profileDir "node_modules\@deepseek-ai"
$target = Join-Path $scoped "dsh-file-upload"

# Locate the package root (a dir containing package.json), in layout order:
#   release zip -> plugin/dsh-file-upload ; git checkout -> parent of scripts/
$src = @(
	(Join-Path $here "plugin\dsh-file-upload"),
	(Split-Path $here -Parent),
	$here
) | Where-Object { Test-Path (Join-Path $_ "package.json") } | Select-Object -First 1

Write-Host "DSH home : $DshHome"
Write-Host "Source   : $src"
Write-Host "Target   : $target"

if (-not $src) {
	Write-Error "The plugin source folder was not found — expected package.json next to or under this script."
	return
}

# 1) Copy the package files into the profile's node_modules (a real directory, so
#    the host resolver finds it without any pnpm/npm install). Only the files the
#    plugin needs: package.json (with the dsh.client declaration) and lib/.
New-Item -ItemType Directory -Force -Path $scoped | Out-Null
if (Test-Path $target) { Remove-Item $target -Recurse -Force }
New-Item -ItemType Directory -Force -Path "$target\lib" | Out-Null
Copy-Item "$src\package.json" -Destination $target -Force
Copy-Item "$src\lib\*" -Destination "$target\lib" -Recurse -Force
Write-Host "[ok] Installed package into $target" -ForegroundColor Green

# 2) Add the `file-upload` row to the web profile's patch layer.
$patch = Join-Path $profileDir "web\cordis.patch.yml"
$row = @"

# file-upload plugin
- insert:
    - id: file-upload
      name: '@deepseek-ai/dsh-file-upload'
"@
if (Test-Path $patch) {
	$content = Get-Content $patch -Raw -Encoding UTF8
	if ($content -match "dsh-file-upload") {
		Write-Host "[ok] file-upload row already present in $patch" -ForegroundColor Green
	} else {
		Add-Content -Path $patch -Value $row -Encoding UTF8
		Write-Host "[ok] Added file-upload row to $patch" -ForegroundColor Green
	}
} else {
	Write-Warning "No web/cordis.patch.yml at $patch — the 'web' profile may not exist yet. Start it once with: dsh web"
	Write-Warning "Then add the row below manually, or re-run this installer."
	Write-Host $row
}

# 3) Next step.
Write-Host ""
Write-Host "Done. To apply it live:" -ForegroundColor Cyan
Write-Host "  - If the web server is already running, reload the browser tab (http://127.0.0.1:3080)." -ForegroundColor Cyan
if (-not $NoRestart) {
	Write-Host "  - Or restart it with: dsh web" -ForegroundColor Cyan
}
