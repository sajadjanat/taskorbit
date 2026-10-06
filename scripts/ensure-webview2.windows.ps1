# Disposable Windows CI runners execute the raw binary, bypassing the NSIS
# installer's WebView2 bootstrapper. Edge Stable is not a WebView2 runtime.
# https://learn.microsoft.com/microsoft-edge/webview2/concepts/distribution
$ErrorActionPreference = 'Stop'
function Get-TaskOrbitWebViewVersion {
  $taskKeys = @(
    'HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}',
    'HKLM:\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}',
    'HKCU:\Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}'
  )
  foreach ($taskKey in $taskKeys) {
    $taskVersion = (Get-ItemProperty -LiteralPath $taskKey -Name pv -ErrorAction SilentlyContinue).pv
    if ($taskVersion -and [version]$taskVersion -gt [version]'0.0.0.0') { return $taskVersion }
  }
  return $null
}
$taskRuntime = Get-TaskOrbitWebViewVersion
Write-Output "WebView2 runtime before provisioning: $($taskRuntime ?? 'missing')"
if (!$taskRuntime) {
  if ($env:CI -ne 'true') { throw 'Runtime provisioning is restricted to disposable CI runners' }
  $taskInstaller = Join-Path $env:RUNNER_TEMP 'MicrosoftEdgeWebview2Setup.exe'
  Invoke-WebRequest 'https://go.microsoft.com/fwlink/p/?LinkId=2124703' -OutFile $taskInstaller
  $taskSignature = Get-AuthenticodeSignature -LiteralPath $taskInstaller
  if ($taskSignature.Status -ne 'Valid' -or $taskSignature.SignerCertificate.Subject -notmatch 'O=Microsoft Corporation') {
    throw 'WebView2 installer must have a valid Microsoft signature'
  }
  $taskInstall = Start-Process -FilePath $taskInstaller -ArgumentList '/silent','/install' -WindowStyle Hidden -PassThru
  if (!$taskInstall.WaitForExit(180000)) { throw 'WebView2 installation timed out' }
  Write-Output "WebView2 bootstrapper exit code: $($taskInstall.ExitCode)"
  for ($taskAttempt = 0; $taskAttempt -lt 30; $taskAttempt++) {
    $taskRuntime = Get-TaskOrbitWebViewVersion
    if ($taskRuntime) { break }
    Start-Sleep -Seconds 2
  }
}
if (!$taskRuntime) { throw 'WebView2 runtime was not registered after installation' }
Write-Output "WebView2 runtime ready: $taskRuntime"
