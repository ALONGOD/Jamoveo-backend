import { Server, Socket } from 'socket.io';
import jwtAuthService from '../services/jwtAuthService';
import sessionService from '../services/sessionService';
import { JwtPayload, Song } from '../types';

interface AuthedSocket extends Socket {
  data: { user: JwtPayload };
}

/**
 * Wire the rehearsal namespace.
 * Single global room — every authenticated user joins automatically on connect.
 */
export const initRehearsalSocket = (io: Server): void => {
  // Auth handshake: client must send { auth: { token } } when connecting
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error('UNAUTHENTICATED'));

    try {
      const payload = jwtAuthService.verifyToken(token);
      (socket as AuthedSocket).data.user = payload;
      next();
    } catch {
      next(new Error('INVALID_TOKEN'));
    }
  });

  /**
   * Build & broadcast the current presence list to everyone in the rehearsal.
   *
   * We don't keep our own presence store — Socket.IO already tracks every live
   * connection, so `io.fetchSockets()` IS the source of truth. We just dedupe
   * by userId (so the same person on phone + laptop counts once) and exclude
   * the disconnecting socket (it can briefly linger inside its own
   * `disconnect` handler).
   */
  const broadcastPresence = async (excludeSocketId?: string): Promise<void> => {
    const sockets = await io.fetchSockets();
    const seen = new Set<string>();
    const users: JwtPayload[] = [];
    for (const s of sockets) {
      if (s.id === excludeSocketId) continue;
      const u = (s.data as { user?: JwtPayload }).user;
      if (!u || seen.has(u.userId)) continue;
      seen.add(u.userId);
      users.push(u);
    }
    io.emit('presence:list', { users });
  };

  io.on('connection', (rawSocket) => {
    const socket = rawSocket as AuthedSocket;
    const { user } = socket.data;

    // Send the current state on connect so late joiners can sync straight to the live page
    socket.emit('session:state', { currentSong: sessionService.getCurrentSong() });

    // Tell everyone (including the new joiner) about the updated room
    void broadcastPresence();

    socket.on('song:select', (song: Song) => {
      if (user.role !== 'admin') {
        socket.emit('error:unauthorized', { message: 'Only admins can select songs' });
        return;
      }
      sessionService.setCurrentSong(song);
      io.emit('song:current', { song });
    });

    socket.on('session:quit', () => {
      if (user.role !== 'admin') {
        socket.emit('error:unauthorized', { message: 'Only admins can quit the session' });
        return;
      }
      sessionService.clear();
      io.emit('session:cleared');
    });

    socket.on('disconnect', () => {
      void broadcastPresence(socket.id);
    });
  });
};
