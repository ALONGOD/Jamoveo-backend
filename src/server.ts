import { env } from './config/env';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import mongoose from 'mongoose';
import { Server as SocketIOServer } from 'socket.io';
import routes from './routes';
import { initRehearsalSocket } from './sockets/rehearsalSocket';

const app = express();
const httpServer = createServer(app);

// CORS – allow the frontend dev URL and any explicit FRONTEND_URL (production)
app.use(
  cors({
    origin: [env.frontendUrl, 'http://localhost:3000'],
    credentials: true,
  })
);
app.use(express.json({ limit: '2mb' }));

app.get('/', (_req, res) => {
  res.json({ success: true, message: 'JaMoveo API', timestamp: new Date().toISOString() });
});

app.use('/api/v1', routes);

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: [env.frontendUrl, 'http://localhost:3000'],
    credentials: true,
  },
});

initRehearsalSocket(io);

mongoose
  .connect(env.mongodbUri, { dbName: 'jamoveo' })
  .then(() => {
    console.log(`[db] connected to MongoDB db=jamoveo`);
    httpServer.listen(env.port, () => {
      console.log(`[server] listening on http://localhost:${env.port}`);
      console.log(`[server] env=${env.nodeEnv} frontend=${env.frontendUrl}`);
    });
  })
  .catch((err) => {
    console.error('[db] failed to connect:', err);
    process.exit(1);
  });

const shutdown = async (signal: string) => {
  console.log(`[server] ${signal} received, shutting down`);
  httpServer.close(() => {
    mongoose.connection.close().catch(() => {});
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
