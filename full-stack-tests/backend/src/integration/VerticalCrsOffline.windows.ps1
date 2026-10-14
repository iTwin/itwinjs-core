param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('Check', 'Create', 'Verify', 'Remove', 'Stop')]
    [string]$Action,
    [string]$RuleName,
    [string]$Executable
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

try {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = [Security.Principal.WindowsPrincipal]::new($identity)
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw 'Use an already elevated, policy-approved session; this harness does not request elevation.'
    }

    if ($Action -eq 'Check' -or $Action -eq 'Create' -or $Action -eq 'Verify') {
        if ((Get-Service MpsSvc).Status -ne 'Running') {
            throw 'Windows Defender Firewall service must already be running.'
        }
        $profiles = @(Get-NetFirewallProfile -PolicyStore ActiveStore)
        if ($profiles.Count -ne 3) { throw 'Expected all three effective firewall profiles.' }
        foreach ($profile in $profiles) {
            if ([string]$profile.Enabled -ne 'True' -or [string]$profile.AllowLocalFirewallRules -eq 'False') {
                throw "Effective profile $($profile.Name) does not enforce local firewall rules."
            }
        }
        if ($Action -eq 'Check') {
            $os = Get-CimInstance Win32_OperatingSystem
            @{
                os = $os.Caption
                version = $os.Version
                build = $os.BuildNumber
                profiles = @($profiles | Select-Object Name, @{Name='Enabled';Expression={[string]$_.Enabled}}, @{Name='AllowLocalFirewallRules';Expression={[string]$_.AllowLocalFirewallRules}})
            } | ConvertTo-Json -Depth 4 -Compress
            exit 0
        }
    }

    if ($RuleName -notmatch '^itwin-vertical-crs-offline-[0-9a-f-]{36}$' -or
        -not [IO.Path]::IsPathRooted($Executable) -or
        [IO.Path]::GetFileName($Executable) -ne 'node.exe' -or
        [IO.Path]::GetFileName([IO.Path]::GetDirectoryName($Executable)) -ne $RuleName) {
        throw 'Refusing to operate on a rule or executable not owned by this run.'
    }

    if ($Action -eq 'Stop') {
        $workers = @(Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object { $_.ExecutablePath -eq $Executable })
        foreach ($worker in $workers) {
            & "$env:SystemRoot\System32\taskkill.exe" /PID $worker.ProcessId /T /F | Out-Null
            if ($LASTEXITCODE -ne 0) { throw "Could not terminate owned worker $($worker.ProcessId)." }
            Wait-Process -Id $worker.ProcessId -Timeout 10 -ErrorAction SilentlyContinue
        }
        $remaining = @(Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object { $_.ExecutablePath -eq $Executable })
        if ($remaining.Count -ne 0) { throw 'Owned workers are still running; retain the firewall rule.' }
        @{ stopped = $workers.Count; remaining = $remaining.Count } | ConvertTo-Json -Compress
        exit 0
    }

    if ($Action -eq 'Create') {
        if (@(Get-NetFirewallRule -PolicyStore PersistentStore | Where-Object Name -eq $RuleName).Count -ne 0) {
            throw 'Owned rule name already exists.'
        }
        New-NetFirewallRule -PolicyStore PersistentStore -Name $RuleName -DisplayName $RuleName `
            -Enabled True -Direction Outbound -Action Block -Profile Any -Program $Executable `
            -Protocol Any -LocalAddress Any -RemoteAddress Any | Out-Null
    }

    if ($Action -eq 'Remove') {
        $owned = @(Get-NetFirewallRule -PolicyStore PersistentStore | Where-Object Name -eq $RuleName)
        foreach ($rule in $owned) {
            $application = @($rule | Get-NetFirewallApplicationFilter)
            if ($application.Count -ne 1 -or $application[0].Program -ne $Executable) {
                throw 'Refusing to remove a rule bound to a different executable.'
            }
            $rule | Remove-NetFirewallRule
        }
        $remaining = @(Get-NetFirewallRule -PolicyStore ActiveStore | Where-Object Name -eq $RuleName)
        if ($remaining.Count -ne 0) { throw 'Owned firewall rule remains in effective policy.' }
        @{ removed = $true; rule = $RuleName } | ConvertTo-Json -Compress
        exit 0
    }

    $rules = @(Get-NetFirewallRule -PolicyStore ActiveStore | Where-Object Name -eq $RuleName)
    if ($rules.Count -ne 1) { throw 'Expected exactly one effective owned rule.' }
    $rule = $rules[0]
    $application = @($rule | Get-NetFirewallApplicationFilter)
    $address = @($rule | Get-NetFirewallAddressFilter)
    $port = @($rule | Get-NetFirewallPortFilter)
    if ([string]$rule.Enabled -ne 'True' -or [string]$rule.Direction -ne 'Outbound' -or
        [string]$rule.Action -ne 'Block' -or [string]$rule.Profile -ne 'Any' -or
        $application.Count -ne 1 -or $application[0].Program -ne $Executable -or
        $address.Count -ne 1 -or [string]$address[0].LocalAddress -ne 'Any' -or [string]$address[0].RemoteAddress -ne 'Any' -or
        $port.Count -ne 1 -or [string]$port[0].Protocol -ne 'Any' -or
        [string]$port[0].LocalPort -ne 'Any' -or [string]$port[0].RemotePort -ne 'Any') {
        throw 'Effective rule does not block unrestricted IPv4/IPv6 outbound traffic for the owned executable.'
    }
    @{
        rule = $RuleName; program = $application[0].Program
        enabled = [string]$rule.Enabled; direction = [string]$rule.Direction
        action = [string]$rule.Action; profile = [string]$rule.Profile
        protocol = [string]$port[0].Protocol; remoteAddress = $address[0].RemoteAddress
    } | ConvertTo-Json -Compress
} catch {
    [Console]::Error.WriteLine($_.Exception.Message)
    exit 1
}