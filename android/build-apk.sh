#!/usr/bin/env bash
# Builds frontline-1945.apk without Gradle.
# Needs: JDK 17+, Android SDK with "build-tools;34.0.0" and "platforms;android-34".
#   ANDROID_HOME=/path/to/sdk ./android/build-apk.sh
# Optional signing key: KEYSTORE=... KEYSTORE_PASS=... KEY_ALIAS=...
# (otherwise a key is created at android/frontline.keystore and reused for updates).
set -euo pipefail
cd "$(dirname "$0")"
: "${ANDROID_HOME:?Set ANDROID_HOME to your Android SDK}"
BT="$ANDROID_HOME/build-tools/34.0.0"
JAR="$ANDROID_HOME/platforms/android-34/android.jar"
VERSION_CODE="${VERSION_CODE:-1}"
VERSION_NAME="${VERSION_NAME:-1.0}"
OUT=build
rm -rf "$OUT" && mkdir -p "$OUT/assets" "$OUT/classes" "$OUT/dex" "$OUT/gen"

# 1. game: the single-file HTML build
(cd .. && node scripts/build-standalone.js)
cp ../frontline-1945.html "$OUT/assets/index.html"

# 2. resources + manifest
"$BT/aapt2" compile --dir res -o "$OUT/res.zip"
"$BT/aapt2" link -o "$OUT/unsigned.apk" -I "$JAR" --manifest AndroidManifest.xml -A "$OUT/assets" \
  --java "$OUT/gen" --min-sdk-version 24 --target-sdk-version 34 \
  --version-code "$VERSION_CODE" --version-name "$VERSION_NAME" "$OUT/res.zip"

# 3. code
javac -nowarn -Xlint:-options -source 8 -target 8 -bootclasspath "$JAR" -d "$OUT/classes" \
  $(find src "$OUT/gen" -name '*.java')
"$BT/d8" --release --lib "$JAR" --min-api 24 --output "$OUT/dex" $(find "$OUT/classes" -name '*.class')
(cd "$OUT/dex" && zip -q ../unsigned.apk classes.dex)

# 4. align + sign
"$BT/zipalign" -p -f 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"
KEYSTORE="${KEYSTORE:-frontline.keystore}"
KEYSTORE_PASS="${KEYSTORE_PASS:-frontline1945}"
KEY_ALIAS="${KEY_ALIAS:-frontline}"
if [ ! -f "$KEYSTORE" ]; then
  keytool -genkeypair -keystore "$KEYSTORE" -storepass "$KEYSTORE_PASS" -keypass "$KEYSTORE_PASS" -alias "$KEY_ALIAS" \
    -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Frontline 1945, O=Frontline 1945" 2>/dev/null
fi
"$BT/apksigner" sign --ks "$KEYSTORE" --ks-pass "pass:$KEYSTORE_PASS" --ks-key-alias "$KEY_ALIAS" \
  --out ../frontline-1945.apk "$OUT/aligned.apk"
"$BT/apksigner" verify ../frontline-1945.apk
echo "Built $(cd .. && pwd)/frontline-1945.apk ($(du -k ../frontline-1945.apk | cut -f1) KB)"
