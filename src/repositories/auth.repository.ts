import bcrypt from "bcryptjs"
import userModel, { IUser } from "../models/user.model";
import { TwilioRepository } from "./twillio.repository";
import VerificationModel from "../models/verification.model";
import jwt from 'jsonwebtoken';
import { config } from "../config";
import { OAuth2Client } from 'google-auth-library';


export class AuthError extends Error {
  constructor(
    message: string,
    public code: AuthErrorCode,
    public originalError?: unknown
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export enum AuthErrorCode {
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  EMAIL_ALREADY_EXISTS = 'EMAIL_ALREADY_EXISTS',
  PHONE_ALREADY_EXISTS = 'PHONE_ALREADY_EXISTS',
  INVALID_OTP = 'INVALID_OTP',
  WEAK_PASSWORD = 'WEAK_PASSWORD',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  UNKNOWN = 'UNKNOWN',
}

export interface UserData {
  id: string;
  email?: string;
  phoneNumber?: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: Date;
  profilePicture?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthRepository {
  // Email authentication
  signUpWithEmail(
    email: string, 
    password: string, 
  ): Promise<boolean>;

  signUpWithPhone(
    phoneNumber: string,
    password: string
  ): Promise<{ verificationId: string }>;

  verifyOTP(
    verificationId: string, 
    otp: string
  ): Promise<{ user: UserData; tokens: AuthTokens }>;
  
  signInWithGoogle(idToken: string): Promise<{ user: Partial<UserData>; token: string }>;
}

interface PendingPhoneUser {
  phoneNumber: string;
  password: string;
  verificationId: string;
}

export class AuthRepositoryImpl implements AuthRepository {
  private googleClient: OAuth2Client;

  constructor() {
    this.googleClient = new OAuth2Client(config.auth.googleClientId);
  }

  async signUpWithEmail(
    email: string,
    password: string,
  ): Promise<boolean> {
    try {
      const existingUser = await userModel.findOne({ email });
      if (existingUser) {
        throw new AuthError('Email already exists', AuthErrorCode.EMAIL_ALREADY_EXISTS);
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const user = new userModel({
        email,
        password: hashedPassword,
        role: 'user'
      });

      await user.save();
      return true;
    } catch (error) {
      this.handleError(error);
    }
  }

  async loginWithEmail(
    user: IUser,
    password: string
  ): Promise<string> {
    try {
      const isValidPassword = await this.verifyPassWord(password, user.password);
      if (!isValidPassword) {
        throw new AuthError('Invalid credentials', AuthErrorCode.INVALID_CREDENTIALS);
      }

      const token = jwt.sign(
        {
          userId: user._id,
          email: user.email
        },
        config.auth.jwtSecret,
        { expiresIn: config.auth.tokenExpiry }
      );

      return token;
    } catch (error) {
      console.error('Error in loginWithEmail:', error);
      this.handleError(error);
    }
  }

  async signUpWithPhone(
    phoneNumber: string,
    password: string
  ): Promise<{ verificationId: string }> {
    try {
      const existingUser = await userModel.findOne({ phone: phoneNumber });
      if (existingUser) {
        throw new AuthError('Phone number already exists', AuthErrorCode.PHONE_ALREADY_EXISTS);
      }

      // Hash password before storing
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Store pending user data
      const pendingUser = new VerificationModel({
        phoneNumber,
        password: hashedPassword,
        type: 'PHONE_SIGNUP',
        createdAt: new Date()
      });
      await pendingUser.save();

      // Send OTP
      const twilioRepository = new TwilioRepository();
      const verificationId = await twilioRepository.sendOTP(phoneNumber);

      // Update verification record with verificationId
      await VerificationModel.findByIdAndUpdate(
        pendingUser.id,
        { verificationId }
      );

      return { verificationId };
    } catch (error) {
      this.handleError(error);
    }
  }

  async completePhoneSignup(
    verificationId: string,
    otp: string
  ): Promise<{ user: Partial<UserData>; token: string }> {
    try {
      const verification = await VerificationModel.findOne({ 
        verificationId,
        type: 'PHONE_SIGNUP'
      });

      if (!verification) {
        throw new AuthError('Invalid verification ID', AuthErrorCode.INVALID_CREDENTIALS);
      }

      // Verify OTP
      const twilioRepository = new TwilioRepository();
      const isValid = await twilioRepository.verifyOTP(verification.phoneNumber, otp);

      if (!isValid) {
        throw new AuthError('Invalid OTP', AuthErrorCode.INVALID_CREDENTIALS);
      }

      // Create new user
      const user = new userModel({
        phone: verification.phoneNumber,
        password: verification.password, // Already hashed during signup
        role: 'user'
      });
      await user.save();

      // Generate token
      const token = jwt.sign(
        {
          userId: user.id,
          phoneNumber: user.phone
        },
        config.auth.jwtSecret,
        { expiresIn: config.auth.tokenExpiry }
      );

      // Clean up verification
      await VerificationModel.findByIdAndDelete(verification.id);

      return {
        user: {
          id: user.id,
          phoneNumber: user.phone
        },
        token
      };
    } catch (error) {
      this.handleError(error);
    }
  }

  async loginWithPhone(
    phoneNumber: string,
    password: string
  ): Promise<string> {
    try {
      const user = await userModel.findOne({ phone: phoneNumber });
      if (!user) {
        throw new AuthError('Invalid credentials', AuthErrorCode.INVALID_CREDENTIALS);
      }

      const isValidPassword = await this.verifyPassWord(password, user.password);
      if (!isValidPassword) {
        throw new AuthError('Invalid credentials', AuthErrorCode.INVALID_CREDENTIALS);
      }

      const token = jwt.sign(
        {
          userId: user.id,
          phoneNumber: user.phone
        },
        config.auth.jwtSecret,
        { expiresIn: config.auth.tokenExpiry }
      );

      return token;
    } catch (error) {
      console.error('Error in loginWithPhone:', error);
      this.handleError(error);
    }
  }

  async verifyCredentials(email: string | null, password: string | null, phoneNumber: string | null) {
    try {
      let user;

      if (email && password) {
        user = await userModel.findOne({ email });
        if (!user) {
          throw new AuthError('Invalid credentials', AuthErrorCode.INVALID_CREDENTIALS);
        }
        return user;
      }

      if (phoneNumber && password) {
        user = await userModel.findOne({ phone: phoneNumber });
        if (!user) {
          throw new AuthError('Invalid credentials', AuthErrorCode.INVALID_CREDENTIALS);
        }
        return user;
      }

      throw new AuthError('Invalid credentials', AuthErrorCode.INVALID_CREDENTIALS);
    } catch (error) {
      this.handleError(error);
    }
  }

  async findUserByEmail(email: string): Promise<IUser | null> {
    return userModel.findOne({ email });
  }

  async verifyPassWord(password:string, userHashedPassword:string): Promise<boolean> {    
    try {
      const isMatch = await bcrypt.compare(password, userHashedPassword);
      return isMatch;
    } catch (error) {
      throw new AuthError(error, AuthErrorCode.UNKNOWN);
    }
  }

  async signInWithGoogle(idToken: string): Promise<{ user: Partial<UserData>; token: string }> {
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: config.auth.googleClientId
      });
      const payload = ticket.getPayload();
      
      if (!payload) {
        throw new AuthError('Invalid Google token', AuthErrorCode.INVALID_CREDENTIALS);
      }
      let user = await this.findUserByEmail(payload.email);

      if (!user) {
        user = await userModel.create({
          email: payload.email,
          name: payload.name,
          googleId: payload.sub,
        });
      }

      const token = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          phoneNumber: user.phone
        },
        config.auth.jwtSecret,
        { expiresIn: config.auth.tokenExpiry }
      );

      return { user, token };
    } catch (error) {
      this.handleError(error);
    }
  }

  async verifyOTP(
    verificationId: string,
    otp: string
  ): Promise<{ user: UserData; tokens: AuthTokens }> {
    try {
      // Implementation for OTP verification
      throw new Error('Not implemented');
    } catch (error) {
      this.handleError(error);
    }
  }

  private handleError(error: unknown): never {
    if (error instanceof AuthError) {
      throw error;
    }

    if (error instanceof Error) {
      if (error.message.includes('invalid credentials')) {
        throw new AuthError('Invalid credentials', AuthErrorCode.INVALID_CREDENTIALS, error);
      }
      if (error.message.includes('network')) {
        throw new AuthError('Network error occurred', AuthErrorCode.NETWORK_ERROR, error);
      }
    }
    throw new AuthError('An unknown error occurred', AuthErrorCode.UNKNOWN, error);
  }
}
