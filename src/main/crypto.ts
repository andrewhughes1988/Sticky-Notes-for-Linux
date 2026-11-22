import crypto from 'node:crypto';

const CIPHER_PREFIX = 'enc:v1:';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;

export interface NoteCipher {
  encrypt(plaintext: string, aad: string): string;
  decrypt(value: string, aad: string): string;
  isEncrypted(value: string): boolean;
}

export interface KeyringAdapter {
  isAvailable(): boolean;
  backendName(): string;
  seal(secretHex: string): string;
  unseal(sealedBase64: string): string;
}

export function generateDataEncryptionKey(): Buffer {
  return crypto.randomBytes(KEY_BYTES);
}

export class AesGcmNoteCipher implements NoteCipher {
  private readonly key: Buffer;

  constructor(key: Buffer) {
    if (!Buffer.isBuffer(key) || key.length !== KEY_BYTES) {
      throw new Error('Encryption key must be exactly 32 bytes.');
    }
    this.key = Buffer.from(key);
  }

  public isEncrypted(value: string): boolean {
    return value.startsWith(CIPHER_PREFIX);
  }

  public encrypt(plaintext: string, aad: string): string {
    const iv = crypto.randomBytes(IV_BYTES);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(Buffer.from(aad, 'utf8'));
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${CIPHER_PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
  }

  public decrypt(value: string, aad: string): string {
    if (!this.isEncrypted(value)) {
      return value;
    }
    const payload = value.slice(CIPHER_PREFIX.length);
    const parts = payload.split(':');
    if (parts.length !== 3) {
      throw new Error('Malformed encrypted note payload.');
    }
    const iv = Buffer.from(parts[0], 'base64');
    const tag = Buffer.from(parts[1], 'base64');
    const ciphertext = Buffer.from(parts[2], 'base64');
    if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
      throw new Error('Invalid encrypted note parameters.');
    }
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAAD(Buffer.from(aad, 'utf8'));
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  }
}

interface ElectronSafeStorageLike {
  isEncryptionAvailable(): boolean;
  encryptString(plainText: string): Buffer;
  decryptString(encrypted: Buffer): string;
  getSelectedStorageBackend?: () => string;
}

export function createElectronKeyringAdapter(
  safeStorage: ElectronSafeStorageLike
): KeyringAdapter {
  const getBackend = (): string => {
    try {
      return safeStorage.getSelectedStorageBackend?.() ?? 'system';
    } catch {
      return 'unknown';
    }
  };

  return {
    backendName: getBackend,
    isAvailable(): boolean {
      try {
        if (!safeStorage.isEncryptionAvailable()) return false;
        const backend = getBackend();
        // Do not claim encryption-at-rest is backed by OS keyring if Linux fell back to basic_text.
        return backend !== 'basic_text' && backend !== 'unknown';
      } catch {
        return false;
      }
    },
    seal(secretHex: string): string {
      return safeStorage.encryptString(secretHex).toString('base64');
    },
    unseal(sealedBase64: string): string {
      return safeStorage.decryptString(Buffer.from(sealedBase64, 'base64'));
    },
  };
}
