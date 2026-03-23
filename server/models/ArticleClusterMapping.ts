import mongoose, { Document, Schema, Types } from "mongoose"

export type ClusterMappingStatus = "auto" | "needs_review" | "approved" | "overridden"

export interface IArticleClusterMapping extends Document {
  siteId: Types.ObjectId
  wpPostId: number
  clusterIds: string[]
  confidence: number
  status: ClusterMappingStatus
  sourceSignals: string[]
  updatedAt: Date
  createdAt: Date
}

const ArticleClusterMappingSchema = new Schema<IArticleClusterMapping>({
  siteId: { type: Schema.Types.ObjectId, ref: "SiteWeb", required: true, index: true },
  wpPostId: { type: Number, required: true, index: true },
  clusterIds: { type: [String], default: [] },
  confidence: { type: Number, required: true, default: 0 },
  status: {
    type: String,
    enum: ["auto", "needs_review", "approved", "overridden"],
    default: "needs_review",
    index: true,
  },
  sourceSignals: { type: [String], default: [] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
})

ArticleClusterMappingSchema.index({ siteId: 1, wpPostId: 1 }, { unique: true })

ArticleClusterMappingSchema.pre("save", function(next) {
  this.updatedAt = new Date()
  next()
})

export const ArticleClusterMapping = mongoose.model<IArticleClusterMapping>(
  "ArticleClusterMapping",
  ArticleClusterMappingSchema,
  "article_cluster_mappings"
)
