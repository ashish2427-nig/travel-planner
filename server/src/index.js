import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import app from './app.js';
import User from './models/User.js';
import Session from './models/Session.js';

if (!process.env.MONGO_URI && typeof process.loadEnvFile === 'function') {
  try {
    const envPath = fileURLToPath(new URL('../.env', import.meta.url));
    if (existsSync(envPath)) {
      process.loadEnvFile(envPath);
    }
  } catch (err) {
    console.warn('Server: failed to load .env file:', err.message);
  }
}

if (!process.env.MONGO_URI) throw new Error('Set MONGO_URI in server/.env before starting.');
await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
await Promise.all([User.init(), Session.init()]);
const server = app.listen(Number(process.env.PORT || 3001), process.env.HOST || '127.0.0.1', () => console.log(`Travel Trip Planner API listening on port ${process.env.PORT || 3001}`));
async function shutdown() { server.close(async () => { await mongoose.disconnect(); process.exit(0); }); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
