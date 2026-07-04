Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$sessionFile = Join-Path $root "share-session.json"

if (-not (Test-Path -LiteralPath $sessionFile)) {
  Write-Host "No active share session was found."
  exit 0
}

$session = Get-Content -LiteralPath $sessionFile -Raw | ConvertFrom-Json
$pids = @($session.tunnelPid, $session.serverPid) | Where-Object { $_ }

foreach ($processId in $pids) {
  $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
  if ($null -ne $process) {
    Stop-Process -Id $processId -Force
    Write-Host "Stopped process $processId."
  }
}

Remove-Item -LiteralPath $sessionFile -Force
Write-Host "Share session stopped."
