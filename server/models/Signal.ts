import mongoose, { Schema, Document } from "mongoose"

export type SignalType = "closure" | "price_change" | "new_info" | "suspicious"
export type SignalStatus = "open" | "resolved" | "dismissed"

export interface ISignal extends Document {
  entityName: string
  type: SignalType
  note: string
  siteId?: string
  clusterIds: string[]
  detectedAt: Date
  detectedBy: string
  status: SignalStatus
  expiresAt?: Date
  sourceUrl?: string
  createdAt: Date
}

const SignalSchema = new Schema<ISignal>({
  entityName: { type: String, required: true },
  type: { 
    type: String, 
    enum: ["closure", "price_change", "new_info", "suspicious"],
    required: true 
  },
  note: { type: String, required: true },
  siteId: { type: String },
  clusterIds: [{ type: String }],
  detectedAt: { type: Date, required: true },
  detectedBy: { type: String, required: true },
  status: { 
    type: String, 
    enum: ["open", "resolved", "dismissed"],
    default: "open" 
  },
  expiresAt: { type: Date },
  sourceUrl: { type: String },
  createdAt: { type: Date, default: Date.now }
})

export const Signal = mongoose.model<ISignal>("Signal", SignalSchema, "signals")
