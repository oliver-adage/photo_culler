param(
  [switch]$Force
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$hooksDir = Join-Path $repoRoot ".git\hooks"
$target = Join-Path $hooksDir "pre-push"

if (-not (Test-Path $hooksDir)) {
  throw "No .git/hooks directory found. Run this from a cloned git repository."
}

$hook = @'
#!/bin/sh
# Block direct pushes to protected branches from this local repo.
# Emergency bypass: ALLOW_MAIN_PUSH=1 git push ...

remote_name="$1"
remote_url="$2"

while read local_ref local_sha remote_ref remote_sha
do
  case "$remote_ref" in
    refs/heads/main|refs/heads/master)
      if [ "$ALLOW_MAIN_PUSH" = "1" ]; then
        echo "pre-push: bypass enabled (ALLOW_MAIN_PUSH=1), allowing push to ${remote_ref#refs/heads/}." >&2
        continue
      fi
      echo "" >&2
      echo "pre-push blocked: direct push to ${remote_ref#refs/heads/} is not allowed in this repo." >&2
      echo "Remote: $remote_name ($remote_url)" >&2
      echo "" >&2
      echo "Recommended workflow:" >&2
      echo "  git checkout -b feature/<name>" >&2
      echo "  git push -u origin feature/<name>" >&2
      echo "  merge via main after review/testing" >&2
      echo "" >&2
      echo "Emergency override (local only):" >&2
      echo "  ALLOW_MAIN_PUSH=1 git push" >&2
      exit 1
      ;;
  esac
done

exit 0
'@

if ((Test-Path $target) -and -not $Force) {
  Write-Host "Hook already exists at .git/hooks/pre-push (use -Force to overwrite)."
  exit 0
}

Set-Content -Path $target -Value $hook -NoNewline
Write-Host "Installed pre-push hook at .git/hooks/pre-push"
