# Arrete le serveur local de Novamap Clients.
$ErrorActionPreference = 'SilentlyContinue'
$cible = Get-NetTCPConnection -LocalPort 3000 -State Listen |
         Select-Object -ExpandProperty OwningProcess -Unique
if (-not $cible) { Write-Host 'Le serveur ne tourne pas.'; exit 0 }
foreach ($procId in $cible) {
    Get-CimInstance Win32_Process -Filter "ParentProcessId = $procId" |
        ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
    Stop-Process -Id $procId -Force
}
Write-Host 'Serveur arrete.'
