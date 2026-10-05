import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
const key = process.env.ANDROID_KEYSTORE_BASE64,
  pass = process.env.ANDROID_KEYSTORE_PASSWORD;
if (!key || !pass)
  throw new Error(
    "Configure persistent ANDROID_KEYSTORE_BASE64 and ANDROID_KEYSTORE_PASSWORD GitHub secrets before releasing Android.",
  );
const file = path.join(process.env.RUNNER_TEMP, "taskorbit-android.jks");
writeFileSync(file, Buffer.from(key, "base64"), { mode: 0o600 });
const gradle = "src-tauri/gen/android/app/build.gradle.kts";
let content = readFileSync(gradle, "utf8");
content = content.replace(
  "android {",
  `android {\n    signingConfigs {\n        create("taskorbit") {\n            storeFile = file(System.getenv("TASKORBIT_KEYSTORE"))\n            storePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")\n            keyAlias = "taskorbit"\n            keyPassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")\n        }\n    }`,
);
content = content.replace(
  'getByName("release") {',
  'getByName("release") {\n            signingConfig = signingConfigs.getByName("taskorbit")',
);
if (!content.includes('signingConfig = signingConfigs.getByName("taskorbit")'))
  throw new Error(
    "Tauri Android Gradle template changed; signing was not configured.",
  );
writeFileSync(gradle, content);
writeFileSync(
  process.env.GITHUB_ENV,
  `TASKORBIT_KEYSTORE=${file}\nANDROID_KEYSTORE_PASSWORD=${pass}\n`,
  { flag: "a", mode: 0o600 },
);
