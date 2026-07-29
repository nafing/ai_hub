# AI Hub — Android APK

Wersja źródłowa dla buildów Capacitor (`versionName` / `versionCode`).

## Skrypty (z roota)

```bash
pnpm android              # build APK bieżącej wersji → packages/android-app/dist/
pnpm release:android      # bump patch + build + GitHub Release (jeśli gh)
```

## Artefakty

```
packages/android-app/dist/ai-hub-<version>.apk
```

Publikacja: GitHub Release `android-v<version>` z załączonym APK.
