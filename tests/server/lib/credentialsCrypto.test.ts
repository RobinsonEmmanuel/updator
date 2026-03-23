import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { encryptAppPassword, decryptAppPassword, isEncryptedAppPassword } from "../../../server/lib/credentialsCrypto"

describe("credentialsCrypto", () => {
  const prev = process.env.WP_CREDENTIALS_SECRET

  beforeEach(() => {
    process.env.WP_CREDENTIALS_SECRET = "a".repeat(64)
  })

  afterEach(() => {
    if (prev === undefined) {
      delete process.env.WP_CREDENTIALS_SECRET
    } else {
      process.env.WP_CREDENTIALS_SECRET = prev
    }
  })

  it("round-trips plaintext", () => {
    const plain = "wp-app-password-xyz"
    const enc = encryptAppPassword(plain)
    expect(isEncryptedAppPassword(enc)).toBe(true)
    expect(decryptAppPassword(enc)).toBe(plain)
  })

  it("returns legacy plaintext unchanged", () => {
    const legacy = "old-plaintext"
    expect(isEncryptedAppPassword(legacy)).toBe(false)
    expect(decryptAppPassword(legacy)).toBe(legacy)
  })

  it("without WP_CREDENTIALS_SECRET stores plaintext", () => {
    delete process.env.WP_CREDENTIALS_SECRET
    const plain = "dev-password"
    const out = encryptAppPassword(plain)
    expect(out).toBe(plain)
    expect(isEncryptedAppPassword(out)).toBe(false)
    expect(decryptAppPassword(out)).toBe(plain)
  })
})
