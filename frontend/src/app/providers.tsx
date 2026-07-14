"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { retryNonAuth } from "@/lib/api";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        // Retry transient network/5xx failures (Render cold-starts) a couple of
        // times so a one-off "Failed to fetch" self-heals; never retry auth errors.
        retry: retryNonAuth,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 4000),
      },
    },
  }));
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
