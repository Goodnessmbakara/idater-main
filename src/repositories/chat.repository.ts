import chatModel, { IChat, IMessage } from '../models/chat.model';
import { SocketService } from '../services/socket.service';
import mongoose, { ClientSession } from 'mongoose';
import userModel, { IUser } from '../models/user.model';
// import { config } from '../config';
import { callmebotAlertAdmin } from '../services/callmebot';
import { MessageQuota } from '../models/messageQuota.model';
// import { logger } from '../utils/logger'; // Assuming a logger utility exists

const QUOTA_COUNT = 7;

export class ChatRepository {
    // async createChat(participants: string[]): Promise<IChat> {
    //   try {
    //     // Check for existing chat first with improved validation
    //     const validParticipants = participants.filter(id => mongoose.Types.ObjectId.isValid(id));
    //     if (validParticipants.length !== participants.length) {
    //       throw new Error('Invalid participant ID format');
    //     }
    //     
    //     const existingChat = await chatModel.findOne({
    //       participants: { $all: validParticipants, $size: validParticipants.length }
    //     }).populate({
    //       path: 'participants',
    //       select: '-password'
    //     }).populate('messages');
    //
    //     if (existingChat) {
    //       return existingChat;
    //     }
    //
    //     // Check user quotas and permissions before creating chat
    //     await this.checkUserMessageQuota(validParticipants[0]);
    //
    //     const chat = await chatModel.create({
    //       participants: validParticipants,
    //       messages: []
    //     });
    //
    //     return await (await chat.populate({
    //       path: 'participants',
    //       select: '-password'
    //     })).populate('messages');
    //   } catch (error) {
    //     logger.error(`Error creating chat: ${error.message}`, { participants });
    //     throw new Error(`Error creating chat: ${error.message}`);
    //   }
    // }

