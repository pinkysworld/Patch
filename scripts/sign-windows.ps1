param(
  [Parameter(Mandatory=$true)][string]$Root
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($env:PATCH_WINDOWS_PFX_BASE64)) { throw 'PATCH_WINDOWS_PFX_BASE64 is required when Windows signing is required.' }
if ([string]::IsNullOrWhiteSpace($env:PATCH_WINDOWS_PFX_PASSWORD)) { throw 'PATCH_WINDOWS_PFX_PASSWORD is required when Windows signing is required.' }

$kitRoot = "${env:ProgramFiles(x86)}\Windows Kits\10\bin"
$signtool = Get-ChildItem -Path $kitRoot -Filter signtool.exe -Recurse -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -match '\\x64\\signtool\.exe$' } |
  Sort-Object FullName -Descending |
  Select-Object -First 1
if (-not $signtool) { throw 'Windows signtool.exe was not found on this runner.' }

$executables = Get-ChildItem -Path $Root -Filter *.exe -Recurse -File
if (-not $executables -or $executables.Count -eq 0) { throw "No Windows executable was found under '$Root'." }

$tempPfx = Join-Path $env:RUNNER_TEMP ('patch-sign-' + [guid]::NewGuid().ToString('N') + '.pfx')
try {
  [IO.File]::WriteAllBytes($tempPfx, [Convert]::FromBase64String($env:PATCH_WINDOWS_PFX_BASE64))
  foreach ($exe in $executables) {
    & $signtool.FullName sign /fd SHA256 /td SHA256 /tr 'http://timestamp.digicert.com' /f $tempPfx /p $env:PATCH_WINDOWS_PFX_PASSWORD $exe.FullName
    if ($LASTEXITCODE -ne 0) { throw "Authenticode signing failed for '$($exe.FullName)'." }
    & $signtool.FullName verify /pa /v $exe.FullName
    if ($LASTEXITCODE -ne 0) { throw "Authenticode verification failed for '$($exe.FullName)'." }
  }
} finally {
  Remove-Item -LiteralPath $tempPfx -Force -ErrorAction SilentlyContinue
}

Write-Host "Verified Authenticode signatures for $($executables.Count) executable(s)."
