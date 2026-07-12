"use client";

import { useQuery } from "@tanstack/react-query";
import { contractHistory, conversationInfo, type Conversation, type Realm } from "@/lib/messaging";
import { getCreatorRichDetail } from "@/lib/admin";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

const CONTRACT_TONE: Record<string, string> = {
  accepted: "text-emerald-400",
  sent: "text-amber-400",
  viewed: "text-amber-400",
};

/**
 * The slide-over panels launched from the thread header (two-heads → profile)
 * and the three-dots menu (message history, contract history). Rendered on top
 * of the open thread inside the same drawer width.
 */
export function ConversationExtras({
  realm, conversation, panel, onClose, onEmail,
}: {
  realm: Realm;
  conversation: Conversation;
  panel: "profile" | "info" | "contracts";
  onClose: () => void;
  onEmail: () => void;
}) {
  const title = panel === "profile" ? "Profile" : panel === "info" ? "Message history" : "Contract history";

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-[var(--color-bg-deep)]">
      <div className="flex items-center gap-2 border-b border-[var(--color-border)]/60 px-3 py-3">
        <button onClick={onClose} aria-label="Back" className="cursor-pointer rounded-lg p-1.5 text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <p className="flex-1 text-sm font-semibold text-[var(--color-text)]">{title}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {panel === "profile" ? (
          <ProfilePanel realm={realm} conversation={conversation} onEmail={onEmail} />
        ) : panel === "info" ? (
          <InfoPanel realm={realm} conversation={conversation} />
        ) : (
          <ContractsPanel realm={realm} conversation={conversation} />
        )}
      </div>
    </div>
  );
}

function ProfilePanel({ realm, conversation, onEmail }: { realm: Realm; conversation: Conversation; onEmail: () => void }) {
  // Admins get the rich creator profile; creators see a compact team card
  // (there's no rich endpoint for the company side).
  const richQ = useQuery({
    queryKey: ["conv-profile", conversation.creator_id],
    queryFn: () => getCreatorRichDetail(conversation.creator_id),
    enabled: realm === "admin",
    retry: false,
  });
  const r = richQ.data;

  const initial = conversation.name.trim().slice(0, 1).toUpperCase() || "?";

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center text-center">
        {realm === "admin" && r?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.avatar_url} alt="" className="h-20 w-20 rounded-full object-cover" />
        ) : (
          <span className="grid h-20 w-20 place-items-center rounded-full bg-[var(--color-surface-2)] text-2xl font-semibold text-[var(--color-text-muted)]">{initial}</span>
        )}
        <p className="mt-3 text-base font-semibold text-[var(--color-text)]">{conversation.name}</p>
        {conversation.email ? <p className="text-xs text-[var(--color-text-muted)]">{conversation.email}</p> : null}
        <div className="mt-3 flex gap-2">
          <button onClick={onEmail} disabled={!conversation.email} className="cursor-pointer rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-text)] transition hover:border-[var(--color-text-muted)] disabled:opacity-40">
            Email
          </button>
          {realm === "admin" ? (
            <a href={`/admin/creators/${conversation.creator_id}`} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-text)] transition hover:border-[var(--color-text-muted)]">
              Open full profile
            </a>
          ) : null}
        </div>
      </div>

      {realm === "creator" ? (
        <p className="rounded-xl border border-[var(--color-border)]/60 bg-[var(--color-surface)]/40 px-4 py-3 text-center text-sm text-[var(--color-text-secondary)]">
          This is your direct line to the Lumina team — ask about campaigns, payouts, or anything you need.
        </p>
      ) : richQ.isLoading ? (
        <p className="text-center text-xs text-[var(--color-text-muted)]">Loading profile…</p>
      ) : r ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Posts", value: r.total_posts },
              { label: "Views", value: Intl.NumberFormat(undefined, { notation: "compact" }).format(r.total_views) },
              { label: "Earned", value: `$${Number(r.total_earned).toLocaleString()}` },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-[var(--color-border)]/60 bg-[var(--color-surface)]/40 px-2 py-2.5 text-center">
                <p className="text-sm font-semibold text-[var(--color-text)]">{s.value}</p>
                <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">{s.label}</p>
              </div>
            ))}
          </div>

          {r.bio ? <p className="text-sm text-[var(--color-text-secondary)]">{r.bio}</p> : null}

          <div className="flex flex-wrap gap-1.5">
            {(r.city || r.country) ? <Chip>{[r.city, r.country].filter(Boolean).join(", ")}</Chip> : null}
            {r.creator_type ? <Chip>{r.creator_type}</Chip> : null}
            {r.niches?.slice(0, 4).map((n) => <Chip key={n}>{n}</Chip>)}
          </div>

          {r.socials?.length ? (
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Socials</p>
              {r.socials.map((s) => (
                <a key={s.platform + s.handle} href={s.profile_url ?? "#"} target="_blank" rel="noopener noreferrer"
                   className="flex items-center justify-between rounded-lg border border-[var(--color-border)]/60 bg-[var(--color-surface)]/40 px-3 py-2 text-sm transition hover:border-[var(--color-text-muted)]">
                  <span className="capitalize text-[var(--color-text-secondary)]">{s.platform}</span>
                  <span className="text-[var(--color-text)]">@{s.handle}</span>
                </a>
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <p className="text-center text-xs text-[var(--color-text-muted)]">Couldn&apos;t load this profile.</p>
      )}
    </div>
  );
}

function InfoPanel({ realm, conversation }: { realm: Realm; conversation: Conversation }) {
  const infoQ = useQuery({
    queryKey: ["conv-info", realm, conversation.id],
    queryFn: () => conversationInfo(realm, conversation.id),
    retry: false,
  });
  const i = infoQ.data;
  const rows = [
    { label: "Messages exchanged", value: i ? String(i.message_count) : "—" },
    { label: "First message", value: fmtDate(i?.first_message_at ?? null) },
    { label: "Last message", value: fmtDate(i?.last_message_at ?? null) },
    { label: "Conversation opened", value: fmtDate(i?.created_at ?? null) },
  ];
  return (
    <div className="space-y-2">
      {infoQ.isLoading ? (
        <p className="text-center text-xs text-[var(--color-text-muted)]">Loading…</p>
      ) : (
        rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between rounded-lg border border-[var(--color-border)]/60 bg-[var(--color-surface)]/40 px-3 py-2.5">
            <span className="text-sm text-[var(--color-text-secondary)]">{row.label}</span>
            <span className="text-sm font-medium text-[var(--color-text)]">{row.value}</span>
          </div>
        ))
      )}
    </div>
  );
}

