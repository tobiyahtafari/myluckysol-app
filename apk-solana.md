# Solana Seeker Phone DApp Submission & APK Instructions

This document provides technical instructions for packaging **MyLuckySol** into an Android APK for the Solana DApp Store and the corresponding prompt to give Replit for the final conversion.

## 1. Prerequisites for Submission
- **Mainnet Deployment**: The DApp must be fully deployed on Solana Mainnet with a valid SSL/HTTPS URL.
- **Mobile Responsive**: Ensure the UI (Casino Dark Theme, Space Grotesk font) works perfectly on mobile viewports.
- **Solana Mobile Stack (SMS)**: The app uses the Solana Wallet Adapter, which is compatible with Mobile Wallet Adapter (MWA) for on-device signing on the Seeker phone.

## 2. APK Packaging Strategy
Since MyLuckySol is a web-based DApp, the most efficient path to an APK for the DApp Store is using **Trusted Web Activity (TWA)** or a **Capacitor** wrapper. This allows the app to run as a native-like Android app while maintaining its web-based Solana integration.

### Asset Requirements
- **Icon**: 512x512px PNG (No transparency for Android adaptive icons).
- **Splash Screen**: 2732x2732px PNG.
- **DApp Metadata**: 
  - Name: MyLuckySol
  - Category: Gaming/Gambling
  - Description: Provably fair Solana chance game.

## 3. Deployment Prompt for Replit
Once your Mainnet URL is live (e.g., `https://myluckysol.replit.app`), provide the following prompt to Replit to generate the mobile package:

> **"I have deployed MyLuckySol to mainnet at [YOUR_URL]. I now need to package this as an Android APK for the Solana Seeker DApp Store. Please:
> 1. Initialize Capacitor in the project.
> 2. Add the Android platform.
> 3. Configure the `capacitor.config.ts` to point to my mainnet URL or build folder.
> 4. Ensure the Web Manifest (manifest.json) includes the correct theme colors (Casino Dark) and icons.
> 5. Generate a debug APK that I can use to test on my Solana Seeker device."**

## 4. Testing on Seeker Phone
1. **Enable Developer Mode**: Go to Settings > About Phone > Tap 'Build Number' 7 times.
2. **Install APK**: Transfer the `.apk` file to the device and install.
3. **MWA Test**: Open the app and click "Connect Wallet". It should automatically trigger the Solflare or Phantom mobile app for signing.

## 5. DApp Store Submission
Submit the final signed APK via the [Solana Mobile DApp Publisher Portal](https://publisher.solanamobile.com/). You will need:
- The APK file.
- App store screenshots (Seeker 1080x2400 resolution).
- Your Mainnet Program ID and verified source code link.
