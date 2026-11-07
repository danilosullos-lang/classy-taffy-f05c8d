import { neon } from '@neondatabase/serverless';
let client;
export function db() {
  if (!process.env.DATABASE_URL) {
    const error = new Error('database_not_configured'); error.status = 503; throw error;
  }
  if (!client) client = neon(process.env.DATABASE_URL);
  return client;
}
