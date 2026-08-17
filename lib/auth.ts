import crypto from 'node:crypto';

export const SESSION_COOKIE = 'admin_session';
export const SESSION_MAX_AGE = 60 * 60 * 8; // 8 hours

export interface AdminCredentials {
  email: string;
  password: string;
}

export function getAdminCredentials(): AdminCredentials {
  return {
    email: process.env.ADMIN_EMAIL || 'admin@chitfund.com',
    password: process.env.ADMIN_PASSWORD || 'admin@123',
  };
}

function getSecret(): string {
  return (
    process.env.ADMIN_SESSION_SECRET ||
    'dev-only-chit-dashboard-session-secret-change-me'
  );
}

export function createSessionToken(email: string): string {
  const payload = {
    email,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
  };
  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', getSecret())
    .update(payloadBase64)
    .digest('base64url');

  return `${payloadBase64}.${signature}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;

  const [payloadBase64, signature] = token.split('.');
  if (!payloadBase64 || !signature) return false;

  const expectedSignature = crypto
    .createHmac('sha256', getSecret())
    .update(payloadBase64)
    .digest('base64url');

  const received = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (received.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(received, expected)) return false;

  try {
    const payload = JSON.parse(
      Buffer.from(payloadBase64, 'base64url').toString('utf-8')
    ) as { exp?: number };
    if (typeof payload.exp !== 'number') return false;
    return payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}
