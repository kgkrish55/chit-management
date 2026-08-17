import { NextRequest, NextResponse } from 'next/server';
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  createSessionToken,
  getAdminCredentials,
} from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { email?: string; password?: string };
    const email = body.email?.trim() || '';
    const password = body.password || '';

    // Small constant-time-ish delay to slow down brute-force attempts.
    await new Promise((resolve) => setTimeout(resolve, 350));

    const { email: adminEmail, password: adminPassword } = getAdminCredentials();

    if (
      email.length > 0 &&
      password.length > 0 &&
      email.toLowerCase() === adminEmail.toLowerCase() &&
      password === adminPassword
    ) {
      const token = createSessionToken(adminEmail);
      const response = NextResponse.json({ success: true });
      response.cookies.set(SESSION_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: SESSION_MAX_AGE,
      });
      return response;
    }

    return NextResponse.json(
      { success: false, error: 'Invalid email or password' },
      { status: 401 }
    );
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid request' },
      { status: 400 }
    );
  }
}
