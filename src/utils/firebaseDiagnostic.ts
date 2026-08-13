import firebaseConfig from "../../firebase-applet-config.json";

/**
 * Validates whether the current window location origin/hostname matches the
 * authDomain configured in firebase-applet-config.json.
 * Logs a detailed diagnostic warning to the console if there is a mismatch.
 */
export function validateAuthDomain(): boolean {
  if (typeof window === "undefined") {
    return true;
  }

  const currentOrigin = window.location.origin;
  const currentHostname = window.location.hostname;
  const configuredAuthDomain = firebaseConfig.authDomain || "";
  const normalizedAuthDomain = configuredAuthDomain.replace(/^https?:\/\//, "").trim();

  const isMatch = currentHostname === normalizedAuthDomain;

  if (!isMatch) {
    console.warn(
      `⚠️ [Firebase Auth Domain Mismatch Warning]\n` +
      `- Current Origin: ${currentOrigin}\n` +
      `- Current Hostname: ${currentHostname}\n` +
      `- Configured authDomain: ${configuredAuthDomain || "(none)"}\n` +
      `The current domain '${currentHostname}' does not match the configured Firebase authDomain '${normalizedAuthDomain}'. ` +
      `If you encounter an 'auth/unauthorized-domain' error during Google Sign-In, please ensure '${currentHostname}' ` +
      `is added to the 'Authorized domains' list in the Firebase / Google Cloud Console under Authentication -> Settings.`
    );
  } else {
    console.log(`[Firebase Auth Diagnostic] Domain check passed: Host '${currentHostname}' matches configured authDomain.`);
  }

  return isMatch;
}
