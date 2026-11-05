# Vulture Vision — investor demonstration Android build

This Android WebViewAssetLoader shell packages the built Vite website inside an APK.
It does **not** embed a Python, Edge Function, Supabase, or analytics server.

Build in this repository with Node 22, npm, JDK 17, Android SDK 35 and Gradle 8.11.1:

```sh
npm ci
VITE_INVESTOR_DEMO_MODE=true npm run build
mkdir -p android/app/src/main/assets
cp -a dist/. android/app/src/main/assets/
gradle -p android :app:assembleDebug --no-daemon
```

The APK is at `android/app/build/outputs/apk/debug/app-debug.apk`.
The GitHub Action `Vulture Vision Investor Android APK` produces an artifact with that file.

Scenario Lab and Intelligence are **preloaded deterministic demonstrations**.
News and Analytics use the existing `vv-news` and `vv-analytics` hosted Supabase functions and
are live only when the configured project and all backend dependencies are reachable.
The public `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` must be correctly configured
at build time. Do not package service role, Gemini, news provider, or Stripe secret keys.

The debug APK is for private, consented installation and investor demonstrations only.
A production release requires release signing, legal/policy review, device testing,
WebView hardening, and backend acceptance tests. This demonstration does not bypass billing,
authentication, database RLS, or server-side entitlements.
