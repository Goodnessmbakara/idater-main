import mongoose, { Document, Schema } from 'mongoose';

export interface IVerification extends Document {
  phoneNumber: string;
  password: string;
  verificationId: string;
  createdAt: Date;
  updatedAt: Date;
}

const VerificationSchema: Schema = new Schema({
  phoneNumber: {
    type: String,
    required: true,
    unique: true,
  },
  verificationId: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
}, {
  timestamps: true,
});

const VerificationModel = mongoose.model<IVerification>('Verification', VerificationSchema);

export default VerificationModel;
