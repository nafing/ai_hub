import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(__dirname, "..");
const androidRoot = path.join(clientRoot, "android");
const isWin = process.platform === "win32";

function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function run(command, args, opts = {}) {
  console.log(`==> ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
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
  const normalized = sdkPath.replace(/\\/g, "/");
  const contents = `sdk.dir=${normalized.replace(/:/g, "\\:")}\n`;
  // On Windows Gradle wants sdk.dir=C\:\\Users\\...
  const winContents = isWin
    ? `sdk.dir=${sdkPath.replace(/\\/g, "\\\\").replace(":", "\\:")}\n`
    : `sdk.dir=${normalized}\n`;
  fs.writeFileSync(file, isWin ? winContents : contents, "utf8");
}

const javaHome = findJavaHome();
const androidSdk = findAndroidSdk();

if (!javaHome) {
  console.error(
    "ERROR: JDK not found. Install Android Studio or set JAVA_HOME.",
  );
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

const apk = path.join(
  androidRoot,
  "app",
  "build",
  "outputs",
  "apk",
  "debug",
  "app-debug.apk",
);

console.log("");
console.log("==> Android debug APK ready:");
console.log(`    ${apk}`);
