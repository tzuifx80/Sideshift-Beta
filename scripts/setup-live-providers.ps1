[CmdletBinding()]
param(
  [switch]$CheckOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$envPath = Join-Path $repoRoot '.env.server.local'
$packagePath = Join-Path $repoRoot 'package.json'
$serverPath = Join-Path $repoRoot 'server.mjs'

if (-not (Test-Path -LiteralPath $packagePath) -or -not (Test-Path -LiteralPath $serverPath)) {
  throw 'Run this command from the SideShift repository.'
}

Push-Location $repoRoot
try {
  git check-ignore --no-index --quiet '.env.server.local'
  if ($LASTEXITCODE -ne 0) {
    throw '.env.server.local is not Git-ignored. No configuration was written.'
  }

  $values = @{}
  $lines = @()
  if (Test-Path -LiteralPath $envPath) {
    $lines = @(Get-Content -LiteralPath $envPath)
    foreach ($line in $lines) {
      if ($line -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
        $values[$Matches[1]] = $Matches[2]
      }
    }
  }

  $requiredKeys = @(
    'BASIC_AI_PROVIDER', 'BASIC_AI_MODEL', 'BASIC_AI_API_URL', 'BASIC_AI_API_KEY',
    'FEEDBACK_TO_EMAIL', 'FEEDBACK_FROM_EMAIL', 'FEEDBACK_EMAIL_PROVIDER',
    'FEEDBACK_EMAIL_API_URL', 'FEEDBACK_EMAIL_API_KEY'
  )

  function Has-Value([string]$key) {
    return $values.ContainsKey($key) -and -not [string]::IsNullOrWhiteSpace([string]$values[$key])
  }

  function Show-State([string]$key) {
    $state = if (Has-Value $key) { 'configured' } else { 'missing' }
    Write-Host "$key`: $state"
  }

  Write-Host 'SideShift live provider setup (server-only configuration).'
  Write-Host 'Basic uses the existing OpenAI-compatible adapter. Feedback uses the existing generic HTTP email adapter.'
  Write-Host 'Secret values are never printed or placed in VITE_* variables.'
  Write-Host ''
  Write-Host 'Current configuration:'
  foreach ($key in $requiredKeys) { Show-State $key }

  if ($CheckOnly) { exit 0 }

  function Read-TextValue([string]$key, [string]$prompt, [string]$defaultValue) {
    if (Has-Value $key) { return [string]$values[$key] }
    $answer = Read-Host "$prompt [$defaultValue]"
    if ([string]::IsNullOrWhiteSpace($answer)) { $answer = $defaultValue }
    return $answer.Trim()
  }

  function Read-SecretValue([string]$key, [string]$prompt) {
    if (Has-Value $key) { return [string]$values[$key] }
    $secureValue = Read-Host $prompt -AsSecureString
    $pointer = [IntPtr]::Zero
    try {
      $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureValue)
      return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    } finally {
      if ($pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
      if ($null -ne $secureValue) { $secureValue.Dispose() }
    }
  }

  Write-Host ''
  Write-Host 'Manual action required only if an account or token does not exist:'
  Write-Host '1. Sign in to the selected provider and create a restricted inference/email token.'
  Write-Host '2. Return to this PowerShell window.'
  Write-Host '3. Enter the token only at the hidden prompt below.'
  Write-Host ''

  $values['BASIC_AI_PROVIDER'] = Read-TextValue 'BASIC_AI_PROVIDER' 'Basic provider' 'openai-compatible'
  $values['BASIC_AI_MODEL'] = Read-TextValue 'BASIC_AI_MODEL' 'Basic model identifier' 'gpt-4o-mini'
  $values['BASIC_AI_API_URL'] = Read-TextValue 'BASIC_AI_API_URL' 'Basic chat-completions URL' 'https://api.openai.com/v1/chat/completions'
  $values['BASIC_AI_API_KEY'] = Read-SecretValue 'BASIC_AI_API_KEY' 'Basic API token (hidden)'
  $values['FEEDBACK_EMAIL_PROVIDER'] = Read-TextValue 'FEEDBACK_EMAIL_PROVIDER' 'Feedback email provider label' 'generic-http'
  $values['FEEDBACK_EMAIL_API_URL'] = Read-TextValue 'FEEDBACK_EMAIL_API_URL' 'Feedback email API URL' ''
  $values['FEEDBACK_FROM_EMAIL'] = Read-SecretValue 'FEEDBACK_FROM_EMAIL' 'Feedback sender address (hidden)'
  $values['FEEDBACK_TO_EMAIL'] = Read-SecretValue 'FEEDBACK_TO_EMAIL' 'Feedback destination address (hidden)'
  $values['FEEDBACK_EMAIL_API_KEY'] = Read-SecretValue 'FEEDBACK_EMAIL_API_KEY' 'Feedback email API token (hidden)'

  foreach ($key in $requiredKeys) {
    if (-not (Has-Value $key)) { throw "$key is required. No configuration was written." }
    if ([string]$values[$key] -match '[\r\n]') { throw "$key contains an invalid line break. No configuration was written." }
  }

  $updated = New-Object System.Collections.Generic.HashSet[string]
  $outputLines = New-Object System.Collections.Generic.List[string]
  foreach ($line in $lines) {
    if ($line -match '^([A-Za-z_][A-Za-z0-9_]*)=') {
      $key = $Matches[1]
      if ($values.ContainsKey($key)) {
        [void]$outputLines.Add("$key=$([string]$values[$key])")
        [void]$updated.Add($key)
        continue
      }
    }
    [void]$outputLines.Add($line)
  }
  foreach ($key in $requiredKeys) {
    if (-not $updated.Contains($key)) { [void]$outputLines.Add("$key=$([string]$values[$key])") }
  }

  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [IO.File]::WriteAllLines($envPath, $outputLines, $utf8NoBom)
  Write-Host 'Server-only configuration written to .env.server.local.'
  Write-Host 'Running the non-secret configuration and capability probe...'
  & node '--env-file-if-exists=.env' '--env-file-if-exists=.env.server.local' 'scripts/verify-live-providers.mjs'
  if ($LASTEXITCODE -ne 0) { throw 'Provider configuration probe failed.' }
} finally {
  Pop-Location
}
