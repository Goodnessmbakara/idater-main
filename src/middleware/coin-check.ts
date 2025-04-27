import { Request, Response, NextFunction } from 'express';
import { UserRepository } from '../repositories/user.repository';
import { config } from '../config';
import { ChatRepository } from '../repositories/chat.repository';

const COINS_PER_MESSAGE = config.coins.perMessage;
const userRepository = new UserRepository();
const chatRepository = new ChatRepository();

// export const checkCoinsMiddleware = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ) => {
//   try {
//     const userId = req.user.userId;
//     const chatId = req.params.chatId;

//     const [sender, chat] = await Promise.all([
//       userRepository.getUserDetails(userId),
//       chatRepository.getChatById(chatId)
//     ]);

//     // If sender is admin, no coins needed
//     if (sender.role === 'admin') {
//       return next();
//     }

//     // If recipient is admin, no coins needed
//     const recipient = await userRepository.getUserDetails(
//       chat?.participants.find(p => p.toString() !== userId)?.toString() || ''
//     );
//     if (recipient && recipient.role === 'admin') {
//       return next();
//     }

//     // Regular user-to-user message requires coins
//     if (sender.coins < COINS_PER_MESSAGE) {
//       return res.sendError('Insufficient coins to send message', 402);
//     }

//     req.coinsRequired = COINS_PER_MESSAGE;
//     next();
//   } catch (error) {
//     res.sendError('Error checking coins', 500);
//   }
// };

export const checkCoinsMiddleware = async (req, res, next) => {

  return next();
}