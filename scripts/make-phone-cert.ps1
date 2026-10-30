$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$dir = Join-Path $root 'data\certs'
New-Item -ItemType Directory -Force -Path $dir | Out-Null

$ips = @('127.0.0.1')
Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
  ForEach-Object { if ($ips -notcontains $_.IPAddress) { $ips += $_.IPAddress } }

$sanParts = @('DNS=localhost', 'DNS=siyabonga.local') + ($ips | ForEach-Object { "IPAddress=$_" })
$san = $sanParts -join '&'
$pfx = Join-Path $dir 'shop.pfx'
$cer = Join-Path $dir 'shop.cer'
$stamp = Join-Path $dir 'hosts.txt'

$cert = New-SelfSignedCertificate `
  -Subject 'CN=Siyabonga shop' `
  -CertStoreLocation 'Cert:\CurrentUser\My' `
  -KeyExportPolicy Exportable `
  -KeyAlgorithm RSA `
  -KeyLength 2048 `
  -NotAfter (Get-Date).AddYears(2) `
  -TextExtension @("2.5.29.17={text}$san")

$pass = ConvertTo-SecureString 'siyabonga-local' -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath $pfx -Password $pass | Out-Null
Export-Certificate -Cert $cert -FilePath $cer | Out-Null
Set-Content -Path $stamp -Value ($ips -join ',') -NoNewline
Write-Output ("cert-ready " + ($ips -join ','))
