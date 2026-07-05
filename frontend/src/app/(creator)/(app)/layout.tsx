import { CreatorLayout } from "@/components/creator/CreatorLayout";

// Wraps only the authenticated creator surface (dashboard, campaigns,
// submissions, profile) — NOT the (creator) group's auth pages (login,
// signup, verify-email, set-password), which stay as plain full-page forms.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <CreatorLayout>{children}</CreatorLayout>;
}
