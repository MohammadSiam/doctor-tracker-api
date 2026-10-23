import mongoose from 'mongoose';
import { env, isProduction } from './env.js';

export async function connectDatabase() {
  mongoose.set('strictQuery', true);
  // Building indexes on every boot is convenient locally; in production they are synced once via `pnpm seed`.
  mongoose.set('autoIndex', !isProduction);

  await mongoose.connect(env.MONGODB_URI, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 10_000,
  });
  console.log(`MongoDB connected: ${mongoose.connection.name}`);
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}
