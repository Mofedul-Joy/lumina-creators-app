import { redirect } from "next/navigation";

// /admin has no page of its own — send it to the dashboard, which bounces to
// /admin/login when there's no session.
export default function AdminIndex() {
  redirect("/admin/dashboard");
}
