export function send(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}
export function methodOnly(req, res, allowed) {
  if (allowed.includes(req.method)) return true;
  res.setHeader('Allow', allowed.join(', '));
  send(res, 405, { error: 'method_not_allowed' });
  return false;
}
export async function readJson(req, maxBytes = 32768) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = '';
  for await (const chunk of req) {
    raw += chunk.toString();
    if (Buffer.byteLength(raw, 'utf8') > maxBytes) {
      const error = new Error('payload_too_large'); error.status = 413; throw error;
    }
  }
  try { return raw ? JSON.parse(raw) : {}; }
  catch { const error = new Error('invalid_json'); error.status = 400; throw error; }
}
export function fail(res, error) {
  const status = Number.isInteger(error?.status) ? error.status : 500;
  if (status >= 500) console.error('[Aetheria API]', error);
  send(res, status, { error: status >= 500 ? 'internal_error' : error.message });
}
