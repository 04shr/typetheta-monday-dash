import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";
import { validateAuthDomain } from "../utils/firebaseDiagnostic";

// Validate auth domain during startup
validateAuthDomain();

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

/**
 * Utility function to check and compare current window.location.origin against the configured authDomain.
 * Logs details and issues a warning if there is a mismatch.
 */
export function checkAuthDomainMatch(config = firebaseConfig): void {
  if (typeof window === "undefined") return;

  const currentOrigin = window.location.origin;
  const currentHostname = window.location.hostname;
  const authDomain = config.authDomain || "";
  const normalizedAuthDomain = authDomain.replace(/^https?:\/\//, "").trim();

  console.log(`[Firebase Auth Diagnostic] Current origin: ${currentOrigin} | Configured authDomain: ${authDomain}`);

  if (!normalizedAuthDomain || currentHostname !== normalizedAuthDomain) {
    console.warn(
      `⚠️ [Firebase Auth Domain Mismatch Warning]\n` +
      `- Current Origin: ${currentOrigin} (Host: ${currentHostname})\n` +
      `- Configured authDomain: ${authDomain || "(none)"}\n` +
      `- Warning: Current host '${currentHostname}' does not match configured authDomain '${normalizedAuthDomain}'.\n` +
      `- Action required if experiencing 'auth/unauthorized-domain': Add '${currentHostname}' to Authorized Domains under Firebase Authentication / Google Cloud Console.`
    );
  } else {
    console.log(`[Firebase Auth Check] Host '${currentHostname}' matches configured authDomain.`);
  }
}

// Invoke check during initialization
checkAuthDomainMatch(firebaseConfig);

// Initialize Auth
export const auth = getAuth(app);
if ((firebaseConfig as any).tenantId) {
  auth.tenantId = (firebaseConfig as any).tenantId;
}

// Initialize Firestore with specific database ID if present in config
const dbId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== "" 
  ? firebaseConfig.firestoreDatabaseId 
  : undefined;

export const db = dbId ? getFirestore(app, dbId) : getFirestore(app);

export default app;
