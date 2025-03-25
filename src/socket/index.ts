import { Server as SocketIOServer, Socket } from 'socket.io';
import { ChatRepository } from '../repositories/chat.repository';
import { UserRepository } from '../repositories/user.repository';
import { verifyToken } from '../utils/jwt';
import { config } from '../config';

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

interface ChatEvents {
  'chat:join': (chatId: string) => void;
  'chat:message': (data: { chatId: string; content: string }) => void;
  'chat:typing': (data: { chatId: string; isTyping: boolean }) => void;
  'chat:read': (chatId: string) => void;
}

export const initializeSocket = (io: SocketIOServer) => {
  const chatRepository = new ChatRepository();
  const userRepository = new UserRepository();
  const typingUsers = new Map<string, Set<string>>();
  const onlineUsers = new Set<string>();

  // Middleware to authenticate socket connections
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization;
      
      if (!token) {
        return next(new Error('Authentication error'));
      }

      const decoded = await verifyToken(token.replace('Bearer ', ''));
      socket.userId = decoded.userId;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  // Handle socket connections
  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`User connected: ${socket.userId}`);

    // Update online status
    onlineUsers.add(socket.userId!);
    userRepository.updateOnlineStatus(socket.userId!, true);
    io.emit('user:online', { userId: socket.userId });

    // Join a private room for this user
    socket.join(`user:${socket.userId}`);

    // Handle profile views
    socket.on('profile:view', async (targetUserId: string) => {
      try {
        await userRepository.recordProfileView(targetUserId, socket.userId!);
      } catch (error) {
        socket.emit('error', { message: 'Error recording profile view' });
      }
    });

    // Handle disconnection
    socket.on('disconnect', async () => {
      console.log(`User disconnected: ${socket.userId}`);
      onlineUsers.delete(socket.userId!);
      await userRepository.updateOnlineStatus(socket.userId!, false);
      io.emit('user:offline', { 
        userId: socket.userId,
        lastSeen: new Date()
      });

      // Clean up typing indicators on disconnect
      typingUsers.forEach((users, chatId) => {
        users.delete(socket.userId!);
        if (users.size === 0) {
          typingUsers.delete(chatId);
        }
      });
    });

    // Handle joining chat rooms
    socket.on('chat:join', (chatId: string) => {
      socket.join(`chat:${chatId}`);
    });

    // Handle new messages
    socket.on('chat:message', async (data: { chatId: string; content: string, type: 'image'|'text' }) => {
      try {
        const message = await chatRepository.sendMessage(data.chatId, {
          sender: socket.userId!,
          content: data.content,
          type: data.type??'text',
          coinsToDeduct: config.coins.perMessage
        });

        // Emit to all users in the chat room except sender
        socket.to(`chat:${data.chatId}`).emit('chat:message', {
          chatId: data.chatId,
          message
        });
      } catch (error) {
        console.log(error);
        
        socket.emit('error', { message: error.message });
      }
    });

    // Handle typing indicators
    socket.on('chat:typing', async (data: { chatId: string; isTyping: boolean }) => {
      const { chatId, isTyping } = data;
      
      if (!typingUsers.has(chatId)) {
        typingUsers.set(chatId, new Set());
      }
      
      const chatTypingUsers = typingUsers.get(chatId)!;
      
      if (isTyping) {
        chatTypingUsers.add(socket.userId!);
      } else {
        chatTypingUsers.delete(socket.userId!);
      }

      // Emit typing status to other users in the chat
      socket.to(`chat:${chatId}`).emit('chat:typing', {
        chatId,
        userId: socket.userId,
        typingUsers: Array.from(chatTypingUsers)
      });
    });

    // Handle read receipts
    socket.on('chat:read', async (chatId: string) => {
      try {
        await chatRepository.markMessagesAsRead(chatId, socket.userId!);
        socket.to(`chat:${chatId}`).emit('chat:read', {
          chatId,
          userId: socket.userId
        });
      } catch (error) {
        socket.emit('error', { message: 'Error marking messages as read' });
      }
    });
  });

  // Helper function to emit user status
  const emitUserStatus = (userId: string, status: 'online' | 'offline') => {
    io.emit('user:status', { userId, status });
  };
};

// Export types for use in other files
export interface ServerToClientEvents {
  'user:status': (data: { userId: string; status: 'online' | 'offline' }) => void;
  'notification:match': (data: { matchId: string; userId: string }) => void;
  'notification:like': (data: { userId: string }) => void;
  'user:online': (data: { userId: string }) => void;
  'user:offline': (data: { userId: string; lastSeen: Date }) => void;
  'profile:viewed': (data: { viewerId: string; timestamp: Date }) => void;
}

export interface ClientToServerEvents {
  'user:typing': (data: { chatId: string }) => void;
  'profile:view': (targetUserId: string) => void;
} 