import { describe, expect, it } from 'vitest';
import { getAppBaseUrl } from '@/lib/appUrl';

describe('getAppBaseUrl', () => {
  it('uses NEXT_PUBLIC_APP_URL when set', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://chit.example.vercel.app';
    expect(getAppBaseUrl()).toBe('https://chit.example.vercel.app');
  });

  it('strips a trailing slash from the configured URL', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://chit.example.vercel.app/';
    expect(getAppBaseUrl()).toBe('https://chit.example.vercel.app');
  });

  it('falls back to localhost when unset and not in a browser', () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(getAppBaseUrl()).toBe('http://localhost:3000');
  });
});