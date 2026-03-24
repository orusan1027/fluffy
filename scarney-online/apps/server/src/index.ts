import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/authRoutes.js';
import rankingRoutes from './routes/rankingRoutes.js';
import { createSocketServer, gameRoomManager } from './socket/socketServer.js';
import { prisma } from './db/prisma.js';

const app = express();
const httpServer = http.createServer(app);

// ─── Middleware ────────────────────────────────────────────────────────────

app.use(cors({
  origin: config.CORS_ORIGIN,
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser(config.COOKIE_SECRET));

// ─── REST routes ──────────────────────────────────────────────────────────

app.use('/api/auth', authRoutes);
app.use('/api/rankings', rankingRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Error handler ────────────────────────────────────────────────────────

app.use(errorHandler);

// ─── Socket.IO ────────────────────────────────────────────────────────────

const io = createSocketServer(httpServer);
gameRoomManager.setIO(io);

// ─── Start ────────────────────────────────────────────────────────────────

async function start() {
  try {
    await prisma.$connect();
    console.log('✅ Database connected');
  } catch (e) {
    console.error('❌ Database connection failed:', e);
    process.exit(1);
  }

  httpServer.listen(config.PORT, () => {
    console.log(`🚀 SCARNEY Server running on http://localhost:${config.PORT}`);
    console.log(`   Environment: ${config.NODE_ENV}`);
    console.log(`   CORS origin: ${config.CORS_ORIGIN}`);
  });
}

start();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});
