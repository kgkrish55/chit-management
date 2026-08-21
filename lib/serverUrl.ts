import { headers } from 'next/headers';

export async function getServerAppBaseUrl(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');

  const vercelProduction = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelProduction) return `https://${vercelProduction}`;

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) return `https://${vercelUrl}`;

  try {
    const h = await headers();
    const proto = h.get('x-forwarded-proto') || 'http';
    const host = h.get('x-forwarded-host') || h.get('host');
    if (host) return `${proto}://${host}`;
  } catch {
    // headers() is unavailable outside a request scope; fall through.
  }

  return 'http://localhost:3000';
}