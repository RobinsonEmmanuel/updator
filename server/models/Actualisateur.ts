import mongoose, { Schema, Document, Types } from "mongoose"
import bcrypt from "bcryptjs"

export interface ISiteConnection {
  siteId: Types.ObjectId
  username: string
  appPassword: string
}

export interface IActualisateur extends Document {
  email: string
  passwordHash: string
  name: string
  siteConnections: ISiteConnection[]
  createdAt: Date
  comparePassword(candidatePassword: string): Promise<boolean>
}

const SiteConnectionSchema = new Schema<ISiteConnection>({
  siteId: { type: Schema.Types.ObjectId, ref: "SiteWeb", required: true },
  username: { type: String, required: true },
  appPassword: { type: String, required: true }
}, { _id: false })

const ActualisateurSchema = new Schema<IActualisateur>({
  email: { 
    type: String, 
    required: true, 
    unique: true,
    lowercase: true,
    trim: true
  },
  passwordHash: { type: String, required: true },
  name: { type: String, required: true },
  siteConnections: [SiteConnectionSchema],
  createdAt: { type: Date, default: Date.now }
})

ActualisateurSchema.pre("save", async function() {
  if (!this.isModified("passwordHash")) return

  if (!this.passwordHash.startsWith("$2")) {
    const salt = await bcrypt.genSalt(10)
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt)
  }
})

ActualisateurSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.passwordHash)
}

export const Actualisateur = mongoose.model<IActualisateur>("Actualisateur", ActualisateurSchema, "actualisateurs")
