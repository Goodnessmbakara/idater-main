import mongoose, { Schema, Document } from 'mongoose';

export interface IPoint extends Document {
  userId: mongoose.Types.ObjectId;
  amount: number;
  history: {
    action: string;
    points: number;
    date: Date;
  }[];
}

const PointSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, default: 0 },
  history: [{
    action: { type: String, required: true },
    points: { type: Number, required: true },
    date: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

export default mongoose.model<IPoint>('Point', PointSchema);
