# MyLuckySol APK Extras — Technical Requirements

This document outlines the specifications and best practices for high-quality visual assets and experiences in the MyLuckySol Android APK.

## Splash Screen / Loading Screen

The splash screen appears when the app launches before the WebView loads `https://myluckysol.fun`.

### File Location
- `android/app/src/main/res/layout/splash_screen.xml` (XML layout)
- `android/app/src/main/java/fun/myluckysol/app/SplashActivity.kt` (optional: Java/Kotlin activity for custom animation)

### Specifications
- **Duration**: 2–3 seconds (auto-dismiss once WebView loads)
- **Dimensions**: Full device screen (matches device display density)
- **Safe Area**: Keep text/logo in center 80% of screen (top/bottom bezels may be cut off)
- **Color Scheme**: Follow replit.md preferences (dark theme, gold primary, purple secondary, green accent)
- **Typography**: Space Grotesk font family (as per design system)
- **Background**: Solid dark gradient or animated background (no complex animations — keep file size <500KB)
- **Brand Elements**: MyLuckySol logo, app name, tagline (e.g., "Provably Fair Solana Gaming")
- **No Loading Text**: Avoid "Loading..." or spinner text; let animation convey loading state

### Recommended Approach
1. **Simple Option**: Static image (PNG, 1080×1920px for baseline, provide all densities: mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi)
2. **Advanced Option**: Animated splash using Lottie JSON (lightweight animation library, ~100KB max)

### Asset Densities (if using PNG)
- **mdpi**: 320×426 (baseline, 160dpi)
- **hdpi**: 480×640 (240dpi)
- **xhdpi**: 720×960 (320dpi)
- **xxhdpi**: 1080×1440 (480dpi)
- **xxxhdpi**: 1440×1920 (640dpi)

Provide all 5 density buckets for consistent appearance across all Seeker phones.

---

## App Icon

App icons are used on the Seeker home screen and in system menus.

### File Location
- `android/app/src/main/res/mipmap-*/ic_launcher.png` (foreground icon at various densities)
- `android/app/src/main/res/mipmap-*/ic_launcher_round.png` (rounded variant)

### Specifications
- **Format**: PNG with transparency
- **Safe Zone**: Keep icon content in center 66% (outer 34% may be masked by system)
- **Minimum Size**: 512×512px source image (will be downscaled to densities)
- **Aspect Ratio**: 1:1 (square)
- **Style**: 
  - Match MyLuckySol brand (gold, dark theme, casino aesthetic)
  - Recognize­able at small sizes (48dp on launcher is ~1cm²)
  - No text or fine details that won't scale down
- **Background**: Solid or subtle gradient (avoid transparency in background for contrast)

### Recommended Approach
Provide a 512×512px master PNG. The build system will auto-generate all 5 density variants:
- **mdpi** (48dp): 48×48px
- **hdpi** (72dp): 72×72px
- **xhdpi** (96dp): 96×96px
- **xxhdpi** (144dp): 144×144px
- **xxxhdpi** (192dp): 192×192px

The GitHub Actions build workflow already handles density auto-generation (`generateReleaseIcon` task), so provide one high-quality master PNG.

---

## App Colors & Theme

Located in `android/app/src/main/res/values/colors.xml` and applied via Android theme in `styles.xml`.

### Current Colors (from replit.md)
- **Primary**: Gold (`#D4A574` or similar warm gold)
- **Secondary**: Purple (`#9333EA` or similar vibrant purple)
- **Accent**: Green (`#10B981` or similar emerald)
- **Background**: Dark (`#0F172A` or similar dark slate)
- **Text**: Light (`#FFFFFF` for primary, `#E5E7EB` for secondary)

### Recommendations
- Ensure 4.5:1 contrast ratio for accessibility (WCAG AA standard)
- Test colors on physical Seeker devices under various lighting
- Dark theme reduces eye strain during gaming sessions

---

## Status Bar & Navigation Bar

Customize Android system UI elements for brand consistency.

### Status Bar (Top)
- **Background**: Dark theme (app primary dark color)
- **Icons**: Light (white)
- **File**: `android/app/src/main/res/values/styles.xml` → `android:statusBarColor`

