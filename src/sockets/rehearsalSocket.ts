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

  io.on('connection', (rawSocket) => {
    const socket = rawSocket as AuthedSocket;
    const { user } = socket.data;

    // Send the current state on connect so late joiners can sync straight to the live page
    socket.emit('session:state', { currentSong: sessionService.getCurrentSong() });

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
  });
};
