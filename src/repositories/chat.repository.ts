import chatModel, { IChat, IMessage } from '../models/chat.model';
import { SocketService } from '../services/socket.service';
import mongoose from 'mongoose';
import userModel, { IUser } from '../models/user.model';
import { config } from '../config';
import { callmebotAlertAdmin } from '../services/callmebot';
import { MessageQuota } from '../models/messageQuota.model';

export class ChatRepository {
  // async createChat(participants: string[]): Promise<IChat> {
  //   try {
  //     // Check for existing chat first
  //     const existingChat = await chatModel.findOne({
  //       participants: { $all: participants, $size: participants.length }
  //     }).populate({
  //       path: 'participants',
  //       select: '-password'
  //     }).populate('messages');

  //     if (existingChat) {
  //       return existingChat;
  //     }

  //     const chat = await chatModel.create({
  //       participants,
  //       messages: []
  //     });

  //     return await (await chat.populate({
  //       path: 'participants',
  //       select: '-password'
  //     })).populate('messages');
  //   } catch (error) {
  //     throw new Error(`Error creating chat: ${error.message}`);
  //   }
  // }

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
        const today = new Date().toISOString().split('T')[0];

        let quota = await MessageQuota.findOne({ userId, date: today });

        if (!quota) {
          quota = new MessageQuota({ userId, date: today, count: 0 });
        }

        if (quota.count >= 5) {
          throw new Error('Daily message limit reached. Add coins to your account to send more messages.');
        }

        quota.count += 1;
        await quota.save();
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

  // async sendMessage(chatId: string, message: {
  //   sender: string;
  //   content: string;
  //   coinsToDeduct?: number;
  //   type: 'text' | 'image'
  // }): Promise<IMessage> {
  //   try {
  //     const chat = await chatModel.findById(chatId).populate('participants');
  //     if (!chat) {
  //       throw new Error('Chat not found');
  //     }

  //     const isAnyParticipantAdmin = chat.participants.some(participant => (participant as any).role === 'admin');
  //     const cost = message.coinsToDeduct ?? config.coins.perMessage

  //     if (cost && !isAnyParticipantAdmin) {
  //       const user = await userModel.findById(message.sender);
  //       if (!user) {
  //         throw new Error('Sender not found');
  //       }

  //       if (user.role !== 'admin') {
  //         if (user.coins <= 0) {
  //           SocketService.emitToUser(
  //             message.sender.toString(),
  //             'chat:error',
  //             { message: 'You have no coins to send a message.' }
  //           );
  //           throw new Error('User has no coins');
  //         }
  //         user.coins -= message.coinsToDeduct;
  //         await user.save();
  //       }
  //     }

  //     const newMessage = {
  //       sender: new mongoose.Types.ObjectId(message.sender),
  //       content: message.content,
  //       timestamp: new Date(),
  //       type: message.type ?? 'text',
  //       read: false,
  //       id: new mongoose.Types.ObjectId().toString() // Add unique ID for message
  //     };

  //     chat.messages.push(newMessage);
  //     chat.lastMessage = newMessage;
  //     await chat.save();

  //     // Notify other participants
  //     chat.participants
  //       .filter(p => p.toString() !== message.sender)
  //       .forEach(participantId => {
  //         SocketService.emitToUser(
  //           participantId.toString(),
  //           'chat:message',
  //           { chatId, message: newMessage }
  //         );
  //       });

  //     isAnyParticipantAdmin && callmebotAlertAdmin(message.content);

  //     return newMessage;
  //   } catch (error) {
  //     throw new Error(`Error sending message: ${error.message}`);
  //   }
  // }

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

      // Check message quota for non-admin users
      if (user.role !== 'admin') {
        // Get today's date in YYYY-MM-DD format for quota tracking
        const today = new Date().toISOString().split('T')[0];

        // Find or create today's quota record
        let quota = await MessageQuota.findOne({
          userId: message.sender,
          date: today
        });

        if (!quota) {
          quota = new MessageQuota({
            userId: message.sender,
            date: today,
            count: 0
          });
        }

        // If user has no coins and already sent 5 messages today, reject
        if (!user.isPremium && quota.count >= 5) {
          SocketService.emitToUser(
            message.sender.toString(),
            'chat:error',
            { message: 'Daily message limit reached. Add coins to your account to send more messages.' }
          );
          throw new Error('Daily message limit reached');
        }

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