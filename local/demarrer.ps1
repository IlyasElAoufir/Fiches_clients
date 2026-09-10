param(
    # Utilise par le demarrage automatique : ni fenetre, ni navigateur.
    [switch]$SansNavigateur
)

# Lancement local de Novamap Clients.
#
# On fait tourner la version de PRODUCTION (`next start`), qui demarre en une
# seconde, et non le mode developpement qui recompile a chaque depart a froid —
# plusieurs minutes, sans le moindre signe a l'ecran.
#
# L'ecoute est restreinte a 127.0.0.1, et ACCES_LOCAL_SANS_AUTH n'est accepte
# par l'application que dans ce cas precis (voir config/env.ts).

$ErrorActionPreference = 'Stop'
$Racine  = Split-Path -Parent $PSScriptRoot
$Port    = 3000
$Base    = "http://127.0.0.1:$Port"
$Url     = "$Base/clients"

function Test-Repond {
    try {
        $r = Invoke-WebRequest -Uri "$Base/api/health" -TimeoutSec 3 -UseBasicParsing
        return $r.StatusCode -eq 200
    } catch { return $false }
}

function Test-PortOccupe {
    return $null -ne (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

function Show-Erreur($message) {
    if ($SansNavigateur) { Write-Warning $message; return }
    Add-Type -AssemblyName PresentationFramework -ErrorAction SilentlyContinue
    [System.Windows.MessageBox]::Show($message, 'Novamap Clients', 'OK', 'Warning') | Out-Null
}

# --- Deja en route ? --------------------------------------------------------
if (Test-Repond) {
    if (-not $SansNavigateur) { Start-Process $Url }
    exit 0
}

if (Test-PortOccupe) {
    Show-Erreur "Le port $Port est occupe par un programme qui ne repond pas.`n`nUtilisez le raccourci « Novamap Clients - Arreter », puis relancez."
    exit 1
}

Set-Location $Racine

if (-not (Test-Path (Join-Path $Racine 'node_modules'))) {
    Show-Erreur "Dependances absentes.`n`nOuvrez un terminal dans :`n$Racine`npuis lancez : npm install"
    exit 1
}

# --- Construction, uniquement si elle manque --------------------------------
# `next dev` et `next build` ecrivent dans le meme dossier .next et s'ecrasent
# mutuellement : BUILD_ID absent signifie qu'il faut reconstruire.
if (-not (Test-Path (Join-Path $Racine '.next\BUILD_ID'))) {
    if ($SansNavigateur) {
        # Au demarrage de session, on ne lance pas une construction longue en
        # silence : le raccourci du bureau s'en chargera, avec sa fenetre.
        Write-Warning 'Application non construite ; lancez le raccourci du bureau.'
        exit 1
    }
    Write-Host ''
    Write-Host '  Premiere preparation de Novamap Clients.' -ForegroundColor Cyan
    Write-Host '  Cela ne se produit qu une fois, comptez une a deux minutes.'
    Write-Host ''
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path (Join-Path $Racine '.next\BUILD_ID'))) {
        Show-Erreur "La construction a echoue.`n`nOuvrez un terminal dans :`n$Racine`npuis lancez : npm run build"
        exit 1
    }
}

# --- Demarrage --------------------------------------------------------------
$env:HOSTNAME = '127.0.0.1'
$env:ACCES_LOCAL_SANS_AUTH = '1'

if (-not $SansNavigateur) {
    Write-Host ''
    Write-Host '  Demarrage de Novamap Clients...' -ForegroundColor Cyan
}

Start-Process -FilePath 'npm.cmd' `
    -ArgumentList 'run','start','--','-H','127.0.0.1','-p',"$Port" `
    -WorkingDirectory $Racine `
    -WindowStyle Hidden

for ($i = 0; $i -lt 90; $i++) {
    Start-Sleep -Seconds 1
    if (Test-Repond) {
        if (-not $SansNavigateur) { Start-Process $Url }
        exit 0
    }
}

Show-Erreur "Le serveur n'a pas repondu en 90 secondes.`n`nPour voir l'erreur, ouvrez un terminal dans :`n$Racine`npuis lancez : npm run start"
exit 1
