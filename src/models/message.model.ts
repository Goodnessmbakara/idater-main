import mongoose, { Schema, Document } from 'mongoose';

export interface IMessage extends Document {
  senderId: mongoose.Types.ObjectId;
  receiverId: mongoose.Types.ObjectId;
  content: string;
  read: boolean;
  type: 'text' | 'image'; // Added message type
}

const MessageSchema = new Schema({
  senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  receiverId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  read: { type: Boolean, default: false },
  type: { type: String, enum: ['text', 'image'], default: 'text' } // Added message type with default
}, { timestamps: true });

export default mongoose.model<IMessage>('Message', MessageSchema);
