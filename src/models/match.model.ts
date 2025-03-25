import mongoose, { Schema, Document } from 'mongoose';

export interface IMatch extends Document {
  users: mongoose.Types.ObjectId[];
  lastMessage?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const matchSchema = new Schema({
  users: [{
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  lastMessage: {
    type: Schema.Types.ObjectId,
    ref: 'Message'
  }
}, {
  timestamps: true
});

// Ensure exactly 2 users per match
matchSchema.pre('save', function(next) {
  if (this.users.length !== 2) {
    next(new Error('A match must have exactly 2 users'));
  } else {
    next();
  }
});

export default mongoose.model<IMatch>('Match', matchSchema); 