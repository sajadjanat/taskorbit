# WebView2 150+ ignores environment overrides in an elevated host process.
# Test-only, application-specific machine policy on a disposable CI runner.
# https://github.com/MicrosoftEdge/WebView2Feedback/issues/5640
param([ValidateSet('Enable','Disable')][string]$Mode, [string]$Profile)
$ErrorActionPreference = 'Stop'
if ($env:CI -ne 'true') { throw 'Native debug policy is restricted to disposable CI runners' }
$taskProfile = [IO.Path]::GetFullPath($Profile)
$taskTemp = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\'
if (!$taskProfile.StartsWith($taskTemp, [StringComparison]::OrdinalIgnoreCase)) { throw 'Profile must be inside the temporary directory' }
$taskPolicies = @{
  'AdditionalBrowserArguments' = '--remote-debugging-port=8767 --no-proxy-server'
  'UserDataFolder' = $taskProfile
}
foreach ($taskPolicy in $taskPolicies.Keys) {
  $taskKey = 'HKLM:\SOFTWARE\Policies\Microsoft\Edge\WebView2\' + $taskPolicy
  $taskCurrent = Get-ItemProperty -LiteralPath $taskKey -Name 'taskorbit.exe' -ErrorAction SilentlyContinue
  if ($Mode -eq 'Enable') {
    if ($taskCurrent) { throw 'Refusing to overwrite existing TaskOrbit WebView2 policy' }
    New-Item -Path $taskKey -Force | Out-Null
    New-ItemProperty -LiteralPath $taskKey -Name 'taskorbit.exe' -Value $taskPolicies[$taskPolicy] -PropertyType String | Out-Null
  } elseif ($taskCurrent) {
    if ($taskCurrent.'taskorbit.exe' -ne $taskPolicies[$taskPolicy]) { throw 'Refusing to remove a policy not created by this test' }
    Remove-ItemProperty -LiteralPath $taskKey -Name 'taskorbit.exe'
  }
}
Write-Output "Temporary TaskOrbit native test policy: $Mode"
