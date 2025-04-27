import chatModel, { IChat, IMessage } from '../models/chat.model';
import { SocketService } from '../services/socket.service';
import mongoose from 'mongoose';
import userModel, { IUser } from '../models/user.model';
import { config } from '../config';
import { callmebotAlertAdmin } from '../services/callmebot';
import { MessageQuota } from '../models/messageQuota.model';

const QUOTA_COUNT = 7; // Your weekly quota limit

// Helper function to get the start of the current week (Monday)
const getStartOfWeek = (date: Date): string => {
    const dayOfWeek = date.getDay(); // Sunday is 0, Monday is 1, ..., Saturday is 6
    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // If Sunday, go back 6 days, otherwise go back dayOfWeek - 1 days
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - diff);
    startOfWeek.setHours(0, 0, 0, 0); // Set time to the beginning of the day
    return startOfWeek.toISOString().split('T')[0]; // Return in YYYY-MM-DD format
};

export class ChatRepository {

    async createChat(participants: string[]): Promise<IChat> {
        try {
            const existingChat = await chatModel.findOne({
                participants: { $all: participants, $size: participants.length }
            }).populate({
                path: 'participants',
                select: '-password'
            }).populate('messages');

            if (existingChat) {
                return existingChat;
            }

            const userId = participants[0];
            const user = await userModel.findById(userId);

            const isPremium = user.isPremium || user.role === 'admin';
            if (!isPremium) {
                // Calculate the start of the current week
                const startOfCurrentWeek = getStartOfWeek(new Date());

                let quota = await MessageQuota.findOne({ userId, date: startOfCurrentWeek }); // Assuming 'date' field stores the week start

                if (!quota) {
                    // Create a new quota document for the current week
                    quota = new MessageQuota({ userId, date: startOfCurrentWeek, count: 0 });
                    await quota.save(); // Save the new quota document immediately
                }

                if (quota.count >= QUOTA_COUNT) {
                    throw new Error('Weekly message limit reached. Add coins to your account to send more messages.');
                }

                // Note: The quota count is incremented only when a message is successfully sent later in this function.
                // This check here prevents chat creation if the limit is already reached.
            }

            // Create the chat
            const chat = await chatModel.create({
                participants,
                messages: []
            });

            return await (await chat.populate({
                path: 'participants',
                select: '-password'
            })).populate('messages');
        } catch (error) {
            throw new Error(`Error creating chat: ${error.message}`);
        }
    }


    async createChatWithAdmin(participants: string[]): Promise<IChat> {
        try {
            const adminUser = await userModel.findOne({ role: 'admin' }).select('-password');
            if (!adminUser) {
                throw new Error('Admin user not found');
            }
            const adminId = adminUser._id;

            // Check for existing chat with admin
            const existingChat = await chatModel.findOne({
                participants: { $all: [...participants, adminId], $size: participants.length + 1 }
            }).populate({
                path: 'participants',
                select: '-password'
            }).populate('messages');

            if (existingChat) {
                return existingChat;
            }

            const chat = await chatModel.create({
                participants: [...participants, adminId],
                messages: []
            });

            return await (await chat.populate({
                path: 'participants',
                select: '-password'
            })).populate('messages');
        } catch (error) {
            throw new Error(`Error creating chat with admin: ${error.message}`);
        }
    }

