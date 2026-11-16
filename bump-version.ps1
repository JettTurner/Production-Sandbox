<#
.SYNOPSIS
    Bump Folder Hierarchy Studio's version (web\package.json, web\package-lock.json and the README to match).

.DESCRIPTION
    Shows the current version and writes the new one, keeping each file's line endings. Give the version,
    or a part to bump (major, minor, patch), or nothing to be asked (Enter takes the next patch).
    web\package.json is the one place the version is kept: build.bat reads it from there for the installer's
    name and details. The README's "Version:" line is brought in line with it.

    It also starts the new version's notes in CHANGELOG.md, one line per commit since the last version, and
    opens the file so you can turn them into what users should read.

.EXAMPLE
    .\bump-version.ps1
    Asks for the new version (Enter: the next patch, 0.2.0 -> 0.2.1).

.EXAMPLE
    .\bump-version.ps1 minor
    0.2.4 -> 0.3.0.

.EXAMPLE
    .\bump-version.ps1 1.0.0 -Commit
    Sets 1.0.0, waits while you edit the notes in CHANGELOG.md, then commits the files as "Version 1.0.0".

.EXAMPLE
    .\bump-version.ps1 patch -NoEdit
    Bumps and writes the notes, without opening CHANGELOG.md.
#>
param(
    # X.Y.Z, or major / minor / patch.
    [string]$Version,
    # Commit the files afterwards ("Version X.Y.Z").
    [switch]$Commit,
    # Don't open CHANGELOG.md (or wait for it) after writing the new version's notes.
    [switch]$NoEdit
)

$root = Split-Path -Parent $PSCommandPath
$package = Join-Path $root "web\package.json"
$lock = Join-Path $root "web\package-lock.json"
$readme = Join-Path $root "README.md"
# The package's own version line. Dependencies' versions sit deeper in, or on lines that end differently.
$pattern = '^  "version": "(\d+)\.(\d+)\.(\d+)",$'

$text = [System.IO.File]::ReadAllText($package)
$line = ($text -split "`r?`n") | Where-Object { $_ -match $pattern } | Select-Object -First 1
if (-not $line) {
    Write-Error "No version line in $package"
    exit 1
}
$null = $line -match $pattern
$major, $minor, $patch = [int]$Matches[1], [int]$Matches[2], [int]$Matches[3]
$current = "$major.$minor.$patch"
Write-Host "Current version: $current"

function Next([string]$part) {
    switch ($part) {
        "major" { return "$($major + 1).0.0" }
        "minor" { return "$major.$($minor + 1).0" }
        default { return "$major.$minor.$($patch + 1)" }
    }
}

if (-not $Version) {
    $suggest = Next "patch"
    $Version = Read-Host "New version (Enter for $suggest, or major / minor / patch)"
    if (-not $Version) { $Version = $suggest }
}
if ($Version -in @("patch", "minor", "major")) { $Version = Next $Version }
if ($Version -notmatch '^\d+\.\d+\.\d+$') {
    Write-Error "Version must be X.Y.Z (e.g. 0.3.0), or major, minor or patch"
    exit 1
}
if ($Version -eq $current) {
    Write-Host "Already $Version. Nothing to do."
    exit 0
}

# Rewrites a file's first $limit version lines that hold the current version, among its first $within lines.
# No BOM, the file's own line endings: only those lines change.
function Set-VersionLines([string]$path, [int]$limit, [int]$within) {
    $text = [System.IO.File]::ReadAllText($path)
    $nl = if ($text -match "`r`n") { "`r`n" } else { "`n" }
    $lines = $text -split "`r?`n"
    $find = '^(\s*)"version": "' + [regex]::Escape($current) + '",$'
    $done = 0
    for ($i = 0; $i -lt [Math]::Min($within, $lines.Count) -and $done -lt $limit; $i++) {
        if ($lines[$i] -match $find) {
            $lines[$i] = $Matches[1] + '"version": "' + $Version + '",'
            $done++
        }
    }
    [System.IO.File]::WriteAllText($path, ($lines -join $nl), (New-Object System.Text.UTF8Encoding $false))
    return $done
}

