import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthError, AuthErrorCode } from '../repositories/auth.repository';
import { config } from '../config';


export const authMiddleware = (
  req: Request,
  res: Response, 
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      throw new AuthError(
        'No authorization token provided',
        AuthErrorCode.INVALID_CREDENTIALS
      );
    }

    const token = authHeader.split(' ')[1];
    
    if (!token) {
      throw new AuthError(
        'Invalid authorization header format',
        AuthErrorCode.INVALID_CREDENTIALS
      );
    }

    try {
      const decoded = jwt.verify(token, config.auth.jwtSecret) as { userId: string };
      req.user = decoded;
      next();
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AuthError(
          'Token has expired',
          AuthErrorCode.TOKEN_EXPIRED,
          error
        );
      }
      throw new AuthError(
        'Invalid token',
        AuthErrorCode.INVALID_CREDENTIALS,
        error
      );
    }
  } catch (error) {
    next(error);
  }
};
