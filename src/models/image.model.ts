import mongoose, { Schema, Document } from 'mongoose';

export interface IImage extends Document {
  url: string;
  userId: mongoose.Types.ObjectId;
  isProfilePicture: boolean;
}

const ImageSchema = new Schema({
  url: { type: String, required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

export default mongoose.model<IImage>('Image', ImageSchema);
