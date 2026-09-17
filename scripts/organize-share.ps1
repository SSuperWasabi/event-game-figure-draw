$ErrorActionPreference = 'Stop'

$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$rootPrefix = $projectRoot.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar

function Get-SafePath([string]$RelativePath) {
  $full = [IO.Path]::GetFullPath((Join-Path $projectRoot $RelativePath))
  $isProjectRoot = $full.Equals($projectRoot, [StringComparison]::OrdinalIgnoreCase)
  if (-not $isProjectRoot -and -not $full.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Path escapes the workspace: $RelativePath"
  }
  return $full
}

function Ensure-SafeDirectory([string]$RelativePath) {
  $full = Get-SafePath $RelativePath
  if (-not (Test-Path -LiteralPath $full)) {
    New-Item -ItemType Directory -Path $full | Out-Null
  }
  return $full
}

function Move-Safe([string]$SourceRelative, [string]$TargetDirectoryRelative, [string]$TargetName = '') {
  $source = Get-SafePath $SourceRelative
  if (-not (Test-Path -LiteralPath $source)) { return }
  $targetDirectory = Ensure-SafeDirectory $TargetDirectoryRelative
  if (-not $TargetName) { $TargetName = Split-Path -Leaf $source }
  $target = [IO.Path]::GetFullPath((Join-Path $targetDirectory $TargetName))
  if (-not $target.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) { throw "Unsafe target: $target" }
  if (Test-Path -LiteralPath $target) { throw "Target already exists: $target" }
  Move-Item -LiteralPath $source -Destination $target
}

function Move-TopLevelFilesByExtension([string]$SourceRelative, [string]$TargetRelative, [string[]]$Extensions) {
  $sourceDirectory = Get-SafePath $SourceRelative
  if (-not (Test-Path -LiteralPath $sourceDirectory)) { return }
  foreach ($file in Get-ChildItem -LiteralPath $sourceDirectory -File) {
    if ($Extensions -contains $file.Extension.ToLowerInvariant()) {
      $relative = $file.FullName.Substring($rootPrefix.Length)
      Move-Safe $relative $TargetRelative
    }
  }
}

function Copy-FinalAsset([IO.FileInfo]$File, [string]$TargetRelative) {
  $targetDirectory = Ensure-SafeDirectory $TargetRelative
  $target = Join-Path $targetDirectory $File.Name
  Copy-Item -LiteralPath $File.FullName -Destination $target -Force
}

function Remove-EmptySafeDirectory([string]$RelativePath) {
  $full = Get-SafePath $RelativePath
  if (-not (Test-Path -LiteralPath $full -PathType Container)) { return }
  if (@(Get-ChildItem -LiteralPath $full -Force).Count -eq 0) {
    Remove-Item -LiteralPath $full
  }
}

$directories = @(
  'resource/images/final-assets/app-assets',
  'resource/images/-old/root-source-art',
  'resource/images/-old/app-unused',
  'resource/images/-old/tool-previews',
  'resource/images/-old/tool-preview-frames',
  'resource/videos/final-assets',
  'resource/videos/-old/root-candidates',
  'resource/videos/-old/app-unused',
  'resource/videos/-old/frame-sequences',
  'resource/videos/-old/tool-fixtures',
  'resource/audio/final-assets',
  'resource/audio/-old',
  'resource/audio/-old/loose',
  'resource/fonts/final-assets',
  'resource/project-reference/-old'
)
$directories | ForEach-Object { Ensure-SafeDirectory $_ | Out-Null }

# Event-ready looping and prize videos are final operating assets, even though
# administrators upload them at runtime instead of the app referencing them directly.
Move-TopLevelFilesByExtension 'resource/videos/-old/generated-candidates' 'resource/videos/final-assets' @('.mp4', '.mov')
Remove-EmptySafeDirectory 'resource/videos/-old/generated-candidates'
Move-TopLevelFilesByExtension 'resource' 'resource/videos/final-assets' @('.mp4', '.mov')
Move-TopLevelFilesByExtension 'resource' 'resource/audio/-old/loose' @('.mp3', '.wav', '.ogg')
Move-Safe 'resource/smon_bgm' 'resource/audio/-old' 'smon_bgm'

