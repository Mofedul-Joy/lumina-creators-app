// Deprecated: admin chrome now lives in the collapsible AdminSidebar, mounted
// by app/(admin)/admin/layout.tsx. Kept as a no-op so the many pages that still
// render <AdminShell /> don't need touching.
export function AdminShell() {
  return null;
}
