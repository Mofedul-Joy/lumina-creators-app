"use client";

import { usePathname } from "next/navigation";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminMessagesLauncher } from "@/components/admin/AdminMessagesLauncher";

// Shared chrome for every /admin page: the collapsible left sidebar + content.
// The login page (and the /admin redirect stub) render bare, without nav.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  if (path === "/admin/login" || path === "/admin") return <>{children}</>;
  return (
    <div className="flex min-h-dvh">
      <AdminSidebar />
      <div className="min-w-0 flex-1">{children}</div>
      <AdminMessagesLauncher />
    </div>
  );
}
