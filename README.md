# AI Hub

Lokalny hub do czatów z postaciami AI — monorepo (NestJS + Vite/React) z opcjonalną aplikacją Android (Capacitor WebView).

## Wymagania

- Node.js ≥ 18
- [pnpm](https://pnpm.io/) 9 (`packageManager` w root `package.json`)
- (Android) Android Studio / SDK + JDK 17+

## Szybki start

```bash
cp .env.example .env
pnpm install
pnpm dev
```

- Client: http://localhost:5173  
- API: http://localhost:5174/v1/api  

Albo skrypt startowy (pull + install + dev):

```bash
./start.sh      # macOS / Linux / Git Bash
start.bat       # Windows
```

## Struktura

```
apps/client          # frontend (Vite + React + Capacitor)
apps/server          # backend (NestJS + SQLite)
packages/shared      # wspólne typy / logika
packages/android-app # wersjonowanie i artefakty APK
```

## Komendy (root)

| Komenda | Opis |
|---------|------|
| `pnpm dev` | Client + server równolegle (watch) |
| `pnpm dev:server` | Tylko server w trybie watch |
| `pnpm build:server` | Build `shared` + `server` |
| `pnpm start` | Build servera + start produkcyjny |
| `pnpm start:server` | Start servera (wymaga wcześniejszego buildu) |
| `pnpm build` | Build shared/server + Android APK |
| `pnpm build:web` | Build paczek web (bez wymuszania APK) |
| `pnpm build:android` / `pnpm android` | Build APK bieżącej wersji → `packages/android-app/dist/` |
| `pnpm release:android` | Bump patch + build APK + GitHub Release (jeśli `gh`) |
| `pnpm android:dev` | Live reload Capacitor na urządzeniu/emulatorze |
| `pnpm android:open` | Otwórz projekt w Android Studio |
| `pnpm android:sync` | `vite build` + `cap sync` (bez Gradle) |
| `pnpm lint` | Lint we wszystkich paczkach |
| `pnpm format` | Prettier |
| `pnpm check-types` | Typecheck |

## Konfiguracja (`.env`)

```env
SERVER_HOST=0.0.0.0
SERVER_PORT=5174
SERVER_GLOBAL_PREFIX=/v1/api
SERVER_DATABASE_URL=database.sqlite

CLIENT_HOST=0.0.0.0
CLIENT_PORT=5173

# Opcjonalnie — sztywny URL API w buildzie Capacitor
# Emulator:  http://10.0.2.2:5174/v1/api
# Telefon:   http://<LAN-IP>:5174/v1/api
# VITE_API_URL=
```

`0.0.0.0` pozwala łączyć się z LAN (telefon / emulator przez host).

Na Androidzie możesz też ustawić URL w aplikacji: **Settings → Server**.

## Android (Capacitor)

Wersja APK żyje w [`packages/android-app/package.json`](packages/android-app/package.json).

### Lokalny build

```bash
pnpm android
```

Artefakty:

```
packages/android-app/dist/ai-hub-<version>.apk
packages/android-app/dist/ai-hub-latest.apk
```

Release z bumpem wersji:

```bash
pnpm release:android
```

Wymaga [GitHub CLI](https://cli.github.com/) (`gh auth login`), żeby utworzyć Release `android-v<version>`.

### Live reload

1. `pnpm dev` (serwer + Vite na LAN)
2. `pnpm android:dev`
3. Na telefonie w Settings ustaw API na `http://<IP-PC>:5174/v1/api`

### CI / GitHub Actions

Workflow: [`.github/workflows/release-android.yml`](.github/workflows/release-android.yml)

Uruchamia się:

- przy pushu na `main` (zmiany w client / android-app / shared / workflow)
- ręcznie: **Actions → Release Android APK → Run workflow**
- przy tagu `android-v*`

Efekt: bump wersji (na `main`), APK jako artifact + GitHub Release.

Więcej: [`packages/android-app/README.md`](packages/android-app/README.md).

## Licencja

Prywatne repo — użycie według właściciela projektu.
