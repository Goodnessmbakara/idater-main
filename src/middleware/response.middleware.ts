import { Request, Response, NextFunction } from 'express';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
}

declare global {
  namespace Express {
    interface Response {
      sendSuccess<T>(data: T, status?: number): void;
      sendError(error: Error | string, status?: number): void;
    }
  }
}

export const responseMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  res.sendSuccess = function<T>(data: T, status: number = 200) {
    const response: ApiResponse<T> = {
      success: true,
      data,
      timestamp: new Date().toISOString()
    };
    res.status(status).json(response);
  };

  res.sendError = function(error: Error | string, status: number = 500) {
    const response: ApiResponse<null> = {
      success: false,
      error: {
        code: error instanceof Error ? error.name : 'ERROR',
        message: error instanceof Error ? error.message : error,
        details: error instanceof Error ? error : undefined
      },
      timestamp: new Date().toISOString()
    };
    res.status(status).json(response);
  };

  next();
}; 