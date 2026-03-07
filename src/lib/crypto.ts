import { randomBytes, createCipheriv, createDecipheriv } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

let encryptionKey: Buffer | null = null;
let warned = false;

function getKey(): Buffer | null {
  if (encryptionKey) return encryptionKey;

  const keyHex = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!keyHex) {
    if (!warned) {
      console.warn(
        "[crypto] CREDENTIAL_ENCRYPTION_KEY not set — credentials stored in plaintext. " +
          'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
      );
      warned = true;
    }
    return null;
  }

  if (keyHex.length !== 64) {
    throw new Error(
      "CREDENTIAL_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). " +
        `Got ${keyHex.length} characters.`
    );
  }

  encryptionKey = Buffer.from(keyHex, "hex");
  return encryptionKey;
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns "iv:authTag:ciphertext" (all base64-encoded).
 * If no encryption key is configured, returns plaintext as-is.
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  if (!key) return plaintext;

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

/**
 * Decrypts an encrypted string produced by encrypt().
 * Auto-detects plaintext values (for migration from unencrypted storage)
 * and returns them as-is.
 * If no encryption key is configured, returns the value as-is.
 */
export function decrypt(encrypted: string): string {
  const key = getKey();
  if (!key) return encrypted;

  // Auto-detect plaintext: encrypted values always have exactly 2 colons
  // separating iv:authTag:ciphertext (all base64)
  const parts = encrypted.split(":");
  if (parts.length !== 3) {
    // Likely a plaintext value from before encryption was enabled
    return encrypted;
  }

  try {
    const iv = Buffer.from(parts[0], "base64");
    const authTag = Buffer.from(parts[1], "base64");
    const ciphertext = Buffer.from(parts[2], "base64");

    if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
      // Doesn't match expected format — treat as plaintext
      return encrypted;
    }

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  } catch {
    // Decryption failed — could be plaintext or wrong key
    // Return as-is to avoid breaking existing functionality
    return encrypted;
  }
}
