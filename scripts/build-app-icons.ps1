$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$iconDir = Join-Path (Split-Path $PSScriptRoot -Parent) "icons"
New-Item -ItemType Directory -Path $iconDir -Force | Out-Null
$iconSizes = @{
    "apple-touch-icon.png" = 180
    "icon-192.png" = 192
    "icon-512.png" = 512
}

foreach ($entry in $iconSizes.GetEnumerator()) {
    $size = [int]$entry.Value
    $bitmap = [System.Drawing.Bitmap]::new($size, $size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $pen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 255, 254, 250), [single]($size * 0.07))
    try {
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $graphics.Clear([System.Drawing.Color]::FromArgb(255, 29, 33, 31))
        $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Square
        $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Square
        $graphics.DrawLine($pen, [single]($size * 0.28), [single]($size * 0.28), [single]($size * 0.72), [single]($size * 0.28))
        $graphics.DrawLine($pen, [single]($size * 0.5), [single]($size * 0.28), [single]($size * 0.5), [single]($size * 0.72))
        $bitmap.Save((Join-Path $iconDir $entry.Key), [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
        $pen.Dispose()
        $graphics.Dispose()
        $bitmap.Dispose()
    }
}
