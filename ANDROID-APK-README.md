# Vulture Vision Android APK

This branch packages the existing Vulture Vision React/Vite frontend **inside an Android WebView**, loaded from a local secure HTTPS asset origin. The app has an independent launcher and keeps the existing Supabase backend; it is **not an offline market-data or AI backend**.

## Download/install

1. Open **Actions > Build Vulture Vision Android APK** in this repository.
2. Open a successful run for branch `android-apk-2026-10-18`.
3. Download the `VultureVision-Android-APK` artifact ZIP and extract `app-debug.apk`.
4. Transfer the APK to an Android phone and allow installation from that file source.
5. Use on Android 8.0+ (API 26+).

A debug APK is installable and debug-signed, but is not signed for Play Store production distribution. For a release use a private keystore stored outside Git.

## Important Google sign-in setup

The web app previously used the Lovable Google OAuth broker. On Android, OAuth cannot be performed in an embedded WebView. The APK instead opens the Android system browser and completes a Supabase-native OAuth session. In Supabase project settings:
- Ensure **Authentication > Providers > Google** is enabled and configured. The Lovable broker configuration alone may not be sufficient.
- Add **`vulturevision://auth/callback`** to **Authentication > URL Configuration > Redirect URLs**.
- Confirm the deployed OAuth and Edge Function CORS policies accept the local secure origin `https://appassets.androidplatform.net` where applicable.
- Sign-in and AI services cannot be verified without those live backend settings. The backend's existing Gemini issue is not solved by the Android wrapper.

The frontend build uses the repo's Vite environment variables, including `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Never put service-role keys, Stripe secrets, Gemini tokens, or other private credentials in Vite variables or in the Android client.

## Build on Windows locally

Install Node 22, JDK 17, Android SDK platform 35, and Gradle 8.10.2.

```powershell
npm ci
npm run build
New-Item -ItemType Directory -Force android/app/src/main/assets/web
Copy-Item dist/* android/app/src/main/assets/web/ -Recurse -Force
cd android
gradle :app:assembleDebug
```

The APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`.

## Security and scope

Android WebView is restricted to the local asset origin; external navigation opens in the system browser. The app does not embed any backend functions, crawlers, model binaries, trading execution, or privileged SDR features. Production release signing and actual on-device testing are still required.
