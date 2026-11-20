import { db } from '../_lib/db.js';
import { fail, methodOnly, readJson, send } from '../_lib/http.js';
import { issueToken, verifyPassword } from '../_lib/auth.js';
export default async function handler(req, res) {
  if (!methodOnly(req, res, ['POST'])) return;
  try {
    const body = await readJson(req, 8192);
    const email = String(body.email || '').trim().toLowerCase();
    const password = body.password;
    if (!email || typeof password !== 'string' || password.length > 128) {
      const error = new Error('invalid_credentials'); error.status = 400; throw error;
    }
    const sql = db();
    const rows = await sql`SELECT id, email, password_hash FROM aetheria_users WHERE LOWER(email) = ${email} LIMIT 1`;
    if (!rows.length || !(await verifyPassword(password, rows[0].password_hash))) {
      const error = new Error('invalid_credentials'); error.status = 401; throw error;
    }
    send(res, 200, { token: issueToken(rows[0].id), user: { id: rows[0].id, email: rows[0].email } });
  } catch (error) { fail(res, error); }
}
