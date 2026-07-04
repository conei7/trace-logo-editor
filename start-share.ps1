param(
  [int]$Port = 8787,
  [switch]$NoBrowser
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverOut = Join-Path $root "local-server.out.log"
$serverErr = Join-Path $root "local-server.err.log"
$tunnelOut = Join-Path $root "cloudflared.out.log"
$tunnelErr = Join-Path $root "cloudflared.err.log"
$sessionFile = Join-Path $root "share-session.json"

function Find-FreePort {
  param([int]$StartPort)

  for ($candidate = $StartPort; $candidate -lt ($StartPort + 100); $candidate += 1) {
    $listener = $null
    try {
      $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $candidate)
      $listener.Start()
      return $candidate
    } catch {
      # Try the next port.
    } finally {
      if ($null -ne $listener) {
        $listener.Stop()
      }
    }
  }

  throw "No free port found from $StartPort to $($StartPort + 99)."
}

function Wait-ForLocalServer {
  param([int]$ServerPort)

  for ($attempt = 0; $attempt -lt 40; $attempt += 1) {
    try {
      $client = [System.Net.Sockets.TcpClient]::new()
      $connect = $client.BeginConnect("127.0.0.1", $ServerPort, $null, $null)
      if ($connect.AsyncWaitHandle.WaitOne(250)) {
        $client.EndConnect($connect)
        $client.Close()
        return
      }
      $client.Close()
    } catch {
      Start-Sleep -Milliseconds 250
    }
  }

  throw "Local server did not start on port $ServerPort."
}

function Read-LogText {
  param([string[]]$Paths)

  $chunks = foreach ($path in $Paths) {
    if (Test-Path -LiteralPath $path) {
      Get-Content -LiteralPath $path -Raw -ErrorAction SilentlyContinue
    }
  }

  return ($chunks -join "`n")
}

function Wait-ForTunnelUrl {
  param([string[]]$Paths)

  for ($attempt = 0; $attempt -lt 120; $attempt += 1) {
    $text = Read-LogText -Paths $Paths
    $matches = [regex]::Matches($text, "https://[a-zA-Z0-9-]+\.trycloudflare\.com")
    foreach ($match in $matches) {
      if ($match.Value -ne "https://api.trycloudflare.com") {
        return $match.Value
      }
    }
    Start-Sleep -Milliseconds 500
  }

  throw "Cloudflare tunnel started, but no trycloudflare URL appeared in the logs."
}

$currentPath = [Environment]::GetEnvironmentVariable("Path", "Process")
if ($currentPath) {
  [Environment]::SetEnvironmentVariable("PATH", $null, "Process")
  [Environment]::SetEnvironmentVariable("Path", $currentPath, "Process")
}

$node = Get-Command node -ErrorAction Stop
$cloudflared = Get-Command cloudflared -ErrorAction Stop
$port = Find-FreePort -StartPort $Port
$localUrl = "http://127.0.0.1:$port"

Set-Content -LiteralPath $serverOut -Value "" -Encoding utf8
Set-Content -LiteralPath $serverErr -Value "" -Encoding utf8
Set-Content -LiteralPath $tunnelOut -Value "" -Encoding utf8
Set-Content -LiteralPath $tunnelErr -Value "" -Encoding utf8

$server = $null
$tunnel = $null

try {
  Write-Host "Starting Trace Logo Editor on $localUrl ..."
  $server = Start-Process `
    -FilePath $node.Source `
    -ArgumentList "local-server.mjs $port" `
    -WorkingDirectory $root `
    -RedirectStandardOutput $serverOut `
    -RedirectStandardError $serverErr `
    -WindowStyle Hidden `
    -PassThru

  Wait-ForLocalServer -ServerPort $port

  Write-Host "Starting Cloudflare quick tunnel ..."
  $tunnel = Start-Process `
    -FilePath $cloudflared.Source `
    -ArgumentList "tunnel --url $localUrl --no-autoupdate" `
    -WorkingDirectory $root `
    -RedirectStandardOutput $tunnelOut `
    -RedirectStandardError $tunnelErr `
    -WindowStyle Hidden `
    -PassThru

  $publicUrl = Wait-ForTunnelUrl -Paths @($tunnelErr, $tunnelOut)

  Write-Host ""
  Write-Host "Local:  $localUrl"
  Write-Host "Share:  $publicUrl"
  Write-Host ""
  Write-Host "The share URL has been copied to the clipboard."
  Write-Host "Keep this window open while sharing. Press Ctrl+C to stop."
  Set-Clipboard -Value $publicUrl
  @{
    localUrl = $localUrl
    publicUrl = $publicUrl
    serverPid = $server.Id
    tunnelPid = $tunnel.Id
    startedAt = (Get-Date).ToString("o")
  } | ConvertTo-Json | Set-Content -LiteralPath $sessionFile -Encoding utf8

  if (-not $NoBrowser) {
    Start-Process $publicUrl | Out-Null
  }

  while ($true) {
    if ($server.HasExited) {
      throw "Local server stopped. Check $serverErr"
    }
    if ($tunnel.HasExited) {
      throw "Cloudflare tunnel stopped. Check $tunnelErr"
    }
    Start-Sleep -Seconds 1
  }
} finally {
  if ($null -ne $tunnel -and -not $tunnel.HasExited) {
    Stop-Process -Id $tunnel.Id -Force
  }
  if ($null -ne $server -and -not $server.HasExited) {
    Stop-Process -Id $server.Id -Force
  }
  if (Test-Path -LiteralPath $sessionFile) {
    Remove-Item -LiteralPath $sessionFile -Force
  }
}
