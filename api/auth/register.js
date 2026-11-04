import { db } from '../_lib/db.js';
import { fail, methodOnly, readJson, send } from '../_lib/http.js';
import { hashPassword, issueToken } from '../_lib/auth.js';
export default async function handler(req, res) {
  if (!methodOnly(req, res, ['POST'])) return;
  try {
    const body = await readJson(req, 8192);
    const email = String(body.email || '').trim().toLowerCase();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      const error = new Error('invalid_email'); error.status = 400; throw error;
    }
    const passwordHash = await hashPassword(body.password);
    const sql = db();
    const rows = await sql`INSERT INTO aetheria_users (email, password_hash)
      VALUES (${email}, ${passwordHash}) ON CONFLICT DO NOTHING RETURNING id, email`;
    if (!rows.length) { const error = new Error('email_already_registered'); error.status = 409; throw error; }
    send(res, 201, { token: issueToken(rows[0].id), user: { id: rows[0].id, email: rows[0].email } });
  } catch (error) { fail(res, error); }
}
