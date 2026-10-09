# Prototype video faceless : voix de synthese Windows (gratuite, locale) avec
# la position de chaque mot. Remplacee plus tard par ElevenLabs ou Gemini TTS.
# Usage : tts-windows.ps1 <lines.json> <dossier de sortie>
param([string]$LinesPath, [string]$OutDir, [int]$Rate = 1)

Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.SelectVoice('Microsoft Hortense Desktop')
$s.Rate = $Rate
$format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)

$items = Get-Content -Raw -Encoding UTF8 $LinesPath | ConvertFrom-Json
$result = @()
foreach ($it in $items) {
  $global:events = @()
  $handler = { param($o, $e) $global:events += [pscustomobject]@{ ms = $e.AudioPosition.TotalMilliseconds; pos = $e.CharacterPosition } }
  $s.add_SpeakProgress($handler)
  $wav = Join-Path $OutDir ($it.id + '.wav')
  # 16 kHz impose : AudioPosition est calcule a 16 kHz, alors que le WAV par
  # defaut est a 22,05 kHz (les temps des mots etaient 1,38 fois trop grands).
  $s.SetOutputToWaveFile($wav, $format)
  $s.Speak($it.text)
  $s.SetOutputToNull()
  $s.remove_SpeakProgress($handler)
  $result += [pscustomobject]@{ id = $it.id; wav = $wav; events = $global:events }
}
$result | ConvertTo-Json -Depth 5 | Out-File -Encoding utf8 (Join-Path $OutDir 'words.json')
