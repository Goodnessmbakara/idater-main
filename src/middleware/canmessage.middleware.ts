import { Request, Response, NextFunction } from 'express';
import { UserRepository } from '../repositories/user.repository';

const userRepository = new UserRepository();

export const canMessageMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const senderId = req.user.userId;
    const receiverId = req.params.userId; // From route parameter

    // Don't allow messaging yourself
    if (senderId === receiverId) {
      return res.sendError('Cannot message yourself', 400);
    }

    // Get both users' details
    const [sender, receiver] = await Promise.all([
      userRepository.getUserDetails(senderId),
      userRepository.getUserDetails(receiverId)
    ]);

    const receiverIsAdmin = receiver.role === 'admin';
    const senderIsAdmin = sender.role === 'admin';

    if (receiverIsAdmin || senderIsAdmin) {
      return next();
    }

    const isMatched = sender.matches.some(
      matchId => matchId.toString() === receiverId
    ) && receiver.matches.some(
      matchId => matchId.toString() === senderId
    );

    if (!isMatched) {
      return res.sendError('Cannot message this user - No match found', 403);
    }

    next();
  } catch (error) {
    
    res.sendError('Error checking message permissions', 500);
  }
};
