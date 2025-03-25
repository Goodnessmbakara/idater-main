import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { ChatRepository } from '../repositories/chat.repository';
import { UserRepository } from '../repositories/user.repository';
import { checkCoinsMiddleware } from '../middleware/coin-check';
import { config } from '../config';

const COINS_PER_MESSAGE = config.coins.perMessage;

const chatRouter = Router();
const chatRepository = new ChatRepository();
const userRepository = new UserRepository();

/**
 * @swagger
 * /chat:
 *   get:
 *     summary: Get user's chats
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user's chats retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   participants:
 *                     type: array
 *                     items:
 *                       type: object
 *                   lastMessage:
 *                     type: object
 *                   createdAt:
 *                     type: string
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Server error while fetching chats
 */
chatRouter.get('/', authMiddleware, async (req, res) => {
  try {
    const chats = await chatRepository.getUserChats(req.user.userId);
    res.sendSuccess(chats);
  } catch (error) {
    res.sendError('Error fetching chats', 500);
  }
});

/**
 * @swagger
 * /chat/admin:
 *   post:
 *     summary: Create chat with admin
 *     description: Create a new chat with an admin user
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the user to chat with
 *     responses:
 *       200:
 *         description: Chat created successfully with admin
 *       403:
 *         description: Cannot message this user - No match found
 *       500:
 *         description: Internal server error
 */
chatRouter.post('/admin', 
  authMiddleware, 
  async (req, res) => {
    try {
      const chat = await chatRepository.createChatWithAdmin([
        req.user.userId,
      ]);
      res.sendSuccess(chat);
    } catch (error) {
      res.sendError('Error creating chat with admin', 500);
    }
});

/**
 * @swagger
 * /chat/createOrRetrieve/:userId:
 *   post:
 *     summary: Create or get chat with user
 *     description: Create a new chat or get existing chat with a matched user
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the user to chat with
 *     responses:
 *       200:
 *         description: Chat created/retrieved successfully
 *       403:
 *         description: Cannot message this user - No match found
 *       500:
 *         description: Internal server error
 */
chatRouter.post('/createOrRetrieve/:userId', 
  authMiddleware, 
  // canMessageMiddleware, 
  async (req, res) => {
    try {
      const chat = await chatRepository.createChat([
        req.user.userId,
        req.params.userId
      ]);
      res.sendSuccess(chat);
    } catch (error) {
      res.sendError('Error creating chat', 500);
    }
});

/**
 * @swagger
 * /chat/getByid/:chatId:
 *   get:
 *     summary: Get chat by ID
 *     description: Retrieve a chat by its ID
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the chat to retrieve
 *     responses:
 *       200:
 *         description: Chat retrieved successfully
 *       404:
 *         description: Chat not found
 *       500:
 *         description: Internal server error
 */
chatRouter.get('/getByid/:chatId', 
  authMiddleware, 
  async (req, res) => {
    try {
      const chat = await chatRepository.getChatById(req.params.chatId);
      if (!chat) {
        return res.sendError('Chat not found', 404);
      }
      res.sendSuccess(chat);
    } catch (error) {
      res.sendError('Error retrieving chat', 500);
    }
});


/**
 * @swagger
 * /chat/{chatId}/messages:
 *   post:
 *     summary: Send a message in a chat
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *     responses:
 *       200:
 *         description: Message sent successfully
 *       403:
 *         description: Cannot send message to this chat
 *       500:
 *         description: Internal server error
 */
chatRouter.post('/:chatId/messages',
  authMiddleware,
  checkCoinsMiddleware,
  async (req, res) => {
    try {
      const { chatId } = req.params;
      const { content, type } = req.body;

      // Verify user is part of this chat
      const chat = await chatRepository.getChatById(chatId);
      if (!chat) {
        return res.sendError('Chat not found', 404);
      }

      const isParticipant = chat.participants.some(
        p => p.toString() === req.user.userId
      );

      if (!isParticipant) {
        return res.sendError('Not authorized to send messages in this chat', 403);
      }

      const message = await chatRepository.sendMessage(chatId, {
        sender: req.user.userId,
        content,
        coinsToDeduct: req.coinsRequired,
        type: type??'text'
      });

      res.sendSuccess(message);
    } catch (error) {
      if (error.message === 'Insufficient coins') {
        return res.sendError('Insufficient coins to send message', 402);
      }
      res.sendError('Error sending message', 500);
    }
});

/**
 * @swagger
 * /chat/message-cost:
 *   get:
 *     summary: Get message cost and user's coin balance
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Message cost and user balance retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 coinsPerMessage:
 *                   type: number
 *                   description: Cost in coins to send a message
 *                 userCoins:
 *                   type: number
 *                   description: User's current coin balance
 *                 canSendMessages:
 *                   type: boolean
 *                   description: Whether user can send messages (has enough coins or is admin)
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Server error while fetching cost info
 */
chatRouter.get('/message-cost',
  authMiddleware,
  async (req, res) => {
    try {
      const user = await userRepository.getUserDetails(req.user.userId);
      res.sendSuccess({
        coinsPerMessage: COINS_PER_MESSAGE,
        userCoins: user.coins,
        canSendMessages: user.role === 'admin' || user.coins >= COINS_PER_MESSAGE
      });
    } catch (error) {
      res.sendError('Error fetching message cost', 500);
    }
});

export default chatRouter; 