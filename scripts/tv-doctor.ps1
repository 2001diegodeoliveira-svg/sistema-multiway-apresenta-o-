<#
.SYNOPSIS
  Diagnóstico e alívio de cintilação (flicker) em TV Roku na rede local.

.DESCRIPTION
  Consulta o ECP (External Control Protocol) da TV na porta 8060 e mostra:
    - modelo, versão do Roku OS, modo de energia e entrada/app atual
    - se o "Controle por aplicativos móveis" está limitado (ECP limited)

  Opcionalmente envia uma tecla para "sair" de um app travado (ex.: Home),
  que costuma resolver flicker causado por um app específico preso no pipeline
  de vídeo. NÃO faz factory reset nem limpa cache: o Roku OS é fechado e o ECP
  não expõe esses comandos.

.EXAMPLE
  .\tv-doctor.ps1
  .\tv-doctor.ps1 -TV 192.168.1.24 -HomeKey
  .\tv-doctor.ps1 -Key Back
#>
param(
  [string]$TV = "192.168.1.24",
  [switch]$HomeKey,
  [string]$Key
)

$ErrorActionPreference = "Stop"
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$base = "http://${TV}:8060"
$validKeys = @(
  "Home","Rev","Fwd","Play","Select","Left","Right","Down","Up","Back",
  "InstantReplay","Info","Backspace","Search","Enter","VolumeDown",
  "VolumeUp","VolumeMute"
)

function Get-Ecp([string]$Path) {
  (Invoke-WebRequest -Uri "$base$Path" -TimeoutSec 8 -UseBasicParsing).Content
}

Write-Host "== TV Roku em $TV ==" -ForegroundColor Cyan
try {
  [xml]$xml = Get-Ecp "/query/device-info"
} catch {
  Write-Host "Falha ao falar com $base. Confira o IP e se a TV está ligada/na rede." -ForegroundColor Red
  exit 1
}

$d = $xml.'device-info'
$rows = [ordered]@{
  "Nome"            = $d.'friendly-device-name'
  "Fabricante"      = $d.'vendor-name'
  "Modelo"          = "$($d.'model-name') ($($d.'model-number'))"
  "Série"           = $d.'serial-number'
  "Roku OS"         = $d.'software-version'
  "Build"           = $d.'software-build'
  "Modo de energia" = $d.'power-mode'
  "Rede"            = "$($d.'network-type') · $($d.'network-name')"
  "Resolução UI"    = $d.'ui-resolution'
  "País / fuso"     = "$($d.'country') · $($d.'time-zone')"
  "Uptime (s)"      = $d.'uptime'
  "ECP"             = $d.'ecp-setting-mode'
  "Modo de vídeo"   = $d.'ui-resolution'
}
foreach ($k in $rows.Keys) { "{0,-16}: {1}" -f $k, $rows[$k] }

Write-Host ""
try {
  [xml]$app = Get-Ecp "/query/active-app"
  $a = $app.'active-app'.app
  Write-Host ("App/entrada atual: {0}  ({1})" -f $a.InnerText, $a.id) -ForegroundColor Green
} catch {
  Write-Host "Não foi possível ler o app ativo." -ForegroundColor Yellow
}

if ($d.'ecp-setting-mode' -eq "limited") {
  Write-Host ""
  Write-Host "ECP em modo 'limited': abrir apps por rede fica bloqueado (HTTP 403)." -ForegroundColor Yellow
  Write-Host "Para liberar: Configurações > Sistema > Configurações avançadas do sistema >" -ForegroundColor Yellow
  Write-Host "Controle por aplicativos móveis > Habilitado." -ForegroundColor Yellow
}

if ($HomeKey) {
  Write-Host ""
  Write-Host "Enviando tecla Home (sai de app travado, volta ao menu)..." -ForegroundColor Cyan
  try {
    Invoke-WebRequest -Uri "$base/keypress/Home" -Method Post -TimeoutSec 8 -UseBasicParsing | Out-Null
    Write-Host "OK. Se a cintilação sumir no menu, o problema era o app (não o painel)." -ForegroundColor Green
  } catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 403) {
      Write-Host "Bloqueado (403): o ECP está em modo 'limited' e recusa teclas." -ForegroundColor Red
      Write-Host "Ative: Configurações > Sistema > Configurações avançadas do sistema >" -ForegroundColor Yellow
      Write-Host "Controle por aplicativos móveis > Habilitado. Depois rode de novo." -ForegroundColor Yellow
    } else { throw }
  }
}

if ($Key) {
  if ($validKeys -notcontains $Key) {
    Write-Host "Tecla inválida: $Key. Válidas: $($validKeys -join ', ')" -ForegroundColor Red
    exit 1
  }
  Write-Host ""
  Write-Host "Enviando tecla $Key..." -ForegroundColor Cyan
  try {
    Invoke-WebRequest -Uri "$base/keypress/$Key" -Method Post -TimeoutSec 8 -UseBasicParsing | Out-Null
    Write-Host "OK." -ForegroundColor Green
  } catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 403) {
      Write-Host "Bloqueado (403): ECP em modo 'limited'." -ForegroundColor Red
      Write-Host "Ative: Configurações > Sistema > Configurações avançadas do sistema >" -ForegroundColor Yellow
      Write-Host "Controle por aplicativos móveis > Habilitado." -ForegroundColor Yellow
    } else { throw }
  }
}

Write-Host ""
Write-Host "Notas: reset de fábrica e limpeza de cache NÃO são possíveis via rede/ECP." -ForegroundColor DarkGray
Write-Host "Reset de fábrica: Configurações > Sistema > Configurações avançadas do sistema >" -ForegroundColor DarkGray
Write-Host "Redefinição de fábrica (apaga contas e ajustes)." -ForegroundColor DarkGray
