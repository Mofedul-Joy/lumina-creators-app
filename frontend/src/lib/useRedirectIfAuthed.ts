"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAccess, type Realm } from "@/lib/tokens";

// Persistent login: sessions live in localStorage (see tokens.ts), so a signed-in
// user is still authenticated when they return to the site in the same browser.
// This hook makes the *entry pages* honour that — if a session for `realm`
// already exists, bounce straight to `dest` instead of showing the login/signup
// form again. Returns true while the redirect is pending so the caller can render
// nothing (no flash of the form). A stale/expired token is harmless: the
// destination's first API call silently refreshes, or bounces back to login.
export function useRedirectIfAuthed(realm: Realm, dest: string): boolean {
  const router = useRouter();
  const [redirecting, setRedirecting] = useState(false);
  useEffect(() => {
    if (getAccess(realm)) {
      setRedirecting(true);
      router.replace(dest);
    }
  }, [realm, dest, router]);
  return redirecting;
}