function ContractsPanel({ realm, conversation }: { realm: Realm; conversation: Conversation }) {
  const cQ = useQuery({
    queryKey: ["conv-contracts", realm, conversation.id],
    queryFn: () => contractHistory(realm, conversation.id),
    retry: false,
  });
  const contracts = cQ.data ?? [];
  return (
    <div className="space-y-2">
      {cQ.isLoading ? (
        <p className="text-center text-xs text-[var(--color-text-muted)]">Loading…</p>
      ) : contracts.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-[var(--color-surface)] text-xl">📄</span>
          <p className="text-sm font-medium text-[var(--color-text)]">No agreements yet</p>
          <p className="text-xs text-[var(--color-text-muted)]">Campaign agreements {realm === "admin" ? "sent to this creator" : "you receive"} show up here.</p>
        </div>
      ) : (
        contracts.map((c) => {
          const tone = CONTRACT_TONE[c.status] ?? "text-[var(--color-text-muted)]";
          const inner = (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[var(--color-text)]">{c.campaign_name}</p>
                <p className="truncate text-xs text-[var(--color-text-muted)]">{c.title}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className={`text-xs font-semibold capitalize ${tone}`}>{c.status}</p>
                <p className="text-[11px] text-[var(--color-text-muted)]">{fmtDate(c.accepted_at ?? c.sent_at ?? c.created_at)}</p>
              </div>
            </>
          );
          return realm === "creator" ? (
            <a key={c.document_id} href={`/contracts/${c.document_id}`}
               className="flex items-center gap-3 rounded-lg border border-[var(--color-border)]/60 bg-[var(--color-surface)]/40 px-3 py-2.5 transition hover:border-[var(--color-text-muted)]">
              {inner}
            </a>
          ) : (
            <div key={c.document_id} className="flex items-center gap-3 rounded-lg border border-[var(--color-border)]/60 bg-[var(--color-surface)]/40 px-3 py-2.5">
              {inner}
            </div>
          );
        })
      )}
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-xs capitalize text-[var(--color-text-secondary)]">
      {children}
    </span>
  );
}
