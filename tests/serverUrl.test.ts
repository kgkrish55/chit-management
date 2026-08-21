import { afterEach, describe, expect, it } from 'vitest';
import { getServerAppBaseUrl } from '@/lib/serverUrl';

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('getServerAppBaseUrl', () => {
  it('prefers NEXT_PUBLIC_APP_URL', async () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://chit.example.vercel.app';
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'auto.vercel.app';
    expect(await getServerAppBaseUrl()).toBe('https://chit.example.vercel.app');
  });

  it('uses the Vercel production URL automatically', async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'chit-management.vercel.app';
    expect(await getServerAppBaseUrl()).toBe('https://chit-management.vercel.app');
  });

  it('falls back to the deployment URL when no production URL is set', async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    process.env.VERCEL_URL = 'chit-management-abc123.vercel.app';
    expect(await getServerAppBaseUrl()).toBe('https://chit-management-abc123.vercel.app');
  });

  it('falls back to localhost outside a request scope', async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    delete process.env.VERCEL_URL;
    expect(await getServerAppBaseUrl()).toBe('http://localhost:3000');
  });
});