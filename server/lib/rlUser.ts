import crypto from "crypto"
import mongoose from "mongoose"
import bcrypt from "bcryptjs"
import { Actualisateur } from "../models/Actualisateur"

function displayNameFromEmail(email: string): string {
  const local = email.split("@")[0] || ""
  if (!local) return email
  return local.charAt(0).toUpperCase() + local.slice(1).toLowerCase()
}

/** Ensure Mongo user exists for Region Lovers JWT subject / email (called after successful login). */
export async function syncUserFromRlToken(sub: string, email: string): Promise<void> {
  const _id = new mongoose.Types.ObjectId(sub)
  const user = await Actualisateur.findById(_id)
  const placeholderHash = await bcrypt.hash(
    `rl-placeholder-${crypto.randomBytes(16).toString("hex")}`,
    10
  )

  if (!user) {
    await Actualisateur.create({
      _id,
      email,
      name: displayNameFromEmail(email),
      passwordHash: placeholderHash,
      siteConnections: [],
    })
    return
  }

  if (user.email !== email) {
    user.email = email
    user.name = displayNameFromEmail(email)
    await user.save()
  }
}
