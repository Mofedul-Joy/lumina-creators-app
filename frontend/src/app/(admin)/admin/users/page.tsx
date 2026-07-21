"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { getAdminToken } from "@/lib/auth";
import { adminRealmUrl, clientRealmUrl } from "@/lib/realmUrls";
import { createUser, editClient, getUsers, listAdminCampaigns, reactivateClient, suspendClient } from "@/lib/admin";
import { isAuthError, retryNonAuth} from "@/lib/api";
import { fmtInt } from "@/lib/format";

function StatTile({ label, value, hint, href }: { label: string; value: string; hint?: string; href?: string }) {
  const body = (
    <div className="card-grad rounded-[var(--radius-card)] p-5 transition hover:ring-1 hover:ring-[var(--color-brand)]/30">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-text-muted)]">{label}</p>
      <p className="tabular mt-3 text-3xl font-semibold text-[var(--color-text)]">{value}</p>
      {hint ? <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{hint}</p> : null}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [ready, setReady] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  useEffect(() => {
    setHasToken(!!getAdminToken());
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready && !hasToken) router.replace("/admin/login");
  }, [ready, hasToken, router]);

  const q = useQuery({ queryKey: ["users"], queryFn: getUsers, enabled: ready && hasToken, retry: retryNonAuth });
  const campaignsQ = useQuery({ queryKey: ["admin-campaigns"], queryFn: () => listAdminCampaigns(), enabled: ready && hasToken, retry: retryNonAuth });
  useEffect(() => {
    if (q.isError && isAuthError(q.error)) router.replace("/admin/login");
  }, [q.isError, q.error, router]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["users"] });
  const suspendM = useMutation({ mutationFn: suspendClient, onSuccess: refresh });
  const reactivateM = useMutation({ mutationFn: reactivateClient, onSuccess: refresh });

  const [tab, setTab] = useState<"staff" | "clients">("staff");
  // add-user modal
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "admin" as "admin" | "client" });
  const [campaignIds, setCampaignIds] = useState<string[]>([]);
  const [addErr, setAddErr] = useState("");
  const createM = useMutation({
    mutationFn: () => createUser({ name: form.name.trim() || undefined, email: form.email.trim(), password: form.password, role: form.role, campaign_ids: form.role === "client" ? campaignIds : [] }),
    onSuccess: () => {
      setShowAdd(false);
      setForm({ name: "", email: "", password: "", role: "admin" });
      setCampaignIds([]);
      setAddErr("");
      refresh();
      qc.invalidateQueries({ queryKey: ["admin-clients"] });
    },
    onError: (e) => setAddErr((e as Error).message),
  });

  // edit-client modal (Bill: "add these actions — edit, and an invite link")
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [editForm, setEditForm] = useState({ name: "", password: "" });
  const [editErr, setEditErr] = useState("");
  const editM = useMutation({
    mutationFn: () => editClient(editing!.id, {
      name: editForm.name.trim() || undefined,
      password: editForm.password || undefined,
    }),
    onSuccess: () => { setEditing(null); setEditErr(""); refresh(); },
    onError: (e) => setEditErr((e as Error).message),
  });

  // invite link: prefilled login URL for the user's realm
  const [copied, setCopied] = useState("");
  function copyInvite(realm: "admin" | "client", email: string) {
    const q = `/login?email=${encodeURIComponent(email)}`;
    const link = realm === "admin" ? adminRealmUrl(q) : clientRealmUrl(q);
    navigator.clipboard.writeText(link);
    setCopied(email);
    setTimeout(() => setCopied(""), 1500);
  }

  if (!ready || !hasToken)
    return (
      <main className="flex min-h-[100dvh] items-center justify-center">
        <p className="text-sm text-[var(--color-text-secondary)]">Loading…</p>
      </main>
    );

  const u = q.data;
  const busy = suspendM.isPending || reactivateM.isPending;

  return (
    <div className="min-h-[100dvh]">
      <AdminShell />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-[var(--color-text)]">Admins</h1>
            <p className="mt-2 max-w-xl text-[var(--color-text-secondary)]">
              Lumina team and client accounts. Team members have full read/write; clients are read-only.
            </p>
          </div>
          <button onClick={() => setShowAdd(true)} className="shrink-0 cursor-pointer rounded-full bg-[var(--color-brand)] px-5 py-2.5 text-sm font-semibold text-[var(--color-on-brand)] transition hover:bg-[var(--color-brand-hover)]">
            + Add user
          </button>
        </div>
        <AdminTabs />

        {!u ? (
          <p className="mt-10 text-sm text-[var(--color-text-secondary)]">Loading…</p>
        ) : (
          <>
            <div className="mt-8 grid grid-cols-3 gap-4">
              {/* Rhys 2026-07-21: staff → team, brands → clients. */}
              <StatTile label="Team" value={fmtInt(u.admins.length)} hint="Admin accounts" />
              <StatTile label="Clients" value={fmtInt(u.clients.length)} hint="Client accounts" />
              <StatTile label="Creators" value={fmtInt(u.creator_count)} hint={`${u.creator_active} active · view all →`} href="/admin/creators" />
            </div>

            {/* admin / client toggle */}
            <div className="mt-8 flex gap-1 border-b border-[var(--color-border)]">
              {([["staff", `Team (${u.admins.length})`], ["clients", `Clients (${u.clients.length})`]] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`cursor-pointer border-b-2 px-3 py-2.5 text-sm transition ${
                    tab === key ? "border-[var(--color-brand)] text-[var(--color-text)]" : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* clean table (campaigns-style), one per tab */}
            {tab === "staff" ? (
              <div className="mt-4 overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)]">
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead className="bg-[var(--color-surface)] text-xs uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
                    <tr>
                      <th className="px-4 py-3 font-medium">Email</th>
                      <th className="px-4 py-3 font-medium">Role</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {u.admins.map((a) => (
                      <tr key={a.id} onClick={() => router.push(`/admin/users/staff/${a.id}`)} className="cursor-pointer transition hover:bg-[var(--color-surface)]/50">
                        <td className="px-4 py-3 text-[var(--color-text)]">{a.email}</td>
                        <td className="px-4 py-3 capitalize text-[var(--color-text-secondary)]">{a.role}</td>
                        <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => copyInvite("admin", a.email)}
                            className="cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium text-[var(--color-text-secondary)] ring-1 ring-inset ring-[var(--color-border)] hover:text-[var(--color-brand)]"
                          >
                            {copied === a.email ? "Copied ✓" : "Invite link"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : u.clients.length === 0 ? (
              <div className="mt-4 rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] p-10 text-center text-sm text-[var(--color-text-secondary)]">No brand accounts yet.</div>
            ) : (
              <div className="mt-4 overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)]">
                <table className="w-full min-w-[620px] text-left text-sm">
                  <thead className="bg-[var(--color-surface)] text-xs uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
                    <tr>
                      <th className="px-4 py-3 font-medium">Client</th>
                      <th className="px-4 py-3 font-medium">Email</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {u.clients.map((c) => (
                      <tr key={c.id} onClick={() => router.push(`/admin/users/brands/${c.id}`)} className="cursor-pointer transition hover:bg-[var(--color-surface)]/50">
                        <td className="px-4 py-3 text-[var(--color-text)]">{c.name ?? "-"}</td>
                        <td className="px-4 py-3 text-[var(--color-text-secondary)]">{c.email}</td>
                        <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5 text-xs">
                            <button
                              onClick={() => { setEditing({ id: c.id, name: c.name ?? "" }); setEditForm({ name: c.name ?? "", password: "" }); setEditErr(""); }}
                              className="cursor-pointer rounded-md px-2.5 py-1 font-medium text-[var(--color-text-secondary)] ring-1 ring-inset ring-[var(--color-border)] hover:text-[var(--color-text)]"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => copyInvite("client", c.email)}
                              className="cursor-pointer rounded-md px-2.5 py-1 font-medium text-[var(--color-text-secondary)] ring-1 ring-inset ring-[var(--color-border)] hover:text-[var(--color-brand)]"
                            >
                              {copied === c.email ? "Copied ✓" : "Invite link"}
                            </button>
                            {c.status === "active" ? (
                              <button disabled={busy} onClick={() => suspendM.mutate(c.id)}
                                className="cursor-pointer rounded-md px-2.5 py-1 font-medium text-[var(--color-text-secondary)] ring-1 ring-inset ring-[var(--color-border)] hover:text-red-400 hover:ring-red-500/25 disabled:opacity-50">
                                Suspend
                              </button>
                            ) : (
                              <button disabled={busy} onClick={() => reactivateM.mutate(c.id)}
                                className="cursor-pointer rounded-md bg-emerald-500/15 px-2.5 py-1 font-medium text-emerald-400 ring-1 ring-inset ring-emerald-500/25 hover:bg-emerald-500/25 disabled:opacity-50">
                                Reactivate
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* add-user modal */}
        {showAdd ? (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
            <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-[var(--color-text)]">Add user</h3>
                <button onClick={() => setShowAdd(false)} className="cursor-pointer rounded-full p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)]" aria-label="Close">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                </button>
              </div>

              <div className="mt-5 space-y-4">
                <Labeled label="Name">
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" className={inputCls} />
                </Labeled>
                <Labeled label="Email">
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} />
                </Labeled>
                <Labeled label="Password">
                  <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="At least 8 characters" className={inputCls} />
                </Labeled>
                <Labeled label="Role">
                  <div className="grid grid-cols-2 gap-2">
                    {(["admin", "client"] as const).map((r) => (
                      <button key={r} type="button" onClick={() => setForm({ ...form, role: r })}
                        className={`rounded-xl border px-3 py-2 text-left text-sm transition ${form.role === r ? "border-[var(--color-brand)] bg-[var(--color-surface-2)]" : "border-[var(--color-border)]"}`}>
                        <span className="block font-medium text-[var(--color-text)]">{r === "admin" ? "Admin" : "Client"}</span>
                        <span className="block text-xs text-[var(--color-text-muted)]">{r === "admin" ? "Read/write, all campaigns" : "Read-only, scoped"}</span>
                      </button>
                    ))}
                  </div>
                </Labeled>

                {form.role === "client" ? (
                  <Labeled label="Campaign access">
                    <p className="mb-1.5 text-xs text-[var(--color-text-muted)]">Campaigns this client can view. Admins see all.</p>
                    <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-[var(--color-border)] p-2">
                      {(campaignsQ.data ?? []).length === 0 ? (
                        <p className="p-2 text-xs text-[var(--color-text-muted)]">No campaigns yet.</p>
                      ) : (
                        (campaignsQ.data ?? []).map((c) => {
                          const on = campaignIds.includes(c.id);
                          return (
                            <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-[var(--color-surface-2)]">
                              <input type="checkbox" checked={on} onChange={() => setCampaignIds((ids) => on ? ids.filter((x) => x !== c.id) : [...ids, c.id])} className="h-4 w-4 accent-[var(--color-brand)]" />
                              <span className="truncate text-[var(--color-text)]">{c.name}</span>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </Labeled>
                ) : null}

                {addErr ? <p className="text-sm text-[var(--color-danger)]">{addErr}</p> : null}
                <div className="flex justify-end gap-3 pt-1">
                  <button onClick={() => setShowAdd(false)} className="cursor-pointer rounded-full px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">Cancel</button>
                  <button
                    disabled={createM.isPending || !form.email.trim() || form.password.length < 8}
                    onClick={() => { setAddErr(""); createM.mutate(); }}
                    className="cursor-pointer rounded-full bg-[var(--color-brand)] px-5 py-2 text-sm font-semibold text-[var(--color-on-brand)] disabled:opacity-50"
                  >
                    {createM.isPending ? "Creating…" : "Create user"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* edit-client modal */}
        {editing ? (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-md rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-[var(--color-text)]">Edit user</h3>
                <button onClick={() => setEditing(null)} className="cursor-pointer rounded-full p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)]" aria-label="Close">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                </button>
              </div>
              <div className="mt-5 space-y-4">
                <Labeled label="Brand name">
                  <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className={inputCls} />
                </Labeled>
                <Labeled label="New password (leave blank to keep)">
                  <input type="password" value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} placeholder="At least 8 characters" className={inputCls} />
                </Labeled>
                {editErr ? <p className="text-sm text-[var(--color-danger)]">{editErr}</p> : null}
                <div className="flex justify-end gap-3 pt-1">
                  <button onClick={() => setEditing(null)} className="cursor-pointer rounded-full px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">Cancel</button>
                  <button
                    disabled={editM.isPending || (!!editForm.password && editForm.password.length < 8)}
                    onClick={() => editM.mutate()}
                    className="cursor-pointer rounded-full bg-[var(--color-brand)] px-5 py-2 text-sm font-semibold text-[var(--color-on-brand)] disabled:opacity-50"
                  >
                    {editM.isPending ? "Saving…" : "Save changes"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}

const inputCls = "min-h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-brand)]";

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-[var(--color-text)]">{label}</span>
      {children}
    </label>
  );
}