### Navigation Bar (Bottom)
- **Background**: Match status bar color
- **Button Icons**: Light (white)
- **File**: `android/app/src/main/res/values/styles.xml` → `android:navigationBarColor`

---

## User-Facing Notification Alerts

The app shows in-app notifications (not system notifications) for game events. These are already implemented but should match the APK's visual theme.

### Current Implementation
- Location: `client/src/components/GameNotification.tsx` and related UI
- Style: Gold accent color, dark background, casino aesthetic
- **Requirement**: No changes needed unless you want to add sound/haptics feedback

---

## Deep Link Graphics (Optional)

If distributing via links, consider providing social media preview images:
- **Logo**: 1200×630px (for Open Graph preview)
- **Game Screenshot**: 1080×1920px (feature showcase)

These don't go in the APK but help with user acquisition through marketing links.

---

## Solana dApp Store Submission Requirements

When submitting to the Solana dApp Store:

### Required Assets
1. **App Icon**: 512×512px (as per above)
2. **Feature Graphic**: 1024×500px (banner for store listing)
3. **Screenshots**: 
   - 3–5 screenshots (540×960px each, portrait)
   - Show key features: wallet connection, game selection, leaderboard
4. **Short Description**: <80 characters
5. **Full Description**: <4000 characters (highlight provably fair, WAGA rewards, multiplayer)

### Signing Requirements
- **Release APK** must be signed with a keystore
- GitHub Actions workflow (`.github/workflows/generate-keystore.yml`) creates this
- Requires 4 secrets: `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`
- **Important**: Store these securely; losing them means you cannot update the app

---

## File Organization Checklist

- [ ] Splash screen image (`android/app/src/main/res/layout/splash_screen.xml`)
- [ ] App icon master PNG (512×512px) → place in `android/app/src/main/res/mipmap-nodpi/ic_launcher.png`
- [ ] Colors defined in `android/app/src/main/res/values/colors.xml`
- [ ] Theme styles in `android/app/src/main/res/values/styles.xml`
- [ ] Signed release APK generated via GitHub Actions
- [ ] dApp Store assets prepared (feature graphic, screenshots, descriptions)

---

## Design System Consistency

All APK extras should align with the existing MyLuckySol design system:

- **Font**: Space Grotesk (already used in web UI)
- **Color Palette**: Gold, purple, green, dark backgrounds (casino aesthetic)
- **Spacing**: Consistent 16dp/32dp gutters (Android standard)
- **Elevation**: Subtle shadows for depth (Android Material Design principles)
- **Animations**: Smooth, < 300ms transitions (reduce motion on older devices)
- **Branding**: MyLuckySol wordmark + icon (cohesive with web presence)

---

## Quality Checklist Before Submission

- [ ] Splash screen renders correctly on mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi devices
- [ ] App icon is crisp and recognizable at 48dp (smallest launcher size)
- [ ] Colors meet WCAG AA contrast requirements (4.5:1 for text)
- [ ] No text/fine details in icon safe zone (outer 34% of bounds)
- [ ] APK size <50MB (typical for WebView wrapper)
- [ ] Signed release APK passes Google Play validation (if submitting there later)
- [ ] WebView loads `https://myluckysol.fun` correctly after splash screen
- [ ] All 5 density variants present and match quality
- [ ] dApp Store screenshots show clear wallet connection flow
- [ ] No hardcoded developer URLs in APK (all use HTTPS)

---

## Next Steps

1. **Design splash screen** (use Figma or design tool matching casino aesthetic)
2. **Create app icon master** (512×512px PNG, opaque background)
3. **Export densities** (or provide master for auto-generation)
4. **Test on Seeker phone** (compare against web UI colors)
5. **Prepare dApp Store assets** (feature graphic, 3–5 screenshots, descriptions)
6. **Generate signed APK** via GitHub Actions
7. **Submit to Solana dApp Store** via their review process

---

## Resources

- **Android Densities**: https://developer.android.com/training/multiscreen/screendensities
- **Solana dApp Store**: https://solanamobile.com/dapp-store
- **Material Design**: https://m3.material.io/
- **Space Grotesk Font**: https://fonts.google.com/specimen/Space+Grotesk

