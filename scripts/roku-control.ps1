<#
.SYNOPSIS
  Controle completo de TV Roku via ECP (External Control Protocol, porta 8060).

.DESCRIPTION
  Requer "Controle por aplicativos móveis" = HABILITADO na TV:
    Configurações > Sistema > Configurações avançadas do sistema >
    Controle por aplicativos móveis > Acesso pela rede > Habilitado

  No modo "limited" a TV responde apenas /query/device-info e bloqueia o resto (403).

.EXAMPLES
  .\roku-control.ps1                       # info do aparelho + modo ECP
  .\roku-control.ps1 -Apps                 # lista apps instalados (com IDs)
  .\roku-control.ps1 -Key Home             # teclas de navegação
  .\roku-control.ps1 -Key Select
  .\roku-control.ps1 -Launch 12            # abre um app pelo ID (12 = Netflix, 13 = Prime Video)
  .\roku-control.ps1 -Launch tvinput.hdmi1 # muda para HDMI1
  .\roku-control.ps1 -Power Off
  .\roku-control.ps1 -Power On
  .\roku-control.ps1 -Text "minha senha"   # digita no campo de busca (best effort)
#>
param(
  [string]$TV = "192.168.1.24",
  [switch]$Info,
  [switch]$Apps,
  [string]$Key,
  [string]$Launch,
  [ValidateSet("On", "Off")] [string]$Power,
  [string]$Text
)

$ErrorActionPreference = "Stop"
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$base = "http://${TV}:8060"

$KEYS = @(
  "Home","Rev","Fwd","Play","Select","Left","Right","Down","Up","Back",
  "InstantReplay","Info","Backspace","Search","Enter",
  "VolumeDown","VolumeUp","VolumeMute","PowerOff","PowerOn"
)

function Invoke-Ecp {
  param([string]$Method, [string]$Path)
  Invoke-WebRequest -Uri "$base$Path" -Method $Method -TimeoutSec 8 -UseBasicParsing
}

function Write-LimitedHelp {
  Write-Host "403 Proibido: o ECP da TV está em modo 'limited'." -ForegroundColor Red
  Write-Host "Na TV, com o controle remoto:" -ForegroundColor Yellow
  Write-Host "  Configurações > Sistema > Configurações avançadas do sistema >" -ForegroundColor Yellow
  Write-Host "  Controle por aplicativos móveis > Acesso pela rede > Habilitado" -ForegroundColor Yellow
}

function Send-Key([string]$k) {
  if ($KEYS -notcontains $k) {
    throw "Tecla inválida: $k. Válidas: $($KEYS -join ', ')"
  }
  Invoke-Ecp Post "/keypress/$k" | Out-Null
}

# Sem argumentos: mostra info
if (-not $Apps -and -not $Key -and -not $Launch -and -not $Power -and -not $Text) { $Info = $true }

if ($Info) {
  try {
    [xml]$xml = (Invoke-Ecp Get "/query/device-info").Content
    $d = $xml.'device-info'
    $rows = [ordered]@{
      "Nome"            = $d.'friendly-device-name'
      "Fabricante"      = $d.'vendor-name'
      "Modelo"          = "$($d.'model-name') ($($d.'model-number'))"
      "Serie"           = $d.'serial-number'
      "Roku OS"         = $d.'software-version'
      "Energia"         = $d.'power-mode'
      "Rede"            = "$($d.'network-type') / $($d.'network-name')"
      "Resolucao"       = $d.'ui-resolution'
      "ECP"             = $d.'ecp-setting-mode'
    }
    foreach ($k in $rows.Keys) { "{0,-14}: {1}" -f $k, $rows[$k] }
    try {
      [xml]$ap = (Invoke-Ecp Get "/query/active-app").Content
      $a = $ap.'active-app'.app
      Write-Host ("App atual     : {0}  ({1})" -f $a.InnerText, $a.id) -ForegroundColor Green
    } catch {}
    if ($d.'ecp-setting-mode' -eq "limited") {
      Write-Host ""
      Write-LimitedHelp
    }
  } catch {
    Write-Host "Nao foi possivel falar com $base. Confira o IP e a rede." -ForegroundColor Red
    exit 1
  }
}

if ($Apps) {
  try {
    [xml]$x = (Invoke-Ecp Get "/query/apps").Content
    Write-Host "Apps instalados:" -ForegroundColor Cyan
    $x.apps.app | Sort-Object { $_.'#text' } | ForEach-Object {
      "{0,-8} {1}" -f $_.id, $_.'#text'
    }
  } catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 403) { Write-LimitedHelp } else { throw }
  }
}

if ($Key) {
  try { Send-Key $Key; Write-Host "Tecla '$Key' enviada." -ForegroundColor Green }
  catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 403) { Write-LimitedHelp } else { throw }
  }
}

if ($Power) {
  $k = if ($Power -eq "On") { "PowerOn" } else { "PowerOff" }
  try { Send-Key $k; Write-Host "Comando $k enviado." -ForegroundColor Green }
  catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 403) { Write-LimitedHelp } else { throw }
  }
}

if ($Launch) {
  try {
    Invoke-Ecp Post "/launch/$Launch" | Out-Null
    Write-Host "Launch '$Launch' enviado." -ForegroundColor Green
  } catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 403) { Write-LimitedHelp } else { throw }
  }
}

if ($Text) {
  # ECP aceita teclas literais "Lit_<char>" no teclado na tela (best effort)
  try {
    foreach ($ch in $Text.ToCharArray()) {
      $name = if ($ch -eq ' ') { "Lit_%20" } else { "Lit_" + [uri]::EscapeDataString([string]$ch) }
      Invoke-Ecp Post "/keypress/$name" | Out-Null
      Start-Sleep -Milliseconds 60
    }
    Write-Host "Texto enviado." -ForegroundColor Green
  } catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 403) { Write-LimitedHelp } else { throw }
  }
}
