# MyLuckySol Android App

A native Android WebView wrapper for [myluckysol.fun](https://myluckysol.fun), built for the Solana dApp Store and Seeker devices.

**Package ID**: `fun.myluckysol.app`  
**Min SDK**: 26 (Android 8.0 — covers all Seeker devices)  
**Target SDK**: 34 (Android 14)

---

## What the App Does

Loads the full MyLuckySol web app in a native Android shell with:
- Dark splash screen (no white flash on startup)
- Offline detection with a retry button
- Hardware-accelerated WebView rendering
- Full JavaScript + localStorage support
- Wallet deep link pass-through (Phantom, Solflare, OKX, Backpack)
- Back navigation support
- Deep links: `myluckysol://` and `https://myluckysol.fun`

---

## Step 1: Get the Code on GitHub

If your Replit project is not already linked to GitHub:

1. Go to **GitHub.com** → create a new repository (e.g., `myluckysol-app`)
2. In Replit, open the **Shell** tab and run:
   ```
   git remote add origin https://github.com/YOUR_USERNAME/myluckysol-app.git
   git push -u origin main
   ```
3. That's it. GitHub Actions will automatically trigger a build.

---

## Step 2: Build a Debug APK (for Seeker phone testing — no signing needed)

1. Push any change to the `main` branch (or just go to GitHub → Actions)
2. Click **Build MyLuckySol APK** in the Actions sidebar
3. Click **Run workflow** → **Run workflow**
4. Wait ~3 minutes for it to complete
5. Click the completed run → scroll to **Artifacts** → download **MyLuckySol-debug-...**
6. Unzip to get `MyLuckySol-debug.apk`

**To install on a Seeker phone:**
1. Transfer the APK to the phone (email, Google Drive, USB, etc.)
2. On the phone: Settings → Security → allow **Install unknown apps** for your file manager
3. Open the APK file → Install
4. Open MyLuckySol — it will load `https://myluckysol.fun`

> The debug APK is fully functional for testing. It just has `.debug` appended to the package ID and is not signed with a release key.

---

## Step 3: Generate a Signing Keystore (one-time setup)

A signed release APK is required for the Solana dApp Store. Generate your keystore using GitHub Actions (no local tools needed):

1. In your GitHub repo → **Actions** → **Generate Release Keystore**
2. Click **Run workflow** and fill in:
   - **Key alias**: `myluckysol`
   - **Keystore password**: choose a strong password — **save it securely**
   - **Key password**: choose a strong password — **save it securely**
   - **Organization**: `MyLuckySol Foundation`
3. Wait ~1 minute → click the completed run
4. In the logs, find and copy the **base64 keystore string** (the long string after "COPY THIS AS YOUR KEYSTORE_BASE64 GITHUB SECRET")
5. Also copy the **SHA-256 fingerprint** shown in the logs — you will need it for `assetlinks.json`

> **Important**: Also download the `myluckysol-release-keystore` artifact as a backup. If you lose this keystore, you cannot update your app on the store.

---

## Step 4: Add GitHub Secrets

1. In your GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**
2. Add these 4 secrets:

| Secret Name | Value |
|---|---|
| `KEYSTORE_BASE64` | The base64 string from Step 3 |
| `KEYSTORE_PASSWORD` | The keystore password you chose |
| `KEY_ALIAS` | `myluckysol` |
| `KEY_PASSWORD` | The key password you chose |

---

## Step 5: Build the Signed Release APK

1. GitHub → **Actions** → **Build MyLuckySol APK** → **Run workflow**
2. After it completes, download **MyLuckySol-release-...**
3. Unzip to get `MyLuckySol-release.apk` — this is your store submission file

---

## Step 6: Update assetlinks.json

After Step 3, you have a SHA-256 fingerprint. Update the file at:
`client/public/.well-known/assetlinks.json`

Replace `REPLACE_WITH_YOUR_SHA256_FINGERPRINT` with the actual fingerprint (format: `AB:CD:EF:...`).

This enables verified Android App Links so `https://myluckysol.fun` links open directly in the app.

---

## Step 7: Submit to Solana dApp Store

### Required assets before submitting:
- [ ] Signed release APK (`MyLuckySol-release.apk`)
- [ ] App icon: 512x512 PNG → save as `dapp-store/icon-512.png`
- [ ] 4+ screenshots: minimum 1080px wide → save in `dapp-store/screenshots/`
- [ ] Privacy policy live at: `https://myluckysol.fun/privacy`
- [ ] Terms/EULA live at: `https://myluckysol.fun/terms`
- [ ] ~0.2 SOL in a Solana wallet for submission fees

### Submission via Publisher Portal (recommended):
1. Go to [https://publish.solanamobile.com](https://publish.solanamobile.com)
2. Sign up and complete KYC/KYB verification
3. Connect your Solana wallet (Phantom or Solflare)
4. Fill out Publisher Profile
5. Click **Add a dApp** → **New dApp**
6. Fill in app details — use the description from `dapp-store/config.yaml`
7. Upload icon, banner, and screenshots
8. Click **New Version** → upload your signed release APK
9. Submit for review (typically 2-3 business days)

---

## Updating the App

After submitting, whenever you update the web app and want a new store release:

1. Bump `versionCode` and `versionName` in `android/app/build.gradle`
2. Push to GitHub → the signed release APK is built automatically
3. In the Publisher Portal: **New Version** → upload the new APK → submit

---

## Useful References

- [Solana dApp Store docs](https://docs.solanamobile.com/dapp-store/submit-new-app)
- [Publisher Portal](https://publish.solanamobile.com)
- [dApp Store CLI (advanced)](https://github.com/solana-mobile/dapp-publishing)
