param([switch]$CheckOnly)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $taskRoot
$taskDocker = Get-Command docker -ErrorAction SilentlyContinue
if (-not $taskDocker) {
    $taskCandidate = 'C:\Program Files\Docker\Docker\resources\bin\docker.exe'
    if (Test-Path -LiteralPath $taskCandidate) { $taskDocker = Get-Item -LiteralPath $taskCandidate }
}
if (-not $taskDocker) { throw 'Install and start Docker Desktop with Linux containers, then run npm run tide:check.' }
$taskDockerPath = if ($taskDocker.Source) { $taskDocker.Source } else { $taskDocker.FullName }
$taskDockerOs = & $taskDockerPath info --format '{{.OSType}}'
if ($LASTEXITCODE -ne 0 -or $taskDockerOs -ne 'linux') { throw 'Docker is installed but its Linux engine is unavailable.' }
if ($CheckOnly) { Write-Output 'Docker engine available. No container or realm was created.'; exit 0 }

# Bootstrap-only file. Never loaded by Next.js or committed. No password on the command line.
$taskEnvPath = Join-Path $taskRoot '.env.tide-bootstrap'
if (-not (Test-Path -LiteralPath $taskEnvPath)) { throw 'Create .env.tide-bootstrap from docs/tide-setup.md. A person must provide licence consent and email.' }
$taskValues = @{}
foreach ($taskLine in [IO.File]::ReadAllLines($taskEnvPath)) {
    if ($taskLine -match '^([A-Z_]+)=(.*)$') { $taskValues[$Matches[1]] = $Matches[2] }
}
if ($taskValues['TIDE_TERMS_ACCEPTED'] -ne 'yes' -or $taskValues['TIDE_LICENSE_EMAIL'] -notmatch '^[^\s@]+@[^\s@]+\.[^\s@]+$') {
    throw 'A licence email and explicit human acceptance of https://tide.org/legal are required.'
}
if ($taskValues['TIDE_HOSTING'] -ne 'docker') { throw 'Choose local Docker before creating a realm. Realms cannot move between hosting modes.' }
if (-not $taskValues['KC_BOOTSTRAP_ADMIN_PASSWORD']) {
    $taskSecret = New-Object byte[] 32
    $taskRng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $taskRng.GetBytes($taskSecret) } finally { $taskRng.Dispose() }
    $taskValues['KC_BOOTSTRAP_ADMIN_PASSWORD'] = [Convert]::ToBase64String($taskSecret)
    [IO.File]::AppendAllText($taskEnvPath, "`nKC_BOOTSTRAP_ADMIN_PASSWORD=$($taskValues['KC_BOOTSTRAP_ADMIN_PASSWORD'])`n")
}
$taskDataPath = Join-Path $taskRoot 'data'
New-Item -ItemType Directory -Force -Path $taskDataPath | Out-Null
$taskContainerEnv = Join-Path $taskDataPath 'tide-container.env'
[IO.File]::WriteAllLines($taskContainerEnv, @('KC_BOOTSTRAP_ADMIN_USERNAME=admin', "KC_BOOTSTRAP_ADMIN_PASSWORD=$($taskValues['KC_BOOTSTRAP_ADMIN_PASSWORD'])"))
$taskName = 'tidecloak-sealed-vault'
$taskExisting = & $taskDockerPath ps -a --filter "name=^/$taskName`$" --format '{{.Names}}'
if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect Docker containers.' }
if ($taskExisting) {
    $taskLabels = (& $taskDockerPath inspect --format '{{json .Config.Labels}}' $taskName | ConvertFrom-Json)
    if ($LASTEXITCODE -ne 0 -or $taskLabels.'org.sealed-vault.owner' -ne 'sealed-vault') { throw 'Container name belongs to another setup. Nothing was changed.' }
    $taskMounts = @(& $taskDockerPath inspect --format '{{json .Mounts}}' $taskName | ConvertFrom-Json)
    if (-not ($taskMounts | Where-Object { $_.Name -eq 'sealed-vault-tide-data' -and $_.Destination -eq '/opt/keycloak/data/h2' })) { throw 'Unexpected project volume mapping.' }
    $taskRunning = & $taskDockerPath inspect --format '{{.State.Running}}' $taskName
    if ($taskRunning -ne 'true') {
        & $taskDockerPath run --rm --user 0:0 --entrypoint /bin/sh --mount type=volume,source=sealed-vault-tide-data,target=/opt/keycloak/data/h2 tideorg/tidecloak-dev:latest -c 'chown -R 1000:1000 /opt/keycloak/data/h2'
        if ($LASTEXITCODE -ne 0) { throw 'Cannot prepare permissions on the project volume.' }
    }
    & $taskDockerPath start $taskName | Out-Null
} else {
    $taskPort = Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue
    if ($taskPort) { throw 'Port 8080 is already in use. No existing service was stopped.' }
    $taskOldVolume = & $taskDockerPath volume ls --filter 'name=^sealed-vault-tide-data$' --format '{{.Name}}'
    if ($taskOldVolume) { throw 'The data volume already exists without this project container. Inspect it before reusing it.' }
    & $taskDockerPath volume create --label org.sealed-vault.owner=sealed-vault sealed-vault-tide-data | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Cannot create the project data volume.' }
    & $taskDockerPath run --rm --user 0:0 --entrypoint /bin/sh --mount type=volume,source=sealed-vault-tide-data,target=/opt/keycloak/data/h2 tideorg/tidecloak-dev:latest -c 'chown -R 1000:1000 /opt/keycloak/data/h2'
    if ($LASTEXITCODE -ne 0) { throw 'Cannot prepare permissions on the project volume.' }
    & $taskDockerPath run -d --name $taskName --label org.sealed-vault.owner=sealed-vault --mount type=volume,source=sealed-vault-tide-data,target=/opt/keycloak/data/h2 -p 127.0.0.1:8080:8080 --env-file $taskContainerEnv tideorg/tidecloak-dev:latest | Out-Null
}
if ($LASTEXITCODE -ne 0) { throw 'TideCloak container could not start.' }
for ($taskAttempt = 0; $taskAttempt -lt 24; $taskAttempt++) {
    try { Invoke-WebRequest -Uri 'http://localhost:8080/realms/master/.well-known/openid-configuration' -UseBasicParsing -TimeoutSec 5 | Out-Null; break }
    catch { if ($taskAttempt -eq 23) { throw 'TideCloak did not become ready. Inspect container logs locally; do not publish credentials.' }; Start-Sleep -Seconds 5 }
}
$taskImage = & $taskDockerPath inspect --format '{{.Image}}' $taskName
if ($taskImage -match '^sha256:[a-f0-9]{64}$') { [IO.File]::WriteAllText((Join-Path $taskDataPath 'tide-image.json'), (@{imageDigest=$taskImage; observedAt=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json)) }
Write-Output 'TideCloak infrastructure is available at http://localhost:8080. Continue realm setup with docs/tide-setup.md.'
