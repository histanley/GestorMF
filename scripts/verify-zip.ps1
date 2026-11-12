Add-Type -AssemblyName System.IO.Compression.FileSystem
$z = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path "gestormf-deploy.zip").Path)
$z.Entries | Select-Object -First 10 | ForEach-Object { Write-Host $_.FullName }
$z.Dispose()

