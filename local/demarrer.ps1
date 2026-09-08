param(
    # Utilise par le demarrage automatique a l'ouverture de session : lance le
    # serveur sans ouvrir de fenetre de navigateur.
    [switch]$SansNavigateur
)

# Lancement local de Novamap Clients.
#
# Le serveur n'ecoute que sur 127.0.0.1 : sans Entra ID configure l'acces n'est
# pas authentifie, il ne doit donc pas sortir de la machine.
#
# Si le serveur tourne deja, ce script se contente d'ouvrir le navigateur.

$ErrorActionPreference = 'Stop'
$Racine  = Split-Path -Parent $PSScriptRoot
$Port    = 3000
$Base    = "http://127.0.0.1:$Port"
$Url     = "$Base/clients"
$Attente = 180

function Test-Repond {
    try {
        $r = Invoke-WebRequest -Uri "$Base/api/health" -TimeoutSec 3 -UseBasicParsing
        return $r.StatusCode -eq 200
    } catch { return $false }
}

function Test-PortOccupe {
    return $null -ne (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

# Le script tourne fenetre masquee : sans cela, un echec serait totalement
# silencieux et l'utilisateur resterait devant un navigateur en erreur.
function Show-Erreur($message) {
    Add-Type -AssemblyName PresentationFramework -ErrorAction SilentlyContinue
    [System.Windows.MessageBox]::Show($message, 'Novamap Clients', 'OK', 'Warning') | Out-Null
}

if (Test-Repond) {
    if (-not $SansNavigateur) { Start-Process $Url }
    exit 0
}

# Port pris mais aucune reponse : un serveur est reste dans un etat bancal.
# Le relancer par-dessus ferait basculer Next.js sur un autre port, ce qui
# donne une application joignable a une adresse inattendue.
if (Test-PortOccupe) {
    Show-Erreur "Le port $Port est occupe par un programme qui ne repond pas.`n`nUtilisez le raccourci « Novamap Clients - Arreter », puis relancez."
    exit 1
}

Set-Location $Racine

if (-not (Test-Path (Join-Path $Racine 'node_modules'))) {
    Show-Erreur "Dependances absentes.`n`nOuvrez un terminal dans :`n$Racine`npuis lancez : npm install"
    exit 1
}

# Mode developpement assume : c'est le seul mode ou l'application autorise un
# acces local sans Entra ID.
Start-Process -FilePath 'npm.cmd' `
    -ArgumentList 'run','dev','--','-H','127.0.0.1','-p',"$Port" `
    -WorkingDirectory $Racine `
    -WindowStyle Hidden

for ($i = 0; $i -lt $Attente; $i++) {
    Start-Sleep -Seconds 1
    if (Test-Repond) {
        if (-not $SansNavigateur) { Start-Process $Url }
        exit 0
    }
}

if (-not $SansNavigateur) {
    Show-Erreur "Le serveur n'a pas repondu en $Attente secondes.`n`nPour voir l'erreur, ouvrez un terminal dans :`n$Racine`npuis lancez : npm run dev"
}
exit 1
