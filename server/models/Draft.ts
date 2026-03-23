import mongoose, { Schema, Document } from "mongoose"

export type DraftStatus = "editing" | "ready_to_push" | "pushed"

export interface IDraft extends Document {
  articleId: string
  siteId?: string
  clusterId?: string
  content: string
  checksSnapshot: Record<string, boolean | null>
  createdAt: Date
  updatedAt: Date
  author: string
  status: DraftStatus
}

const DraftSchema = new Schema<IDraft>({
  articleId: { type: String, required: true },
  siteId: { type: String },
  clusterId: { type: String },
  content: { type: String, required: true },
  checksSnapshot: { type: Schema.Types.Mixed, default: {} },
  author: { type: String, required: true },
  status: { 
    type: String, 
    enum: ["editing", "ready_to_push", "pushed"],
    default: "editing" 
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
})

DraftSchema.pre("save", function(next) {
  this.updatedAt = new Date()
  next()
})

export const Draft = mongoose.model<IDraft>("Draft", DraftSchema, "drafts")
