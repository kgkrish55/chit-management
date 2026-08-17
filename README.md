# Chit Fund Dashboard

A production-ready admin dashboard and member portal for a 1 Lakh (12-Month) Chit Fund management system.

## Features

- **Admin Command Center** (`/`) — batch & member management, monthly ledger reference, cash payment tracking, WhatsApp statement links. Protected by admin login.
- **Member Portal** (`/member-portal?phone=...`) — members open their personalized link via WhatsApp, view monthly due status, and upload payment screenshots for AI-assisted amount verification.
- **Receipt scanning** — Gemini AI extracts the paid amount from UPI/PhonePe/Paytm screenshots, with a Tesseract OCR fallback.

## Tech Stack

- Next.js 16 (App Router, Turbopack) + React 19 + TypeScript
- Tailwind CSS 4
- Supabase (Postgres)
- Gemini AI / Tesseract.js for receipt OCR

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env.local` and fill in your Supabase credentials:

```bash
cp .env.example .env.local
```

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public (anon) key — used in the browser |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key — used server-side only |
| `GEMINI_API_KEY` | Optional; enables AI receipt scanning (must start with `AIza`). Falls back to OCR. |
| `ADMIN_EMAIL` | Admin login email (default `admin@chitfund.com`) |
| `ADMIN_PASSWORD` | Admin login password (default `admin@123`) |
| `ADMIN_SESSION_SECRET` | Secret used to sign the admin session cookie |

> **Important:** `ADMIN_EMAIL` / `ADMIN_PASSWORD` are placeholders only for now. Change them to real credentials before going live, and set a strong `ADMIN_SESSION_SECRET` in production.

### 3. Database schema

The app expects these tables in Supabase:

- **`members`** — `id`, `full_name`, `phone_number`, `upi_id`, `created_at`
- **`chit_groups`** — `id`, `group_name`, `batch_name`, `start_date`, `due_day`, `total_pool_amount`, `total_members`, `total_months`, `current_cycle`
- **`group_enrollments`** — `id`, `member_id`, `group_id`, `payout_month`
- **`member_payments`** — `id`, `member_id`, `group_id`, `month_number`, `amount_paid`, `status` (`PAID`/`PARTIAL`/`PENDING`), `payment_mode`, `receipt_utr`

For a production deployment, enable Row Level Security and grant the anon role only the policies your public pages need.

### 4. Run the app

```bash
npm run dev       # development
npm run build     # production build
npm start         # start production server
```

Open [http://localhost:3000](http://localhost:3000). You will be redirected to the login page — sign in with the admin credentials to reach the dashboard.

## Admin Login

- URL: `/login`
- Default credentials: `admin@chitfund.com` / `admin@123`
- Sessions use an httpOnly, signed cookie; admin routes (`/` and `/admin/*`) are protected by a proxy that redirects unauthenticated visitors to `/login`.

## Sending Members Their Portal Link

From the admin dashboard, click **📲 Send Link** next to any participant. This opens WhatsApp with a link shaped like:

```
https://yourdomain.com/member-portal?phone=6369081109
```

The member portal looks up the account by that phone number, so the number stored in the `members` table must match.

## Project Structure

```
app/
  page.tsx                     # Admin dashboard (protected)
  login/page.tsx               # Admin login
  member-portal/page.tsx       # Member portal (?phone=...)
  api/auth/login|logout|session/route.ts   # Auth API
  api/ai-agent/scan-receipt/route.ts       # Receipt OCR + payment recording
lib/
  auth.ts                      # Session cookie sign/verify (server-only)
  supabaseClient.ts            # Browser Supabase client
  supabaseAdmin.ts             # Server-only Supabase client
  chitEngine.ts                # Statement/message helpers
proxy.ts                       # Route protection
```
