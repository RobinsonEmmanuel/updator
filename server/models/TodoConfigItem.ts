import mongoose, { Schema, Document } from "mongoose"

export interface TodoTechnicalHints {
  examples?: string[]
  notes?: string
}

export interface ITodoConfigItem extends Document {
  title: string
  description: string
  active: boolean
  order: number
  mainPrompt: string
  additionalPrompts: string[]
  technicalHints: TodoTechnicalHints
  category: string
  createdAt: Date
  updatedAt: Date
}

const TodoTechnicalHintsSchema = new Schema<TodoTechnicalHints>(
  {
    examples: [{ type: String }],
    notes: { type: String },
  },
  { _id: false }
)

const TodoConfigItemSchema = new Schema<ITodoConfigItem>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    active: { type: Boolean, default: true },
    order: { type: Number, default: 1 },
    mainPrompt: { type: String, default: "", trim: true },
    additionalPrompts: [{ type: String }],
    technicalHints: { type: TodoTechnicalHintsSchema, default: {} },
    category: { type: String, default: "contenu" },
  },
  {
    timestamps: true,
  }
)

TodoConfigItemSchema.index({ order: 1, _id: 1 })

export const TodoConfigItem = mongoose.model<ITodoConfigItem>(
  "TodoConfigItem",
  TodoConfigItemSchema,
  "todo_config_items"
)
