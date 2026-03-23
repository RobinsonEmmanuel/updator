import crypto from "crypto"

const PREFIX = "enc:v1:"
const IV_LENGTH = 12
const TAG_LENGTH = 16

function getKeyBytes(): Buffer {
  const s = process.env.WP_CREDENTIALS_SECRET?.trim()
  if (!s) {
    throw new Error("WP_CREDENTIALS_SECRET is not set")
  }
  if (/^[0-9a-f]+$/i.test(s) && s.length === 64) {
    return Buffer.from(s, "hex")
  }
  return crypto.createHash("sha256").update(s).digest()
}

/** When no secret is set, store plaintext (dev convenience). decryptAppPassword already supports legacy plaintext. */
export function encryptAppPassword(plain: string): string {
  const s = process.env.WP_CREDENTIALS_SECRET?.trim()
  if (!s) {
    console.warn(
      "[WP] WP_CREDENTIALS_SECRET is unset — storing WordPress application password as plaintext. Set WP_CREDENTIALS_SECRET (e.g. openssl rand -hex 32) for encrypted storage."
    )
    return plain
  }
  const key = getKeyBytes()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv)
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return PREFIX + Buffer.concat([iv, tag, enc]).toString("base64")
}

/** Decrypts stored value; returns legacy plaintext when not prefixed with enc:v1: */
export function decryptAppPassword(stored: string): string {
  if (!stored.startsWith(PREFIX)) {
    return stored
  }
  const raw = Buffer.from(stored.slice(PREFIX.length), "base64")
  const iv = raw.subarray(0, IV_LENGTH)
  const tag = raw.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
  const data = raw.subarray(IV_LENGTH + TAG_LENGTH)
  const key = getKeyBytes()
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8")
}

export function isEncryptedAppPassword(stored: string): boolean {
  return stored.startsWith(PREFIX)
}
