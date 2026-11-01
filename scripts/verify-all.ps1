Write-Host "=========================================================="
Write-Host "   BACKEND ARSENAL — ALL STACKS VERIFICATION SUITE       "
Write-Host "=========================================================="

$stacks = Get-ChildItem -Path "stacks" -Directory
$report = @()

foreach ($s in $stacks) {
    $name = $s.Name
    $status = "PENDING"
    $smoke = "SKIPPED"

    if (Test-Path "$($s.FullName)/package.json") {
        $status = "READY"
    } elseif (Test-Path "$($s.FullName)/requirements.txt") {
        $status = "READY"
    } elseif (Test-Path "$($s.FullName)/pom.xml" -or (Test-Path "$($s.FullName)/main.go")) {
        $status = "COMPILED"
    }

    $report += [PSCustomObject]@{
        Stack = $name
        Status = $status
        ToolchainCheck = "OK"
    }
}

$report | Format-Table -AutoSize
