import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  email?: string;
  password?: string;
  phone?: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  gender: 'man' | 'woman';
  profileImage?: string;
  role: 'admin' | 'user';
  bio?: string;
  about?: string;
  interest: 'dating' | 'hookup';
  likes: mongoose.Types.ObjectId[];
  dislikes: mongoose.Types.ObjectId[];
  matches: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
  isOnline: boolean;
  lastSeen: Date;
  coins: number;
  profileViews: {
    viewerId: mongoose.Types.ObjectId;
    timestamp: Date;
  }[];
}

const userSchema = new Schema({
  email: { type: String, unique: true, sparse: true },
  password: String,
  phone: { type: String, unique: true, sparse: true },
  role: {
    type: String,
    enum: ['admin', 'user'],
    default: 'user'
  },
  firstName: String,
  lastName: String,
  dateOfBirth: Date,
  gender: {
    type: String,
    enum: ['man', 'woman']
  },
  profileImage: String,
  bio: String,
  about: String,
  interest: {
    type: String,
    enum: ['dating', 'hookup']
  },

  likes: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  dislikes: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  matches: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  isOnline: {
    type: Boolean,
    default: false
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  coins: {
    type: Number,
    default: 0
  },
  isPremium: {
    type: Schema.Types.Boolean,
    default: false,
  },
  profileViews: [{
    viewerId: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },

    timestamp: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Index for geospatial queries
userSchema.index({ location: '2dsphere' });

// const userModel = mongoose.models.User || mongoose.model<IUser>('User', userSchema);
const userModel = mongoose.model<IUser>('User', userSchema);
export default userModel;