    async sendMessage(chatId: string, message: {
        sender: string;
        content: string;
        coinsToDeduct?: number;
        type: 'text' | 'image'
    }): Promise<IMessage> {
        try {
            const chat = await chatModel.findById(chatId).populate('participants');
            if (!chat) {
                throw new Error('Chat not found');
            }

            const isAnyParticipantAdmin = chat.participants.some(participant => (participant as any).role === 'admin');
            const cost = message.coinsToDeduct ?? config.coins.perMessage;

            // Get sender user
            const user = await userModel.findById(message.sender);

            if (!user) {
                throw new Error('Sender not found');
            }

            // Check message quota for non-admin, non-premium users
            if (user.role !== 'admin' && user.isPremium === false) {
                // Calculate the start of the current week
                const startOfCurrentWeek = getStartOfWeek(new Date());

                // Find or create this week's quota record
                let quota = await MessageQuota.findOne({
                    userId: message.sender,
                    date: startOfCurrentWeek // Assuming 'date' field stores the week start date
                });

                if (!quota) {
                    // Create a new quota document for the current week if none exists
                    quota = new MessageQuota({
                        userId: message.sender,
                        date: startOfCurrentWeek,
                        count: 0
                    });
                }

                // Check if the weekly limit has been reached
                if (quota.count >= QUOTA_COUNT) {
                    SocketService.emitToUser(
                        message.sender.toString(),
                        'chat:error',
                        { message: 'Weekly message limit reached. Add coins to your account to send more messages.' }
                    );
                    throw new Error('Weekly message limit reached');
                }

                // If user has no coins and message has a cost (and it's not a chat with admin)
                if (cost > 0 && !isAnyParticipantAdmin) {
                    if (user.coins <= 0) {
                        SocketService.emitToUser(
                            message.sender.toString(),
                            'chat:error',
                            { message: 'You have no coins to send a message.' }
                        );
                        throw new Error('User has no coins');
                    }
                    // Deduct coins only if not chatting with an admin
                    user.coins -= cost; // Use the calculated cost
                    await user.save();
                }


                // Increment the weekly quota count
                quota.count += 1;
                await quota.save(); // Save the updated quota count
            } else if (cost > 0 && !isAnyParticipantAdmin) {
                // Handle coin deduction for premium users if needed, assuming premium users still use coins
                if (user.coins <= 0) {
                    SocketService.emitToUser(
                        message.sender.toString(),
                        'chat:error',
                        { message: 'You have no coins to send a message.' }
                    );
                    throw new Error('User has no coins');
                }
                user.coins -= cost; // Use the calculated cost
                await user.save();
            }


            const newMessage = {
                sender: new mongoose.Types.ObjectId(message.sender),
                content: message.content,
                timestamp: new Date(),
                type: message.type ?? 'text',
                read: false,
                id: new mongoose.Types.ObjectId().toString()
            };

            chat.messages.push(newMessage);
            chat.lastMessage = newMessage;
            await chat.save();

            // Notify other participants
            chat.participants
                .filter(p => p.toString() !== message.sender)
                .forEach(participantId => {
                    SocketService.emitToUser(
                        participantId.toString(),
                        'chat:message',
                        { chatId, message: newMessage }
                    );
                });


            isAnyParticipantAdmin && callmebotAlertAdmin(message.content);

            return newMessage;
        } catch (error) {
            console.error('Error sending message:', error); // Log the error for debugging
            // Re-throw the error to be caught by the caller
            throw new Error(`Error sending message: ${error.message}`);
        }
    }

    async markMessagesAsRead(chatId: string, userId: string): Promise<void> {
        try {
            const chat = await chatModel.findById(chatId);
            if (!chat) {
                throw new Error('Chat not found');
            }

            const updatedMessages = chat.messages.map(msg => {
                if (msg.sender.toString() !== userId && !msg.read) {
                    msg.read = true;
                }
                return msg;
            });

            chat.messages = updatedMessages;
            await chat.save();

            // Notify other participants about read status
            chat.participants
                .filter(p => p.toString() !== userId)
                .forEach(participantId => {
                    SocketService.emitToUser(
                        participantId.toString(),
                        'chat:read',
                        { chatId, userId }
                    );
                });
        } catch (error) {
            throw new Error(`Error marking messages as read: ${error.message}`);
        }
    }

    async getUserChats(userId: string): Promise<IChat[]> {
        try {
            return await chatModel
                .find({ participants: userId })
                .populate({
                    path: 'participants',
                    select: 'firstName lastName profileImage role coins isOnline'
                })
                .populate('messages')
                .sort({ updatedAt: -1 });
        } catch (error) {
            throw new Error(`Error fetching user chats: ${error.message}`);
        }
    }

    async getChatById(chatId: string): Promise<IChat | null> {
        try {
            return await chatModel.findById(chatId)
                .populate({
                    path: 'participants',
                    select: 'firstName lastName profileImage role coins isOnline'
                })
                .populate('messages');
        } catch (error) {
            throw new Error(`Error fetching chat by ID: ${error.message}`);
        }
    }
}