import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth';
import { getServerAppBaseUrl } from '@/lib/serverUrl';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  return NextResponse.json({
    authenticated: verifySessionToken(token),
    appBaseUrl: await getServerAppBaseUrl(),
  });
}