Add-Type -AssemblyName System.Drawing

$imgLogo = [System.Drawing.Image]::FromFile("public/images/contract/header-logo.png")
$imgText = [System.Drawing.Image]::FromFile("public/images/contract/header-banner.png")

$w = $imgLogo.Width + $imgText.Width + 20
$h = [Math]::Max($imgLogo.Height, $imgText.Height)

$bmp = New-Object System.Drawing.Bitmap($w, $h)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::White)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality

$g.DrawImage($imgLogo, 0, [int](($h - $imgLogo.Height) / 2), $imgLogo.Width, $imgLogo.Height)
$g.DrawImage($imgText, $imgLogo.Width + 20, [int](($h - $imgText.Height) / 2), $imgText.Width, $imgText.Height)

$g.Dispose()
$imgLogo.Dispose()
$imgText.Dispose()

$bmp.Save("public/images/contract/header-full-banner.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Host "Combined image created: header-full-banner.png"

