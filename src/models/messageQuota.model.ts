import mongoose, { Schema, Document } from 'mongoose';

export interface IMessageQuota extends Document {
    userId: mongoose.Types.ObjectId;
    date: string; // Store date as YYYY-MM-DD string
    count: number;
}

const messageQuotaSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true }, // Store as YYYY-MM-DD
    count: { type: Number, default: 0 }
});

// Create compound index for userId + date
messageQuotaSchema.index({ userId: 1, date: 1 }, { unique: true });

export const MessageQuota = mongoose.model<IMessageQuota>('MessageQuota', messageQuotaSchema);