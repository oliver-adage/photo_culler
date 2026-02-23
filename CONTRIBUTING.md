# Contributing

## Branching

- Do not push directly to `main`
- Create a feature/fix/docs branch for each change
- Example names:
  - `feature/portable-build-ci`
  - `feature/slice-2-resume-state`
  - `fix/mtp-import-retries`
  - `docs/release-instructions`

## Local setup

1. Clone repo
2. Install local hook (recommended)

```powershell
.\scripts\install-hooks.ps1
```

The hook blocks direct pushes to `main`/`master` unless you explicitly override.

## Development run

```powershell
python native_server.py
```

## Portable build (local)

```powershell
.\build_portable.ps1
```

Output:

- `dist\PhotoCuller\PhotoCuller.exe`

## CI builds

- Every push builds a Windows portable artifact in GitHub Actions
- Tag pushes like `v0.1.0` also publish a GitHub Release asset automatically

## Commit style

- `feat: ...`
- `fix: ...`
- `docs: ...`
- `refactor: ...`
