# MyLuckySol Android App

A native Android WebView wrapper for [myluckysol.fun](https://myluckysol.fun), built for the Solana dApp Store and Seeker devices.

## What it does

Loads the full MyLuckySol web app in a native Android WebView with:
- Hardware-accelerated rendering
- Full JavaScript + localStorage support
- Deep link handling (`myluckysol://` and `https://myluckysol.fun`)
- Wallet deep link pass-through (Phantom, Solflare, OKX)
- Back navigation support

## Building

### Option 1: GitHub Actions (recommended)

Push to `main` or `master` branch and the APK is automatically built and uploaded as a workflow artifact. Go to:
`GitHub → Actions → Build MyLuckySol APK → latest run → Artifacts`

### Option 2: Local with Android Studio

1. Open the `android/` folder in Android Studio (File → Open)
2. Wait for Gradle sync to complete
3. Build → Build Bundle(s) / APK(s) → Build APK(s)
4. The APK is at `app/build/outputs/apk/debug/app-debug.apk`

### Option 3: Local command line

Requires Android Studio or Android SDK installed with `ANDROID_HOME` set.

```bash
cd android
gradle assembleDebug
```

## Signed Release APK (for dApp Store submission)

For a signed release APK, add these secrets to your GitHub repository (Settings → Secrets):

| Secret | Description |
|---|---|
| `KEYSTORE_BASE64` | Base64-encoded `.jks` keystore file |
| `KEYSTORE_PASSWORD` | Password for the keystore |
| `KEY_ALIAS` | Key alias inside the keystore |
| `KEY_PASSWORD` | Password for the key |

To generate a keystore:
```bash
keytool -genkey -v -keystore myluckysol-release.jks \
  -alias myluckysol -keyalg RSA -keysize 2048 -validity 10000
# Then encode it:
base64 -i myluckysol-release.jks | pbcopy
```

## Solana dApp Store Submission

1. Build a signed release APK (see above)
2. Install the [Solana dApp Store CLI](https://github.com/solana-mobile/dapp-publishing)
3. Create a `dapp-store/` config following their spec
4. Run `npx dapp-store publish` with your publisher keypair

**App ID**: `fun.myluckysol.app`
**Min SDK**: 26 (Android 8.0 — covers all Seeker devices)
**Target SDK**: 34 (Android 14)
