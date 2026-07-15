import { apiFetch } from "@/lib/api";
import { getAdminToken, getAuthToken } from "@/lib/auth";

export type Realm = "admin" | "creator";

export type Conversation = {
  id: string;
  kind: "dm" | "channel";
  creator_id: string | null;
  name: string;
  email: string | null;
  whatsapp: string | null;
  last_message: string | null;
  last_message_at: string | null;
  last_sender: "admin" | "creator" | null;
  unread: boolean;
  muted: boolean;
  archived: boolean;
  member_count: number | null;
};

export type ChannelMember = { creator_id: string; name: string; email: string | null };

export type ConversationInfo = {
  message_count: number;
  first_message_at: string | null;
  last_message_at: string | null;
  created_at: string | null;
};

export type ContractHistoryItem = {
  document_id: string;
  title: string;
  campaign_name: string;
  status: string;
  sent_at: string | null;
  accepted_at: string | null;
  created_at: string | null;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_type: "admin" | "creator";
  sender_admin_id: string | null;
  sender_creator_id: string | null;
  sender_name: string | null;   // resolved author label (channels)
  body: string;
  created_at: string;
};

// Each realm hits its own prefix with its own token, so one component can serve
// both the admin console and the creator app.
const base = (realm: Realm) => (realm === "admin" ? "/api/admin" : "/api/creator");
const tok = (realm: Realm) => (realm === "admin" ? getAdminToken() : getAuthToken()) ?? undefined;

export const listConversations = (realm: Realm, unread = false) =>
  apiFetch<Conversation[]>(`${base(realm)}/conversations${unread ? "?unread=true" : ""}`, { token: tok(realm) });

export const unreadCount = (realm: Realm) =>
  apiFetch<{ unread: number }>(`${base(realm)}/conversations/unread-count`, { token: tok(realm) });

export const listMessages = (realm: Realm, conversationId: string) =>
  apiFetch<Message[]>(`${base(realm)}/conversations/${conversationId}/messages`, { token: tok(realm) });

export const sendMessage = (realm: Realm, conversationId: string, body: string) =>
  apiFetch<Message>(`${base(realm)}/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({ body }),
    token: tok(realm),
  });

export const markRead = (realm: Realm, conversationId: string) =>
  apiFetch<void>(`${base(realm)}/conversations/${conversationId}/read`, { method: "POST", token: tok(realm) });

// ── three-dots menu ──
export const setMuted = (realm: Realm, conversationId: string, muted: boolean) =>
  apiFetch<void>(`${base(realm)}/conversations/${conversationId}/mute`, {
    method: "POST", body: JSON.stringify({ muted }), token: tok(realm),
  });

// Admin-only: "leave conversation" archives it out of the inbox (restorable).
export const setArchived = (conversationId: string, archived: boolean) =>
  apiFetch<void>(`/api/admin/conversations/${conversationId}/archive`, {
    method: "POST", body: JSON.stringify({ archived }), token: getAdminToken() ?? undefined,
  });

export const conversationInfo = (realm: Realm, conversationId: string) =>
  apiFetch<ConversationInfo>(`${base(realm)}/conversations/${conversationId}/info`, { token: tok(realm) });

export const contractHistory = (realm: Realm, conversationId: string) =>
  apiFetch<ContractHistoryItem[]>(`${base(realm)}/conversations/${conversationId}/contracts`, { token: tok(realm) });

// Admin-only: open (or reuse) the DM thread with a specific creator.
export const startConversation = (creatorId: string) =>
  apiFetch<Conversation>(`/api/admin/conversations/start`, {
    method: "POST",
    body: JSON.stringify({ creator_id: creatorId }),
    token: getAdminToken() ?? undefined,
  });

// ── channels (admin) ──
export const createChannel = (title: string, creatorIds: string[]) =>
  apiFetch<Conversation>(`/api/admin/conversations/channels`, {
    method: "POST", body: JSON.stringify({ title, creator_ids: creatorIds }),
    token: getAdminToken() ?? undefined,
  });

export const channelMembers = (realm: Realm, conversationId: string) =>
  apiFetch<ChannelMember[]>(`${base(realm)}/conversations/${conversationId}/members`, { token: tok(realm) });

export const addChannelMembers = (conversationId: string, creatorIds: string[]) =>
  apiFetch<void>(`/api/admin/conversations/${conversationId}/members`, {
    method: "POST", body: JSON.stringify({ creator_ids: creatorIds }),
    token: getAdminToken() ?? undefined,
  });

export const removeChannelMember = (conversationId: string, creatorId: string) =>
  apiFetch<void>(`/api/admin/conversations/${conversationId}/members/${creatorId}`, {
    method: "DELETE", token: getAdminToken() ?? undefined,
  });

// Open Gmail's compose window with the recipient ALREADY in the To field.
// The `view=cm` compose URL is the only Gmail URL that pre-fills the recipient
// (the docked #inbox composer can't), so we use it — the admin gets a ready-to-
// send email addressed to the creator, no copy/paste. Falls back to a blank
// composer if there's no address on file.
export function composeEmail(to: string | null, subject = "") {
  const params = new URLSearchParams({ view: "cm", fs: "1", tf: "1" });
  if (to) params.set("to", to);
  if (subject) params.set("su", subject);
  window.open(`https://mail.google.com/mail/u/0/?${params.toString()}`, "_blank", "noopener,noreferrer");
}
