# `@ai-hub/android-app`

Pakiet wersji i artefaktów APK (Capacitor WebView).

## Wersjonowanie

Źródło prawdy: `package.json` → pole `version` (semver).

Przy buildzie synchronizowane do:

- `apps/client/android/app/version.properties` (`versionName` / `versionCode`)
- `versionCode = major*10000 + minor*100 + patch`

## Komendy

Z **roota** monorepo:

```bash
pnpm android              # build bieżącej wersji
pnpm release:android      # bump patch + build + GitHub Release (gh)
pnpm android:dev          # live reload
pnpm android:open         # Android Studio
pnpm android:sync         # vite build + cap sync
```

Bezpośrednio w paczce:

```bash
pnpm --filter @ai-hub/android-app build     # bez bumpa
pnpm --filter @ai-hub/android-app release   # z bumpem (+ publish jeśli gh)
```

Flagi skryptu `scripts/release.mjs`:

| Flaga | Znaczenie |
|-------|-----------|
| `--bump` | Podbij patch w `package.json` |
| `--publish` | Wymuś GitHub Release |
| `--no-publish` | Pomiń GitHub Release |

## Artefakty

```
packages/android-app/dist/ai-hub-<version>.apk
packages/android-app/dist/ai-hub-latest.apk
```

APK-i są w `.gitignore`. Lokalna dystrybucja z `dist/`; CI publikuje GitHub Release.

## CI

Automatyczny workflow: [`.github/workflows/release-android.yml`](../../.github/workflows/release-android.yml)  
Szczegóły: [README główny](../../README.md#ci--github-actions).
