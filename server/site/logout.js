import { buildLogoutCookie } from './_auth.js';

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  response.setHeader('Set-Cookie', buildLogoutCookie(request));
  return response.status(200).json({ ok: true });
}
