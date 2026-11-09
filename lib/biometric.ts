import { Capacitor } from "@capacitor/core";

/**
 * Thin wrapper around @aparajita/capacitor-biometric-auth. Only meaningful
 * inside the native app; on web / SSR every call reports "unavailable" and
 * authenticate() resolves false so the app never locks in a browser.
 */

export function isNativePlatform() {
  return typeof window !== "undefined" && Capacitor.isNativePlatform();
}

export async function isBiometricAvailable(): Promise<boolean> {
  if (!isNativePlatform()) return false;
  try {
    const { BiometricAuth } = await import("@aparajita/capacitor-biometric-auth");
    const info = await BiometricAuth.checkBiometry();
    return info.isAvailable;
  } catch {
    return false;
  }
}

export async function authenticate(reason: string): Promise<boolean> {
  if (!isNativePlatform()) return true;
  try {
    const { BiometricAuth } = await import("@aparajita/capacitor-biometric-auth");
    await BiometricAuth.authenticate({
      reason,
      cancelTitle: "Cancel",
      allowDeviceCredential: true,
      iosFallbackTitle: "Use passcode",
    });
    return true;
  } catch {
    return false;
  }
}
