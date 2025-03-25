import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { AuthError, AuthErrorCode } from '../repositories/auth.repository';

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string = 'APP_ERROR'
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const errorMiddleware = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (error instanceof AuthError) {
    const statusCode = getAuthErrorStatusCode(error.code);
    return res.sendError(error, statusCode);
  }

  if (error instanceof mongoose.Error.ValidationError) {
    return res.sendError(error, 400);
  }

  if (error instanceof AppError) {
    return res.sendError(error, error.statusCode);
  }
  console.log(error);
  

res.status(500).json({
  name: error.name,
  message: error.message,
  stack: error.stack,
  path: req.path,
  method: req.method,
})
};

function getAuthErrorStatusCode(code: AuthErrorCode): number {
  switch (code) {
    case AuthErrorCode.INVALID_CREDENTIALS:
      return 401;
    case AuthErrorCode.EMAIL_ALREADY_EXISTS:
    case AuthErrorCode.PHONE_ALREADY_EXISTS:
      return 409;
    case AuthErrorCode.INVALID_OTP:
      return 400;
    case AuthErrorCode.TOKEN_EXPIRED:
      return 401;
    case AuthErrorCode.USER_NOT_FOUND:
      return 404;
    case AuthErrorCode.NETWORK_ERROR:
      return 503;
    default:
      return 500;
  }
}
