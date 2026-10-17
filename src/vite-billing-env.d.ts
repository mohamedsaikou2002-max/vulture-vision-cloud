// Public build-time feature label. NEVER used for payment authorization.
interface ImportMetaEnv {
  readonly VITE_RELEASE_CHANNEL?: "beta" | "commercial";
}
