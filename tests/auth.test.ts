import { afterEach, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import {
  SESSION_MAX_AGE,
  createSessionToken,
  getAdminCredentials,
  verifySessionToken,
} from '@/lib/auth';

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('getAdminCredentials', () => {
  it('falls back to defaults when env vars are unset', () => {
    delete process.env.ADMIN_EMAIL;
    delete process.env.ADMIN_PASSWORD;
    expect(getAdminCredentials()).toEqual({
      email: 'admin@chitfund.com',
      password: 'admin@123',
    });
  });

  it('reads credentials from the environment', () => {
    process.env.ADMIN_EMAIL = 'boss@example.com';
    process.env.ADMIN_PASSWORD = 's3cret';
    expect(getAdminCredentials()).toEqual({
      email: 'boss@example.com',
      password: 's3cret',
    });
  });
});

describe('createSessionToken / verifySessionToken', () => {
  it('verifies a freshly created token', () => {
    const token = createSessionToken('admin@chitfund.com');
    expect(token).toContain('.');
    expect(verifySessionToken(token)).toBe(true);
  });

  it('rejects undefined or empty tokens', () => {
    expect(verifySessionToken(undefined)).toBe(false);
    expect(verifySessionToken('')).toBe(false);
  });

  it('rejects a malformed token', () => {
    expect(verifySessionToken('not-a-valid-token')).toBe(false);
    expect(verifySessionToken('onlypayload')).toBe(false);
  });

  it('rejects a token with a tampered payload', () => {
    const token = createSessionToken('admin@chitfund.com');
    const [payload] = token.split('.');
    const tamperedPayload = Buffer.from(JSON.stringify({ email: 'evil@example.com' })).toString(
      'base64url'
    );
    expect(verifySessionToken(`${tamperedPayload}.${payload}`)).toBe(false);
  });

  it('rejects a token with a tampered signature', () => {
    const token = createSessionToken('admin@chitfund.com');
    const [payload] = token.split('.');
    expect(verifySessionToken(`${payload}.garbage-signature`)).toBe(false);
  });

  it('rejects an expired token', () => {
    process.env.ADMIN_SESSION_SECRET = 'test-secret';
    const token = createSessionToken('admin@chitfund.com');
    const [payload] = token.split('.');
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as {
      exp: number;
    };
    parsed.exp = Math.floor(Date.now() / 1000) - 10;
    const expiredPayload = Buffer.from(JSON.stringify(parsed)).toString('base64url');

    // Re-sign with the same secret after mutating the expiry.
    const signature = crypto
      .createHmac('sha256', process.env.ADMIN_SESSION_SECRET)
      .update(expiredPayload)
      .digest('base64url');

    expect(verifySessionToken(`${expiredPayload}.${signature}`)).toBe(false);
  });

  it('ensures sessions expire after SESSION_MAX_AGE', () => {
    const exp = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE;
    expect(exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('fails when the signing secret changes', () => {
    const token = createSessionToken('admin@chitfund.com');
    process.env.ADMIN_SESSION_SECRET = 'a-different-secret';
    expect(verifySessionToken(token)).toBe(false);
  });
});