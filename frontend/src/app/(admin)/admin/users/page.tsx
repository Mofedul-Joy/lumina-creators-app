"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { AdminNav } from "@/components/admin/AdminNav";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { getAdminToken } from "@/lib/auth";
import { createUser, editClient, getUsers, listAdminCampaigns, reactivateClient, suspendClient } from "@/lib/admin";
import { isAuthError } from "@/lib/api";
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

  const q = useQuery({ queryKey: ["users"], queryFn: getUsers, enabled: ready && hasToken, retry: false });
  const campaignsQ = useQuery({ queryKey: ["admin-campaigns"], queryFn: () => listAdminCampaigns(), enabled: ready && hasToken, retry: false });
  useEffect(() => {
    if (q.isError && isAuthError(q.error)) router.replace("/admin/login");
  }, [q.isError, q.error, router]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["users"] });
  const suspendM = useMutation({ mutationFn: suspendClient, onSuccess: refresh });
  const reactivateM = useMutation({ mutationFn: reactivateClient, onSuccess: refresh });

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
    const link = `${window.location.origin}/${realm === "admin" ? "admin/login" : "client/login"}?email=${encodeURIComponent(email)}`;
    // clipboard API can reject (permissions/insecure context) — fall back so the
    // button always gives feedback and the link is still obtainable
    navigator.clipboard?.writeText(link).catch(() => window.prompt("Copy this invite link:", link));
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
      <AdminNav />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-brand)]">Operations Terminal</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-[var(--color-text)]">Users</h1>
            <p className="mt-2 max-w-xl text-[var(--color-text-secondary)]">
              Lumina staff and brand accounts. Admins have full read/write; clients are read-only.
            </p>
          </div>
          <button onClick={() => setShowAdd(true)} className="shrink-0 cursor-pointer rounded-full bg-[var(--color-brand)] px-5 py-2.5 text-sm font-semibold text-[var(--color-on-brand)] transition hover:bg-[var(--color-brand-hover)]">
            + Add user
          </button>
        </div>

        {!u ? (
          <p className="mt-10 text-sm text-[var(--color-text-secondary)]">Loading…</p>
        ) : (
          <>
            <div className="mt-8 grid grid-cols-3 gap-4">
              <StatTile label="Staff" value={fmtInt(u.admins.length)} hint="Admin accounts" />
              <StatTile label="Brands" value={fmtInt(u.clients.length)} hint="Client accounts" />
              <StatTile label="Creators" value={fmtInt(u.creator_count)} hint={`${u.creator_active} active — view all →`} href="/admin/creators" />
            </div>

            {/* staff */}
            <div id="staff" className="card-lumina mt-6 scroll-mt-24 overflow-hidden rounded-[var(--radius-card)]">
              <div className="border-b border-[var(--color-border)] px-6 py-4">
                <h2 className="text-lg font-semibold text-[var(--color-text)]">Staff (admins)</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
                      <th className="px-6 py-3 font-medium">Email</th>
                      <th className="px-6 py-3 font-medium">Role</th>
                      <th className="px-6 py-3 font-medium">Status</th>
                      <th className="px-6 py-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {u.admins.map((a) => (
                      <tr key={a.id} className="border-t border-[var(--color-border)]/40">
                        <td className="px-6 py-4"><Link href={`/admin/users/staff/${a.id}`} className="text-[var(--color-text)] hover:text-[var(--color-brand)]">{a.email}</Link></td>
                        <td className="px-6 py-4 capitalize text-[var(--color-text-secondary)]">{a.role}</td>
                        <td className="px-6 py-4"><StatusBadge status={a.status} /></td>
                        <td className="px-6 py-4 text-right">
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
            </div>

            {/* clients */}
            <div id="brands" className="card-lumina mt-6 scroll-mt-24 overflow-hidden rounded-[var(--radius-card)]">
              <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
                <h2 className="text-lg font-semibold text-[var(--color-text)]">Brand accounts (clients)</h2>
                <Link href="/admin/users/brands" className="text-sm font-medium text-[var(--color-brand)] hover:underline">Manage all brands →</Link>
              </div>
              {u.clients.length === 0 ? (
                <p className="p-10 text-center text-sm text-[var(--color-text-secondary)]">No brand accounts yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
                        <th className="px-6 py-3 font-medium">Brand</th>
                        <th className="px-6 py-3 font-medium">Email</th>
                        <th className="px-6 py-3 font-medium">Status</th>
                        <th className="px-6 py-3 text-right font-medium">Access</th>
                      </tr>
                    </thead>
                    <tbody>
                      {u.clients.map((c) => (
                        <tr key={c.id} className="border-t border-[var(--color-border)]/40">
                          <td className="px-6 py-4"><Link href={`/admin/users/brands/${c.id}`} className="text-[var(--color-text)] hover:text-[var(--color-brand)]">{c.name ?? "—"}</Link></td>
                          <td className="px-6 py-4 text-[var(--color-text-secondary)]">{c.email}</td>
                          <td className="px-6 py-4"><StatusBadge status={c.status} /></td>
                          <td className="px-6 py-4">
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
            </div>

          </>
        )}

        {/* add-user modal */}
        {showAdd ? (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={() => setShowAdd(false)}>
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
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={() => setEditing(null)}>
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
