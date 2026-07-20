$previousApiBaseUrl = [Environment]::GetEnvironmentVariable('VITE_API_BASE_URL', 'Process')
$env:VITE_API_BASE_URL = 'https://api.example.invalid'
$exitCode = 0

try {
  npm run android:build
  $exitCode = $LASTEXITCODE
} finally {
  if ($null -eq $previousApiBaseUrl) {
    Remove-Item Env:VITE_API_BASE_URL -ErrorAction SilentlyContinue
  } else {
    $env:VITE_API_BASE_URL = $previousApiBaseUrl
  }
}

exit $exitCode
