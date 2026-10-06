param([string]$Executable)
$ErrorActionPreference='Stop'
$taskClient=Start-Process -FilePath (Resolve-Path -LiteralPath $Executable) -WindowStyle Hidden -PassThru
Write-Output $taskClient.Id
