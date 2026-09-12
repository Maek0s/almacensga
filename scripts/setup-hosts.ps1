$ErrorActionPreference = 'Stop'

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
$adminRole = [Security.Principal.WindowsBuiltInRole]::Administrator

if (-not $principal.IsInRole($adminRole)) {
  throw 'Ejecuta este script desde PowerShell como Administrador.'
}

$hostsPath = Join-Path $env:SystemRoot 'System32\drivers\etc\hosts'
$entries = @(
  '127.0.0.1 almacensga.es',
  '127.0.0.1 api.almacensga.es'
)
$current = @(Get-Content -LiteralPath $hostsPath)

foreach ($entry in $entries) {
  $hostName = ($entry -split '\s+')[1]
  $exists = $current | Where-Object {
    $_ -match ('^\s*127\.0\.0\.1\s+' + [regex]::Escape($hostName) + '\s*(#.*)?$')
  }

  if (-not $exists) {
    Add-Content -LiteralPath $hostsPath -Value $entry
    Write-Host "Añadido: $entry"
  } else {
    Write-Host "Ya existe: $entry"
  }
}

ipconfig /flushdns | Out-Null
Write-Host 'Caché DNS vaciada. Reinicia el navegador si aún conserva la resolución anterior.'
