/**
 * Secure password hashing using Web Crypto API (SHA-256 with salt)
 */
export async function hashPassword(password: string, salt: string = 'kpst_secure_salt_2026'): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${salt}:${password}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPassword(password: string, expectedHash: string, salt: string = 'kpst_secure_salt_2026'): Promise<boolean> {
  const calculatedHash = await hashPassword(password, salt);
  return calculatedHash === expectedHash;
}

export function sanitizeUsername(username: string): string {
  return username.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '');
}
