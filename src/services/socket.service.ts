import { Server as SocketIOServer } from 'socket.io';

export class SocketService {
  private static io: SocketIOServer;

  static initialize(io: SocketIOServer) {
    SocketService.io = io;
  }

  static emitToUser(userId: string, event: string, data: any) {
    SocketService.io.to(`user:${userId}`).emit(event, data);
  }

  static emitNotification(userId: string, type: string, data: any) {
    SocketService.io.to(`user:${userId}`).emit(`notification:${type}`, data);
  }

  static emitMatch(userId1: string, userId2: string, matchData: any) {
    SocketService.emitToUser(userId1, 'match:created', matchData);
    SocketService.emitToUser(userId2, 'match:created', matchData);
  }
} 