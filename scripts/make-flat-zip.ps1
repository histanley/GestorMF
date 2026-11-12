$ProgressPreference = 'SilentlyContinue'
$distDir = Join-Path $PSScriptRoot "..\dist"
$zipFile = Join-Path $PSScriptRoot "..\gestormf-deploy.zip"

if (Test-Path $zipFile) {
    Remove-Item -Path $zipFile -Force
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory((Resolve-Path $distDir).Path, $zipFile, [System.IO.Compression.CompressionLevel]::Optimal, $false)

$item = Get-Item $zipFile
Write-Host "ZIP flat criado com sucesso!"
Write-Host "Arquivo: $($item.FullName)"
Write-Host "Tamanho: $([math]::Round($item.Length / 1MB, 2)) MB"

