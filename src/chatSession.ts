import type { CompleteResponse, Policy } from "./api";

export type StoredChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: "streaming" | "done" | "error";
  meta?: CompleteResponse;
};

export type Conversation = {
  id: string;
  title: string;
  updatedAt: number;
  messages: StoredChatMessage[];
  policy: Policy;
};

export type ChatStore = {
  activeId: string;
  conversations: Conversation[];
};

export const CHAT_STORE_KEY = "orchestra.chat.v1";

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function titleFromMessages(messages: StoredChatMessage[]): string {
  const firstUser = messages.find((m) => m.role === "user" && m.content.trim());
  if (!firstUser) return "New chat";
  const oneLine = firstUser.content.replace(/\s+/g, " ").trim();
  return oneLine.length > 40 ? `${oneLine.slice(0, 40)}…` : oneLine;
}

export function createConversation(policy: Policy = "orchestra"): Conversation {
  return {
    id: uid(),
    title: "New chat",
    updatedAt: Date.now(),
    messages: [],
    policy,
  };
}

function sanitizeMessages(messages: StoredChatMessage[]): StoredChatMessage[] {
  return messages
    .filter((m) => m.status !== "streaming")
    .map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      status: m.status === "error" ? "error" : "done",
      meta: m.meta,
    }));
}

function readPersistedRaw(): string | null {
  try {
    const fromLocal = localStorage.getItem(CHAT_STORE_KEY);
    if (fromLocal) return fromLocal;
    // Migrate older per-tab sessionStorage chats into durable localStorage.
    const fromSession = sessionStorage.getItem(CHAT_STORE_KEY);
    if (fromSession) {
      localStorage.setItem(CHAT_STORE_KEY, fromSession);
      sessionStorage.removeItem(CHAT_STORE_KEY);
      return fromSession;
    }
  } catch {
    /* private mode / blocked storage */
  }
  return null;
}

export function loadChatStore(): ChatStore {
  try {
    const raw = readPersistedRaw();
    if (!raw) {
      const conv = createConversation();
      return { activeId: conv.id, conversations: [conv] };
    }
    const parsed = JSON.parse(raw) as ChatStore;
    if (!parsed?.conversations?.length) {
      const conv = createConversation();
      return { activeId: conv.id, conversations: [conv] };
    }
    const conversations = parsed.conversations.map((c) => ({
      ...c,
      messages: sanitizeMessages(c.messages || []),
      policy: (c.policy || "orchestra") as Policy,
      title: c.title || titleFromMessages(c.messages || []),
      updatedAt: c.updatedAt || Date.now(),
    }));
    const activeId =
      conversations.some((c) => c.id === parsed.activeId)
        ? parsed.activeId
        : conversations[0].id;
    return { activeId, conversations };
  } catch {
    const conv = createConversation();
    return { activeId: conv.id, conversations: [conv] };
  }
}

export function saveChatStore(store: ChatStore): void {
  const payload: ChatStore = {
    activeId: store.activeId,
    conversations: store.conversations.map((c) => ({
      ...c,
      messages: sanitizeMessages(c.messages),
      title: c.messages.length ? titleFromMessages(c.messages) : c.title || "New chat",
    })),
  };
  try {
    localStorage.setItem(CHAT_STORE_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode — chat still works in-memory for this tab */
  }
}

export function upsertActiveConversation(
  store: ChatStore,
  patch: Partial<Pick<Conversation, "messages" | "policy" | "title">>,
): ChatStore {
  const conversations = store.conversations.map((c) => {
    if (c.id !== store.activeId) return c;
    const messages = patch.messages ?? c.messages;
    return {
      ...c,
      ...patch,
      messages,
      title: messages.length ? titleFromMessages(messages) : patch.title || c.title || "New chat",
      updatedAt: Date.now(),
    };
  });
  return { ...store, conversations };
}