# Loose source art and video candidates from the workspace root.
Move-TopLevelFilesByExtension '.' 'resource/images/-old/root-source-art' @('.png', '.jpg', '.jpeg', '.webp', '.svg')
Move-TopLevelFilesByExtension '.' 'resource/videos/-old/root-candidates' @('.mp4', '.mov')
Move-TopLevelFilesByExtension '.' 'resource/audio/-old/loose' @('.mp3', '.wav', '.ogg')
Move-Safe 'Zeratu Character Sheet' 'resource/images/-old/root-source-art'
Move-Safe 'main looping_4' 'resource/videos/-old/frame-sequences'
Move-Safe 'zeratu summon_34' 'resource/videos/-old/frame-sequences'
Move-Safe 'sound' 'resource/audio/-old' 'sacred-scroll-library'
Move-Safe 'reference-kuji' 'resource/project-reference/-old'

# Unused candidates that had been placed beside production assets.
Move-Safe 'app/assets/figure/scroll-looping-2.mp4' 'resource/videos/-old/app-unused'
Move-Safe 'app/assets/figure/scroll3-idle.mp4' 'resource/videos/-old/app-unused'
Move-Safe 'app/assets/figure/scroll3-open.mp4' 'resource/videos/-old/app-unused'
Move-Safe 'app/assets/figure/scroll3-poster.jpg' 'resource/images/-old/app-unused'

# Generated previews and diagnostics: keep tools/scripts, archive their binary output.
Move-TopLevelFilesByExtension '.tools' 'resource/images/-old/tool-previews' @('.png', '.jpg', '.jpeg', '.gif', '.webp')
Move-TopLevelFilesByExtension '.tools' 'resource/videos/-old/tool-fixtures' @('.mp4', '.mov')
foreach ($directory in @('reference-frames', 'scroll-review', 'scroll3', 'slider-sequence-frames')) {
  Move-Safe (Join-Path '.tools' $directory) 'resource/images/-old/tool-preview-frames'
}

# Copy current runtime assets into a type-oriented handoff library without changing app URLs.
$assetsRoot = Get-SafePath 'app/assets'
$assetsPrefix = $assetsRoot.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
foreach ($file in Get-ChildItem -LiteralPath $assetsRoot -Recurse -File) {
  $extension = $file.Extension.ToLowerInvariant()
  if ($file.Name -eq 'drag-arrow.svg') { continue }
  if (@('.png', '.jpg', '.jpeg', '.webp', '.svg') -contains $extension) {
    if ($file.DirectoryName.Equals($assetsRoot, [StringComparison]::OrdinalIgnoreCase)) {
      $relativeParent = '.'
    } else {
      $relativeParent = $file.DirectoryName.Substring($assetsPrefix.Length)
    }
    Copy-FinalAsset $file (Join-Path 'resource/images/final-assets/app-assets' $relativeParent)
  } elseif (@('.mp4', '.mov', '.webm') -contains $extension) {
    Copy-FinalAsset $file 'resource/videos/final-assets'
  } elseif (@('.wav', '.mp3', '.ogg', '.m4a') -contains $extension) {
    Copy-FinalAsset $file 'resource/audio/final-assets'
  } elseif (@('.otf', '.ttf', '.woff', '.woff2') -contains $extension) {
    Copy-FinalAsset $file 'resource/fonts/final-assets'
  }
}

$summaryPaths = @(
  'resource/images/final-assets',
  'resource/images/-old',
  'resource/videos/final-assets',
  'resource/videos/-old',
  'resource/audio/final-assets',
  'resource/audio/-old',
  'resource/fonts/final-assets'
)

Write-Host 'Workspace media organization complete.'
foreach ($relativePath in $summaryPaths) {
  $fullPath = Get-SafePath $relativePath
  $files = @(Get-ChildItem -LiteralPath $fullPath -File -Recurse)
  $bytes = ($files | Measure-Object -Property Length -Sum).Sum
  if ($null -eq $bytes) { $bytes = 0 }
  Write-Host ('{0}: {1} files, {2:N1} MB' -f $relativePath, $files.Count, ($bytes / 1MB))
}
