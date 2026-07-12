import { apiFetch } from "@/lib/api";
import { getAdminToken, getAuthToken } from "@/lib/auth";

export type Realm = "admin" | "creator";

export type Conversation = {
  id: string;
  creator_id: string;
  name: string;
  email: string | null;
  last_message: string | null;
  last_message_at: string | null;
  last_sender: "admin" | "creator" | null;
  unread: boolean;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_type: "admin" | "creator";
  sender_admin_id: string | null;
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

// Admin-only: open (or reuse) the DM thread with a specific creator.
export const startConversation = (creatorId: string) =>
  apiFetch<Conversation>(`/api/admin/conversations/start`, {
    method: "POST",
    body: JSON.stringify({ creator_id: creatorId }),
    token: getAdminToken() ?? undefined,
  });

// Gmail compose in a new tab, recipient pre-filled. Falls back to mailto.
export function composeEmail(to: string | null, subject = "") {
  if (!to) return;
  const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}${subject ? `&su=${encodeURIComponent(subject)}` : ""}`;
  window.open(url, "_blank", "noopener,noreferrer");
}
