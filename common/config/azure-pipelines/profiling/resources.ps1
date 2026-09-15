# Temporary read-only sampler. Do not collect command lines, environment variables, or credentials.
param(
  [Parameter(Mandatory = $true)][string]$OutputFile,
  [Parameter(Mandatory = $true)][string]$StopFile
)
$ErrorActionPreference = 'Stop'
while (-not (Test-Path -LiteralPath $StopFile)) {
  $sample = @{ timestamp = [DateTime]::UtcNow.ToString('o') }
  try {
    $sample.cpu = @(Get-CimInstance Win32_PerfFormattedData_PerfOS_Processor -Filter "Name='_Total'" |
      Select-Object Name, PercentProcessorTime, PercentPrivilegedTime)
    $sample.memory = @(Get-CimInstance Win32_PerfFormattedData_PerfOS_Memory |
      Select-Object AvailableMBytes, PagesPersec, PageReadsPersec, PageWritesPersec)
    # Raw counters retain sub-second latency precision; derive rates/latencies from adjacent samples.
    $sample.diskRaw = @(Get-CimInstance Win32_PerfRawData_PerfDisk_PhysicalDisk |
      Select-Object Name, DiskReadBytesPersec, DiskWriteBytesPersec, DiskReadsPersec, DiskWritesPersec,
        AvgDisksecPerRead, AvgDisksecPerRead_Base, AvgDisksecPerWrite, AvgDisksecPerWrite_Base,
        CurrentDiskQueueLength, Frequency_PerfTime, Timestamp_PerfTime)
    $sample.processes = @(Get-CimInstance Win32_PerfFormattedData_PerfProc_Process |
      Where-Object { $_.Name -match '^(node|electron|chrome|MsMpEng)(#\d+)?$' } |
      Select-Object Name, IDProcess, PercentProcessorTime, WorkingSetPrivate,
        IOReadBytesPersec, IOWriteBytesPersec)
  } catch {
    $sample.error = $_.FullyQualifiedErrorId
  }
  $sample | ConvertTo-Json -Depth 5 -Compress | Add-Content -LiteralPath $OutputFile -Encoding UTF8
  if ($sample.error) { exit 1 }
  if (-not (Test-Path -LiteralPath "$OutputFile.ready")) {
    [System.IO.File]::WriteAllText("$OutputFile.ready", 'ready')
  }
  Start-Sleep -Seconds 3
}
