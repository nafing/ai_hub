import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  androidRoot,
  apkDistName,
  bumpPatch,
  clientRoot,
  distRoot,
  readPackage,
  syncAndroidVersion,
  writePackage,
} from "./version.mjs";

const isWin = process.platform === "win32";
const args = new Set(process.argv.slice(2).filter((arg) => arg !== "--"));
const shouldBump = args.has("--bump");
const shouldPublish = args.has("--publish") || shouldBump;
const noPublish = args.has("--no-publish");

function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function run(command, argsList, opts = {}) {
  console.log(`==> ${command} ${argsList.join(" ")}`);
  const result = spawnSync(command, argsList, {
    cwd: opts.cwd ?? clientRoot,
    env: { ...process.env, ...opts.env },
    stdio: "inherit",
    shell: opts.shell ?? isWin,
  });
  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
  return result;
}

function runCapture(command, argsList, opts = {}) {
  const result = spawnSync(command, argsList, {
    cwd: opts.cwd ?? clientRoot,
    env: { ...process.env, ...opts.env },
    encoding: "utf8",
    shell: opts.shell ?? isWin,
  });
  return result;
}

function findJavaHome() {
  if (process.env.JAVA_HOME && exists(process.env.JAVA_HOME)) {
    return process.env.JAVA_HOME;
  }

  const candidates = [
    "C:\\Program Files\\Android\\Android Studio\\jbr",
    "C:\\Program Files\\Android\\Android Studio\\jre",
    path.join(
      process.env.LOCALAPPDATA ?? "",
      "Programs",
      "Android",
      "Android Studio",
      "jbr",
    ),
    "/Applications/Android Studio.app/Contents/jbr/Contents/Home",
    "/usr/lib/jvm/default-java",
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const javaBin = path.join(
      candidate,
      "bin",
      isWin ? "java.exe" : "java",
    );
    if (exists(javaBin)) return candidate;
  }

  return null;
}

function findAndroidSdk() {
  if (process.env.ANDROID_HOME && exists(process.env.ANDROID_HOME)) {
    return process.env.ANDROID_HOME;
  }
  if (process.env.ANDROID_SDK_ROOT && exists(process.env.ANDROID_SDK_ROOT)) {
    return process.env.ANDROID_SDK_ROOT;
  }

  const candidates = [
    path.join(process.env.LOCALAPPDATA ?? "", "Android", "Sdk"),
    path.join(os.homedir(), "AppData", "Local", "Android", "Sdk"),
    path.join(os.homedir(), "Android", "Sdk"),
    path.join(os.homedir(), "Library", "Android", "sdk"),
  ];

  for (const candidate of candidates) {
    if (candidate && exists(candidate)) return candidate;
  }

  return null;
}

function ensureLocalProperties(sdkPath) {
  const file = path.join(androidRoot, "local.properties");
  const winContents = isWin
    ? `sdk.dir=${sdkPath.replace(/\\/g, "\\\\").replace(":", "\\:")}\n`
    : `sdk.dir=${sdkPath.replace(/\\/g, "/")}\n`;
  fs.writeFileSync(file, winContents, "utf8");
}

function commandExists(name) {
  const result = runCapture(isWin ? "where" : "which", [name]);
  return result.status === 0;
}

function publishGithubRelease(versionName, apkPath) {
  if (!commandExists("gh")) {
    console.log(
      "==> gh CLI not found — skipped GitHub Release. Install GitHub CLI or use Actions.",
    );
    return false;
  }

  const tag = `android-v${versionName}`;
  const title = `Android ${versionName}`;
  const notes = `AI Hub Android WebView build ${versionName}`;

  const view = runCapture("gh", ["release", "view", tag]);
  if (view.status === 0) {
    console.log(`==> Release ${tag} already exists — uploading asset`);
    run("gh", ["release", "upload", tag, apkPath, "--clobber"]);
  } else {
    console.log(`==> Creating GitHub Release ${tag}`);
    run("gh", [
      "release",
      "create",
      tag,
      apkPath,
      "--title",
      title,
      "--notes",
      notes,
    ]);
  }
  return true;
}

const javaHome = findJavaHome();
const androidSdk = findAndroidSdk();

if (!javaHome) {
  console.error("ERROR: JDK not found. Install Android Studio or set JAVA_HOME.");
  process.exit(1);
}

if (!androidSdk) {
  console.error(
    "ERROR: Android SDK not found. Install Android Studio or set ANDROID_HOME.",
  );
  process.exit(1);
}

if (!exists(androidRoot)) {
  console.error("ERROR: android/ project missing. Run: pnpm exec cap add android");
  process.exit(1);
}

const pkg = readPackage();
if (shouldBump) {
  pkg.version = bumpPatch(pkg.version);
  writePackage(pkg);
  console.log(`==> Bumped version → ${pkg.version}`);
}

const { versionName, versionCode } = syncAndroidVersion(pkg.version);
console.log(`==> Android versionName=${versionName} versionCode=${versionCode}`);

ensureLocalProperties(androidSdk);

const env = {
  JAVA_HOME: javaHome,
  ANDROID_HOME: androidSdk,
  ANDROID_SDK_ROOT: androidSdk,
};

run("pnpm", ["exec", "vite", "build"], { env });
run("pnpm", ["exec", "cap", "sync", "android"], { env });

const gradlew = path.join(androidRoot, isWin ? "gradlew.bat" : "gradlew");
run(gradlew, ["assembleDebug", "--no-daemon"], {
  cwd: androidRoot,
  env,
  shell: isWin,
});

const builtApk = path.join(
  androidRoot,
  "app",
  "build",
  "outputs",
  "apk",
  "debug",
  "app-debug.apk",
);

if (!exists(builtApk)) {
  console.error(`ERROR: APK not found at ${builtApk}`);
  process.exit(1);
}

fs.mkdirSync(distRoot, { recursive: true });
const distName = apkDistName(versionName);
const distApk = path.join(distRoot, distName);
fs.copyFileSync(builtApk, distApk);

// Also keep a stable latest pointer for convenience.
fs.copyFileSync(builtApk, path.join(distRoot, "ai-hub-latest.apk"));

console.log("");
console.log("==> Packaged into packages/android-app:");
console.log(`    ${distApk}`);

if (shouldPublish && !noPublish) {
  publishGithubRelease(versionName, distApk);
}
