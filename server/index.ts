import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

interface RoomUser {
  id: string;
  socketId: string;
  name: string;
  isMuted: boolean;
  isDeafened: boolean;
}

const rooms = new Map<string, RoomUser[]>();

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

io.on('connection', (socket) => {
  console.log(`[Socket] Connected: ${socket.id}`);

  // Strategy collaboration room
  socket.on('join-room', ({ roomCode, userName }: { roomCode: string; userName: string }) => {
    socket.join(roomCode);
    const roomUsers = rooms.get(roomCode) || [];
    const existingIndex = roomUsers.findIndex((u) => u.socketId === socket.id);
    const user: RoomUser = {
      id: socket.id,
      socketId: socket.id,
      name: userName || `Player-${socket.id.slice(0, 4)}`,
      isMuted: false,
      isDeafened: false,
    };

    if (existingIndex >= 0) {
      roomUsers[existingIndex] = user;
    } else {
      roomUsers.push(user);
    }
    rooms.set(roomCode, roomUsers);

    io.to(roomCode).emit('room-users', roomUsers);
    console.log(`[Socket] ${userName} joined room ${roomCode}`);
  });

  socket.on('strategy-update', ({ roomCode, strategyData }) => {
    socket.to(roomCode).emit('strategy-remote-update', strategyData);
  });

  // WebRTC Voice Chat Signaling
  socket.on('voice-join', ({ roomCode, userName }: { roomCode: string; userName: string }) => {
    socket.join(`voice-${roomCode}`);
    const roomKey = `voice-${roomCode}`;
    const roomUsers = rooms.get(roomKey) || [];
    const user: RoomUser = {
      id: socket.id,
      socketId: socket.id,
      name: userName || `Peer-${socket.id.slice(0, 4)}`,
      isMuted: false,
      isDeafened: false,
    };

    const existingPeers = roomUsers.map((u) => ({ id: u.socketId, name: u.name }));
    roomUsers.push(user);
    rooms.set(roomKey, roomUsers);

    // Notify joining user of existing peers
    socket.emit('voice-all-users', existingPeers);
    // Notify existing peers of new user
    socket.to(`voice-${roomCode}`).emit('voice-user-joined', { id: socket.id, name: user.name });
    console.log(`[Voice] ${userName} joined voice room voice-${roomCode}`);
  });

  socket.on('voice-signal', ({ to, signal, fromName }: { to: string; signal: unknown; fromName?: string }) => {
    io.to(to).emit('voice-signal', { from: socket.id, signal, fromName });
  });

  socket.on('voice-mute-toggle', ({ roomCode, isMuted }: { roomCode: string; isMuted: boolean }) => {
    const roomKey = `voice-${roomCode}`;
    const roomUsers = rooms.get(roomKey) || [];
    const user = roomUsers.find((u) => u.socketId === socket.id);
    if (user) {
      user.isMuted = isMuted;
      socket.to(roomKey).emit('voice-user-muted', { id: socket.id, isMuted });
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] Disconnected: ${socket.id}`);
    // Clean up rooms
    rooms.forEach((users, roomKey) => {
      const updatedUsers = users.filter((u) => u.socketId !== socket.id);
      if (updatedUsers.length > 0) {
        rooms.set(roomKey, updatedUsers);
        if (roomKey.startsWith('voice-')) {
          io.to(roomKey).emit('voice-user-left', { id: socket.id });
        } else {
          io.to(roomKey).emit('room-users', updatedUsers);
        }
      } else {
        rooms.delete(roomKey);
      }
    });
  });
});

const PORT = Number(process.env.PORT) || 3001;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`[DynastyX Server] Tactical Hub Server running on http://0.0.0.0:${PORT}`);
});
