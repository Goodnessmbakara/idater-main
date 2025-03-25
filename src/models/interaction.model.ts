import mongoose, { Schema, Document } from 'mongoose';

export interface IInteraction extends Document {
  fromUser: mongoose.Types.ObjectId;
  toUser: mongoose.Types.ObjectId;
  type: 'like' | 'dislike';
  createdAt: Date;
}

const interactionSchema = new Schema({
  fromUser: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  toUser: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['like', 'dislike'],
    required: true
  }
}, {
  timestamps: true
});

interactionSchema.index({ fromUser: 1, toUser: 1 }, { unique: true });

export default mongoose.model<IInteraction>('Interaction', interactionSchema); 