    /**
     * Creates a new chat between participants or returns existing one
     * @param participants Array of valid user IDs
     * @returns Promise resolving to chat document
     */
    async createChat(participants: string[]): Promise<IChat> {
        // Validate all participant IDs first
        if (!participants || !participants.length) {
            throw new Error('Participants list cannot be empty');
        }

        const validParticipants = participants.filter(id => mongoose.Types.ObjectId.isValid(id));
        if (validParticipants.length !== participants.length) {
            throw new Error('Invalid participant ID format');
        }

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // Check for existing chat first
            const existingChat = await chatModel.findOne({
                participants: { $all: validParticipants, $size: validParticipants.length }
            })
                .populate({
                    path: 'participants',
                    select: '-password'
                })
                .populate('messages')
                .session(session);

            if (existingChat) {
                await session.commitTransaction();
                session.endSession();
                return existingChat;
            }

            // Get the initiating user
            const userId = validParticipants[0];
            const user = await userModel.findById(userId).session(session);

            if (!user) {
                throw new Error('User not found');
            }

            // Check quota for free users
            const isPremium = user.isPremium || user.role === 'admin';
            if (!isPremium) {
                await this.checkUserMessageQuota(userId, session);
            }

            // Create the chat
            const chat = await chatModel.create([{
                participants: validParticipants,
                messages: []
            }], { session });

            const populatedChat = await chatModel.findById(chat[0]._id)
                .populate({
                    path: 'participants',
                    select: '-password'
                })
                .populate('messages')
                .session(session);

            await session.commitTransaction();
            session.endSession();

            return populatedChat;
        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            //   logger.error(`Error creating chat: ${error.message}`, { participants });
            throw new Error(`Error creating chat: ${error.message}`);
        }
    }

    /**
     * Creates a chat that includes an admin user
     * @param participants Array of user IDs
     * @returns Promise resolving to chat document
     */
    async createChatWithAdmin(participants: string[]): Promise<IChat> {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // Validate all participant IDs first
            const validParticipants = participants.filter(id => mongoose.Types.ObjectId.isValid(id));
            if (validParticipants.length !== participants.length) {
                throw new Error('Invalid participant ID format');
            }

            const adminUser = await userModel.findOne({ role: 'admin' })
                .select('-password')
                .session(session);

            if (!adminUser) {
                throw new Error('Admin user not found');
            }

            const adminId = adminUser._id;

            // Check for existing chat with admin
            const existingChat = await chatModel.findOne({
                participants: {
                    $all: [...validParticipants, adminId],
                    $size: validParticipants.length + 1
                }
            })
                .populate({
                    path: 'participants',
                    select: '-password'
                })
                .populate('messages')
                .session(session);

            if (existingChat) {
                await session.commitTransaction();
                session.endSession();
                return existingChat;
            }

            // Check quota for initiating user if not premium
            const userId = validParticipants[0];
            const user = await userModel.findById(userId).session(session);

            if (!user) {
                throw new Error('User not found');
            }

            const isPremium = user.isPremium || user.role === 'admin';
            if (!isPremium) {
                await this.checkUserMessageQuota(userId, session);
            }

            const chat = await chatModel.create([{
                participants: [...validParticipants, adminId],
                messages: []
            }], { session });

            const populatedChat = await chatModel.findById(chat[0]._id)
                .populate({
                    path: 'participants',
                    select: '-password'
                })
                .populate('messages')
                .session(session);

            await session.commitTransaction();
            session.endSession();

            return populatedChat;
        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            //   logger.error(`Error creating chat with admin: ${error.message}`, { participants });
            throw new Error(`Error creating chat with admin: ${error.message}`);
        }
    }

    // async sendMessage(chatId: string, message: {
    //   sender: string;
    //   content: string;
    //   coinsToDeduct?: number;
    //   type: 'text' | 'image'
    // }): Promise<IMessage> {
    //   try {
    //     if (!mongoose.Types.ObjectId.isValid(chatId) || !mongoose.Types.ObjectId.isValid(message.sender)) {
    //       throw new Error('Invalid ID format');
    //     }
    //
    //     if (!message.content || message.content.trim() === '') {
    //       throw new Error('Message content cannot be empty');
    //     }
    //
    //     const session = await mongoose.startSession();
    //     session.startTransaction();
    //
    //     const chat = await chatModel.findById(chatId)
    //       .populate('participants')
    //       .session(session);
    //
    //     if (!chat) {
    //       throw new Error('Chat not found');
    //     }
    //
    //     // Verify sender is part of this chat
    //     if (!chat.participants.some(p => p._id.toString() === message.sender)) {
    //       throw new Error('Sender is not a participant in this chat');
    //     }
    //
    //     const isAnyParticipantAdmin = chat.participants.some(participant => (participant as any).role === 'admin');
    //     const cost = message.coinsToDeduct ?? config.coins.perMessage;
    //
    //     const user = await userModel.findById(message.sender).session(session);
    //     if (!user) {
    //       throw new Error('Sender not found');
    //     }
    //
    //     // Handle coin deduction for non-admin users
    //     if (cost && user.role !== 'admin' && !isAnyParticipantAdmin) {
    //       if (user.coins < cost) {
    //         SocketService.emitToUser(
    //           message.sender.toString(),
    //           'chat:error',
    //           { message: 'You have insufficient coins to send a message.' }
    //         );
    //         throw new Error('User has insufficient coins');
    //       }
    //       user.coins -= cost;
    //       await user.save({ session });
    //     } else if (!user.isPremium && user.role !== 'admin') {
    //       // Check quota for free users
    //       await this.checkUserMessageQuota(message.sender, session);
    //     }
    //
    //     const newMessage = {
    //       sender: new mongoose.Types.ObjectId(message.sender),
    //       content: message.content.trim(),
    //       timestamp: new Date(),
    //       type: message.type ?? 'text',
    //       read: false,
    //       id: new mongoose.Types.ObjectId().toString()
    //     };
    //
    //     chat.messages.push(newMessage);
    //     chat.lastMessage = newMessage;
    //     await chat.save({ session });
    //
    //     await session.commitTransaction();
    //     session.endSession();
    //
    //     // Notify other participants
    //     chat.participants
    //       .filter(p => p._id.toString() !== message.sender)
    //       .forEach(participantId => {
    //         try {
    //           SocketService.emitToUser(
    //             participantId._id.toString(),
    //             'chat:message',
    //             { chatId, message: newMessage }
    //           );
    //         } catch (socketError) {
    //           logger.error(`Socket notification error: ${socketError.message}`);
    //           // Continue execution even if socket notification fails
    //         }
    //       });
    //
    //     if (isAnyParticipantAdmin) {
    //       try {
    //         await callmebotAlertAdmin(message.content);
    //       } catch (alertError) {
    //         logger.error(`Admin alert error: ${alertError.message}`);
    //         // Continue execution even if admin alert fails
    //       }
    //     }
    //
    //     return newMessage;
    //   } catch (error) {
    //     logger.error(`Error sending message: ${error.message}`, { chatId, sender: message.sender });
    //     throw new Error(`Error sending message: ${error.message}`);
    //   }
    // }

    /**
     * Sends a message in a chat
     * @param chatId ID of the chat
     * @param message Message object containing sender, content and type
     * @returns Promise resolving to the sent message
     */
    async sendMessage(chatId: string, message: {
        sender: string;
        content: string;
        coinsToDeduct?: number;
        type: 'text' | 'image'
    }): Promise<IMessage> {
        // Validate inputs
        if (!mongoose.Types.ObjectId.isValid(chatId) || !mongoose.Types.ObjectId.isValid(message.sender)) {
            throw new Error('Invalid ID format');
        }

        if (!message.content || message.content.trim() === '') {
            throw new Error('Message content cannot be empty');
        }

        if (message.type !== 'text' && message.type !== 'image') {
            throw new Error('Invalid message type');
        }

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const chat = await chatModel.findById(chatId)
                .populate('participants')
                .session(session);

            if (!chat) {
                throw new Error('Chat not found');
            }

            // Verify sender is part of this chat
            if (!chat.participants.some(p => p._id.toString() === message.sender)) {
                throw new Error('Sender is not a participant in this chat');
            }

            // Get sender user
            const user = await userModel.findById(message.sender).session(session);
            if (!user) {
                throw new Error('Sender not found');
            }

            const isAnyParticipantAdmin = chat.participants.some(
                participant => (participant as any).role === 'admin'
            );

            // Handle permissions and quotas
            if (user.role !== 'admin' && !user.isPremium) {
                // Check quota for free users
                await this.checkUserMessageQuota(message.sender, session);
            }

            // Create new message
            const newMessage = {
                sender: new mongoose.Types.ObjectId(message.sender),
                content: message.content.trim(),
                timestamp: new Date(),
                type: message.type,
                read: false,
                id: new mongoose.Types.ObjectId().toString()
            };

            // Update chat with new message
            chat.messages.push(newMessage);
            chat.lastMessage = newMessage;
            chat.updatedAt = new Date(); // Ensure updatedAt gets refreshed
            await chat.save({ session });

            await session.commitTransaction();
            session.endSession();

            // Notify other participants
            this.notifyParticipants(chat, message.sender, chatId, newMessage);

            // Alert admin if needed
            if (isAnyParticipantAdmin) {
                try {
                    await callmebotAlertAdmin(message.content);
                } catch (alertError) {
                    //   logger.error(`Admin alert error: ${alertError.message}`);
                    // We continue execution even if the alert fails
                }
            }

            return newMessage;
        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            //   logger.error(`Error sending message: ${error.message}`, { chatId, sender: message.sender });
            throw new Error(`Error sending message: ${error.message}`);
        }
    }

    /**
     * Marks all messages in a chat as read for a user
     * @param chatId ID of the chat
     * @param userId ID of the user marking messages as read
     */
    async markMessagesAsRead(chatId: string, userId: string): Promise<void> {
        // Validate inputs
        if (!mongoose.Types.ObjectId.isValid(chatId) || !mongoose.Types.ObjectId.isValid(userId)) {
            throw new Error('Invalid ID format');
        }

        try {
            const chat = await chatModel.findById(chatId);
            if (!chat) {
                throw new Error('Chat not found');
            }

            // Check if user is part of this chat
            if (!chat.participants.some(p => p.toString() === userId)) {
                throw new Error('User is not a participant in this chat');
            }

            let hasChanges = false;
            const updatedMessages = chat.messages.map(msg => {
                if (msg.sender.toString() !== userId && !msg.read) {
                    msg.read = true;
                    hasChanges = true;
                }
                return msg;
            });

            // Only save if there were actual changes
            if (hasChanges) {
                chat.messages = updatedMessages;
                await chat.save();

                // Notify other participants about read status
                this.notifyReadStatus(chat, userId, chatId);
            }
        } catch (error) {
            //   logger.error(`Error marking messages as read: ${error.message}`, { chatId, userId });
            throw new Error(`Error marking messages as read: ${error.message}`);
        }
    }

    /**
     * Gets all chats for a user
     * @param userId ID of the user
     * @returns Promise resolving to array of chats
     */
    async getUserChats(userId: string): Promise<IChat[]> {
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            throw new Error('Invalid user ID format');
        }

        try {
            return await chatModel
                .find({ participants: userId })
                .populate({
                    path: 'participants',
                    select: 'firstName lastName profileImage role coins isOnline'
                })
                .populate({
                    path: 'messages',
                    options: { sort: { timestamp: 1 } } // Ensure messages are chronologically ordered
                })
                .sort({ updatedAt: -1 });
        } catch (error) {
            //   logger.error(`Error fetching user chats: ${error.message}`, { userId });
            throw new Error(`Error fetching user chats: ${error.message}`);
        }
    }

    /**
     * Gets a specific chat by ID
     * @param chatId ID of the chat
     * @returns Promise resolving to chat document or null
     */
    async getChatById(chatId: string): Promise<IChat | null> {
        if (!mongoose.Types.ObjectId.isValid(chatId)) {
            throw new Error('Invalid chat ID format');
        }

        try {
            return await chatModel.findById(chatId)
                .populate({
                    path: 'participants',
                    select: 'firstName lastName profileImage role coins isOnline'
                })
                .populate({
                    path: 'messages',
                    options: { sort: { timestamp: 1 } }
                });
        } catch (error) {
            //   logger.error(`Error fetching chat by ID: ${error.message}`, { chatId });
            throw new Error(`Error fetching chat by ID: ${error.message}`);
        }
    }

    /**
     * Helper method to check if a user has exceeded their message quota
     * @param userId ID of the user
     * @param session Optional mongoose session for transactions
     */
    private async checkUserMessageQuota(userId: string, session?: ClientSession): Promise<void> {
        const today = new Date().toISOString().split('T')[0];

        let quota = await MessageQuota.findOne({
            userId,
            date: today
        }).session(session);

        if (!quota) {
            quota = new MessageQuota({
                userId,
                date: today,
                count: 0
            });
        }

        if (quota.count >= QUOTA_COUNT) {
            SocketService.emitToUser(
                userId,
                'chat:error',
                { message: 'Daily message limit reached. Add coins to your account to send more messages.' }
            );
            throw new Error('Daily message limit reached');
        }

        quota.count += 1;
        await quota.save({ session });
    }

    /**
     * Helper method to notify chat participants of a new message
     */
    private notifyParticipants(
        chat: IChat,
        senderId: string,
        chatId: string,
        message: IMessage
    ): void {
        chat.participants
            .filter(p => p._id.toString() !== senderId)
            .forEach(participantId => {
                try {
                    SocketService.emitToUser(
                        participantId._id.toString(),
                        'chat:message',
                        { chatId, message }
                    );
                } catch (socketError) {
                    //   logger.error(`Socket notification error: ${socketError.message}`);
                    // Continue execution even if socket notification fails
                }
            });
    }

    /**
     * Helper method to notify participants that messages have been read
     */
    private notifyReadStatus(chat: IChat, userId: string, chatId: string): void {
        chat.participants
            .filter(p => p.toString() !== userId)
            .forEach(participantId => {
                try {
                    SocketService.emitToUser(
                        participantId.toString(),
                        'chat:read',
                        { chatId, userId }
                    );
                } catch (socketError) {
                    //   logger.error(`Socket notification error: ${socketError.message}`);
                    // Continue execution even if socket notification fails
                }
            });
    }
}