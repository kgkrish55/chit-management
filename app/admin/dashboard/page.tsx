import { redirect } from 'next/navigation';

// The real admin dashboard lives at "/" (app/page.tsx).
// This route is kept for compatibility with old bookmarks.
export default function AdminDashboardRedirect() {
  redirect('/');
}