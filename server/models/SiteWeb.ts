import mongoose, { Schema, Document } from "mongoose"

export interface ISiteWeb extends Document {
  name: string
  url: string
  regionIds: string[]
  regionsUpdatedAt?: Date
  createdAt: Date
}

const SiteWebSchema = new Schema<ISiteWeb>({
  name: { type: String, required: true },
  url: { type: String, required: true, unique: true },
  regionIds: { type: [String], default: [] },
  regionsUpdatedAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
})

export const SiteWeb = mongoose.model<ISiteWeb>("SiteWeb", SiteWebSchema, "siteweb")