$changed = Set-VersionLines $package 1 20
if ($changed -ne 1) {
    Write-Error "Couldn't change the version in $package"
    exit 1
}
Write-Host "New version:     $Version"
Write-Host "  web\package.json -> $Version"
# Paths as git wants them, relative to the repo root.
$files = @("web/package.json")
if (Test-Path -LiteralPath $lock) {
    # npm writes the package's version twice near the top: once for the file, once for the package itself.
    $changed = Set-VersionLines $lock 2 12
    if ($changed -gt 0) { $files += "web/package-lock.json" }
    if ($changed -eq 2) {
        Write-Host "  web\package-lock.json -> $Version"
    } else {
        Write-Warning "web\package-lock.json didn't have the version where expected ($changed of 2 lines changed). Run 'npm install' in web\ to bring it in line."
    }
}

# README.md: the "**Version:** X.Y.Z" line near the top. Only that line changes; line endings and no BOM as above.
if (Test-Path -LiteralPath $readme) {
    $text = [System.IO.File]::ReadAllText($readme)
    $nl = if ($text -match "`r`n") { "`r`n" } else { "`n" }
    $lines = $text -split "`r?`n"
    $find = '^(\*\*Version:\*\*\s*)\d+\.\d+\.\d+'
    $done = 0
    for ($i = 0; $i -lt [Math]::Min(12, $lines.Count) -and $done -lt 1; $i++) {
        if ($lines[$i] -match $find) {
            $lines[$i] = [regex]::Replace($lines[$i], $find, ('${1}' + $Version))
            $done++
        }
    }
    if ($done -eq 1) {
        [System.IO.File]::WriteAllText($readme, ($lines -join $nl), (New-Object System.Text.UTF8Encoding $false))
        $files += "README.md"
        Write-Host "  README.md -> $Version"
    } else {
        Write-Warning "README.md has no '**Version:** X.Y.Z' line near the top; it was left as it is."
    }
}

# CHANGELOG.md: a section for the new version, started from the commit messages since the last version.
$changelog = Join-Path $root "CHANGELOG.md"
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false
# The last version is the last commit that changed package.json's version line (the change above isn't committed yet).
# The pattern has no quotation marks in it (a dot stands for each): Windows PowerShell drops them on the way to
# git, the pattern then matches nothing, and the notes start from the last 30 commits instead.
$last = git -C $root log -1 --format=%H '-G^  .version.: .[0-9]+\.[0-9]+\.[0-9]+.,$' -- web/package.json 2>$null
if (-not $last) { Write-Warning "Couldn't find the last version's commit: the notes start from the last 30 commits, some of them already in older versions." }
$range = if ($last) { "$last..HEAD" } else { "-30" }
$subjects = @(git -C $root log --no-merges --format=%s $range 2>$null | Where-Object {
    $_ -and $_ -notmatch '^(Version )?v?\d+\.\d+\.\d+$' -and $_ -notmatch '^Merge '
})
$text = if (Test-Path -LiteralPath $changelog) { [System.IO.File]::ReadAllText($changelog) } else { "# What's new in Folder Hierarchy Studio`n" }
$nl = if ($text -match "`r`n") { "`r`n" } else { "`n" }
if ($text -match ('(?m)^## v?' + [regex]::Escape($Version) + '\b')) {
    Write-Host "  CHANGELOG.md already has $Version"
} else {
    $date = (Get-Date).ToString("yyyy-MM-dd")
    $items = if ($subjects.Count) { $subjects | ForEach-Object { "- $_" } } else { @("- (Say what changed in $Version.)") }
    $section = (@("## $Version ($date)", "") + $items + @("", "")) -join $nl
    $at = [regex]::Match($text, '(?m)^## ')
    $text = if ($at.Success) { $text.Insert($at.Index, $section) } else { $text.TrimEnd() + $nl + $nl + $section }
    [System.IO.File]::WriteAllText($changelog, $text, (New-Object System.Text.UTF8Encoding $false))
    Write-Host "  CHANGELOG.md -> $Version, $($subjects.Count) line(s) from the commits since the last version"
}
$files += "CHANGELOG.md"
if (-not $NoEdit) {
    Write-Host "`nEdit the notes for $Version in CHANGELOG.md: they are what users read."
    Invoke-Item -LiteralPath $changelog
    if ($Commit) { $null = Read-Host "Save CHANGELOG.md, then press Enter to commit" }
}

if ($Commit) {
    git -C $root add -- $files
    git -C $root commit -m "Version $Version" -- $files
    if ($LASTEXITCODE -ne 0) { Write-Error "git commit failed"; exit 1 }
    Write-Host "Committed: Version $Version"
}
Write-Host "`nNext: build.bat makes web\installer\Output\FolderHierarchyStudio-Setup-$Version.exe; 'npm run build' in web\ makes the site"
