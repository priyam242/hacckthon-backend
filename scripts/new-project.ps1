param (
    [Parameter(Mandatory=$true)]
    [string]$StackFolder,
    [Parameter(Mandatory=$true)]
    [string]$NewProjectName,
    [Parameter(Mandatory=$true)]
    [string]$EntityName,
    [string]$EntityPlural = ""
)

if (-not $EntityPlural) {
    $EntityPlural = $EntityName + "s"
}

$sourcePath = Join-Path $PSScriptRoot "..\stacks\$StackFolder"
if (-not (Test-Path $sourcePath)) {
    Write-Error "Stack folder $sourcePath does not exist!"
    exit 1
}

$targetPath = Join-Path $PSScriptRoot "..\..\$NewProjectName"
Write-Host "Scaffolding new hackathon project: $NewProjectName"
Write-Host "Source Stack: $StackFolder"
Write-Host "Renaming entity: Item -> $EntityName / $EntityPlural"

if (Test-Path $targetPath) {
    Remove-Item -Path $targetPath -Recurse -Force
}
New-Item -ItemType Directory -Path $targetPath -Force | Out-Null

Copy-Item -Path "$sourcePath\*" -Destination $targetPath -Recurse -Force -Exclude "node_modules", "dist", ".git", "*.db", "uploads", "bin", "obj", "target"

$jwtSecret = [System.Guid]::NewGuid().ToString("N") + [System.Guid]::NewGuid().ToString("N")

$extensions = @(".js", ".ts", ".py", ".cs", ".go", ".rs", ".php", ".rb", ".json", ".md")
$files = Get-ChildItem -Path $targetPath -Recurse -File
foreach ($file in $files) {
    if ($extensions -contains $file.Extension -or $file.Name -eq ".env.example") {
        $content = Get-Content -Path $file.FullName -Raw
        $content = $content.Replace("Item", $EntityName)
        $content = $content.Replace("item", $EntityName.ToLower())
        $content = $content.Replace("items", $EntityPlural.ToLower())
        $content = $content.Replace("change-me-min-32-chars", $jwtSecret)
        Set-Content -Path $file.FullName -Value $content -NoNewline
    }
}

if (Test-Path "$targetPath\.env.example") {
    Copy-Item "$targetPath\.env.example" "$targetPath\.env" -Force
}

Write-Host "Project created successfully at: $targetPath"
