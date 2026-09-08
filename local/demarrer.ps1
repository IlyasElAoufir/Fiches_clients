# Lancement local de Novamap Clients.
#
# L'application tourne sur ce poste et n'est joignable que depuis ce poste :
# le serveur ecoute sur 127.0.0.1 uniquement. C'est volontaire — sans Entra ID
# configure, l'acces n'est pas authentifie, il ne doit donc pas sortir de la
# machine.
#
# Si le serveur tourne deja, ce script se contente d'ouvrir le navigateur.

param(
    # Utilise par le demarrage automatique a l'ouverture de session : lance le
    # serveur sans ouvrir de fenetre de navigateur.
    [switch]$SansNavigateur
)

$ErrorActionPreference = 'Stop'
$Racine = Split-Path -Parent $PSScriptRoot
$Port   = 3000
$Url    = "http://127.0.0.1:$Port"

function Test-Repond {
    try {
        $r = Invoke-WebRequest -Uri "$Url/api/health" -TimeoutSec 3 -UseBasicParsing
        return $r.StatusCode -eq 200
    } catch { return $false }
}

if (Test-Repond) {
    if (-not $SansNavigateur) { Start-Process $Url }
    exit 0
}

Set-Location $Racine

if (-not (Test-Path (Join-Path $Racine 'node_modules'))) {
    Write-Host 'Installation des dependances, patientez...'
    & npm install | Out-Null
}

# Demarre le serveur de developpement, fenetre masquee.
# Mode developpement assume : c'est le seul mode ou l'application autorise un
# acces local sans Entra ID, et elle l'affiche par un bandeau.
Start-Process -FilePath 'npm.cmd' `
    -ArgumentList 'run','dev','--','-H','127.0.0.1','-p',"$Port" `
    -WorkingDirectory $Racine `
    -WindowStyle Hidden

Write-Host 'Demarrage du serveur...'
for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 1
    if (Test-Repond) {
        if (-not $SansNavigateur) { Start-Process $Url }
        exit 0
    }
}

Write-Warning "Le serveur n'a pas repondu en 60 secondes. Ouvrez $Url manuellement."
exit 1
