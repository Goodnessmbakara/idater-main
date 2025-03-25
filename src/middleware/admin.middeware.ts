import { Request, Response, NextFunction } from 'express';
import { UserRepository } from '../repositories/user.repository';

const userRepository = new UserRepository();

export const adminMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      return res.sendError('Unauthorized - User not authenticated', 401);
    }

    const user = await userRepository.getUserDetails(userId);

    if (!user || user.role !== 'admin') {
      return res.sendError('Forbidden - Admin access required', 403);
    }

    next();
  } catch (error) {
    return res.sendError('Error verifying admin access', 500);
  }
};
