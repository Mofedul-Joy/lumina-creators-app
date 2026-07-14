"use client";

import { useRouter } from "next/navigation";
import { MessagesDrawer } from "@/components/messaging/MessagesDrawer";

// Direct-URL entry to messaging. The primary surface is the topbar chat drawer,
// but /messages must not be a dead "coming soon" placeholder when messaging is
// fully live — render the same working drawer open, and send the user back to
// their dashboard when they close it.
export default function MessagesPage() {
  const router = useRouter();
  return (
    <div className="min-h-[100dvh]">
      <MessagesDrawer realm="creator" open onClose={() => router.push("/dashboard")} />
    </div>
  );
}
