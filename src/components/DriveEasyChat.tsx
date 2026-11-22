import { Chat, useChat, type UseChatHelpers } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  ArrowUpRight,
  MessageCircle,
  MessagesSquare,
  Plus,
  X,
} from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";

export type ChatConversationSummary = {
  id: string;
  title: string;
  updatedAt: number;
};

type ChatContextValue = UseChatHelpers<UIMessage> & {
  sessions: ChatConversationSummary[];
  activeConversationId: string | null;
  isChatPage: boolean;
  createConversation: () => string;
  ensureActiveConversation: () => string;
  selectConversation: (id: string) => void;
};

const ChatSessionContext = createContext<ChatContextValue | null>(null);

function getConversationIdFromPath(pathname: string) {
  const match = /^\/chat\/([^/]+)\/?$/.exec(pathname);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export function ChatSessionProvider({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const routeConversationId = getConversationIdFromPath(pathname);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(routeConversationId);
  const [sessions, setSessions] = useState<ChatConversationSummary[]>(() =>
    routeConversationId
      ? [{ id: routeConversationId, title: "New conversation", updatedAt: 0 }]
      : [],
  );
  const chatInstances = useRef(new Map<string, Chat<UIMessage>>());

  const getChat = useCallback((id: string) => {
    const existing = chatInstances.current.get(id);
    if (existing) return existing;

    const chat = new Chat<UIMessage>({
      id,
      transport: new DefaultChatTransport({
        api: "/api/chat",
        body: { conversationId: id },
      }),
      onFinish: ({ messages }) => {
        const firstUserMessage = messages.find((message) => message.role === "user");
        const titleText = firstUserMessage?.parts
          .filter((part) => part.type === "text")
          .map((part) => part.text)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        const title = titleText ? titleText.slice(0, 42) : "New conversation";
        setSessions((current) =>
          current.map((session) =>
            session.id === id
              ? { ...session, title, updatedAt: Date.now() }
              : session,
          ),
        );
      },
    });
    chatInstances.current.set(id, chat);
    return chat;
  }, []);

  const ensureConversation = useCallback(
    (id: string) => {
      getChat(id);
      setSessions((current) => {
        if (current.some((session) => session.id === id)) return current;
        return [
          { id, title: "New conversation", updatedAt: Date.now() },
          ...current,
        ];
      });
    },
    [getChat],
  );

  useEffect(() => {
    if (!routeConversationId) return;
    setSelectedConversationId(routeConversationId);
    ensureConversation(routeConversationId);
  }, [routeConversationId, ensureConversation]);

  const createConversation = useCallback(() => {
    const id = crypto.randomUUID();
    ensureConversation(id);
    setSelectedConversationId(id);
    return id;
  }, [ensureConversation]);

  const selectConversation = useCallback(
    (id: string) => {
      ensureConversation(id);
      setSelectedConversationId(id);
    },
    [ensureConversation],
  );

  const activeConversationId = routeConversationId ?? selectedConversationId;
  const activeChat = getChat(activeConversationId ?? "driveeasy-welcome");
  const chat = useChat({ chat: activeChat });

  const value: ChatContextValue = {
    ...chat,
    sessions: [...sessions].sort((a, b) => b.updatedAt - a.updatedAt),
    activeConversationId,
    isChatPage: routeConversationId !== null,
    createConversation,
    ensureActiveConversation: () => {
      if (activeConversationId) return activeConversationId;
      return createConversation();
    },
    selectConversation,
  };

  return <ChatSessionContext.Provider value={value}>{children}</ChatSessionContext.Provider>;
}

export function useDriveEasyChat() {
  const context = useContext(ChatSessionContext);
  if (!context) throw new Error("DriveEasy chat must be used inside its session provider.");
  return context;
}

const QUICK_QUESTIONS = [
  "What do I need to book a vehicle?",
  "How can I find a scooter in my city?",
  "Where can I see my bookings?",
];

export function ChatSurface({ compact = false }: { compact?: boolean }) {
  const chat = useDriveEasyChat();
  const [input, setInput] = useState("");
  const inputSelector = '[data-driveeasy-chat-input="true"]';
  const isBusy = chat.status === "submitted" || chat.status === "streaming";
  const lastMessage = chat.messages.at(-1);
  const hasAssistantText =
    lastMessage?.role === "assistant" &&
    lastMessage.parts.some((part) => part.type === "text" && part.text.length > 0);
  const showThinking = isBusy && !hasAssistantText;

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      document.querySelector<HTMLTextAreaElement>(inputSelector)?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [chat.activeConversationId, inputSelector]);

  useEffect(() => {
    if (chat.status !== "ready") return;
    const frame = requestAnimationFrame(() => {
      document.querySelector<HTMLTextAreaElement>(inputSelector)?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [chat.status, chat.activeConversationId, inputSelector]);

  function submit(message: PromptInputMessage) {
    const text = message.text.trim();
    if (!text || isBusy) return;
    chat.ensureActiveConversation();
    void chat.sendMessage({ text });
    setInput("");
  }

  function sendQuickQuestion(question: string) {
    chat.ensureActiveConversation();
    void chat.sendMessage({ text: question });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Conversation className="min-h-0">
        <ConversationContent className="gap-5 px-4 py-5">
          {chat.messages.length === 0 ? (
            <ConversationEmptyState
              className="min-h-56"
              icon={<BrandLogo className="size-12" />}
              title="What can we help you with?"
              description="Ask about DriveEasy rentals, vehicles, or booking."
            >
              <div className="flex w-full max-w-sm flex-col items-center gap-3">
                <BrandLogo className="size-12" />
                <div className="space-y-1">
                  <h2 className="font-display text-lg font-semibold">What can we help you with?</h2>
                  <p className="text-sm text-muted-foreground">Ask about DriveEasy rentals, vehicles, or booking.</p>
                </div>
                <div className="mt-3 flex w-full flex-col gap-2">
                  {QUICK_QUESTIONS.map((question) => (
                    <Button
                      key={question}
                      type="button"
                      variant="outline"
                      className="h-auto justify-start whitespace-normal text-left font-normal"
                      onClick={() => sendQuickQuestion(question)}
                    >
                      {question}
                    </Button>
                  ))}
                </div>
              </div>
            </ConversationEmptyState>
          ) : (
            chat.messages.map((message) => (
              <div className="flex min-w-0 items-start gap-2" key={message.id}>
                {message.role === "assistant" ? <BrandLogo className="mt-1 size-7" /> : null}
                <Message from={message.role} className="min-w-0 flex-1">
                  <MessageContent className="max-w-full break-words">
                    {message.parts.map((part, index) => {
                      if (part.type === "text") {
                        return (
                          <MessageResponse key={`${message.id}-text-${index}`}>
                            {part.text}
                          </MessageResponse>
                        );
                      }
                      if (part.type === "reasoning") {
                        return (
                          <details
                            key={`${message.id}-reasoning-${index}`}
                            className="my-2 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground"
                          >
                            <summary className="cursor-pointer">Reasoning summary</summary>
                            <p className="mt-2 whitespace-pre-wrap">{part.text}</p>
                          </details>
                        );
                      }
                      return null;
                    })}
                  </MessageContent>
                </Message>
              </div>
            ))
          )}
          {showThinking ? (
            <div className="flex items-center gap-2 px-1" aria-live="polite">
              <BrandLogo className="size-7" />
              <Shimmer className="text-sm text-primary">Thinking...</Shimmer>
            </div>
          ) : null}
          {chat.status === "error" ? (
            <div className="flex items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
              <span className="min-w-0 break-words">
                {chat.error?.message || "The answer could not be loaded. Please try again."}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="shrink-0"
                onClick={() => void chat.regenerate()}
              >
                Try again
              </Button>
            </div>
          ) : null}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="shrink-0 border-t border-border/70 p-3">
        <PromptInput
          className="w-full"
          onSubmit={submit}
          aria-label="Ask DriveEasy"
        >
          <PromptInputTextarea
            value={input}
            maxLength={1200}
            rows={1}
            autoFocus
            data-driveeasy-chat-input="true"
            onChange={(event) => setInput(event.currentTarget.value)}
            placeholder="Ask DriveEasy anything..."
            className="min-h-11 resize-none px-3 py-3 text-sm"
          />
          <PromptInputFooter className="justify-between px-3 pb-2">
            <span className="text-xs text-muted-foreground">Check vehicle pages for current availability and rates.</span>
            <PromptInputSubmit
              status={chat.status === "error" ? "ready" : chat.status}
              disabled={!input.trim() && !isBusy}
              onStop={chat.stop}
              aria-label={isBusy ? "Stop response" : "Send message"}
              title={isBusy ? "Stop response" : "Send message"}
              className="mb-0.5"
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}

export function ChatDock() {
  const chat = useDriveEasyChat();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open]);

  if (chat.isChatPage) return null;

  function handleOpen() {
    chat.ensureActiveConversation();
    setOpen((current) => !current);
  }

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {open ? (
        <section
          className="chat-panel-arrive mb-3 flex h-[min(40rem,calc(100dvh-6.5rem))] w-[min(25rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-xl border border-border bg-background/95 shadow-2xl backdrop-blur-xl"
          aria-label="DriveEasy assistant"
          role="dialog"
          aria-modal="false"
        >
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <BrandLogo className="size-9" />
              <div className="min-w-0">
                <p className="truncate font-display text-sm font-semibold">DriveEasy assistant</p>
                <p className="text-xs text-muted-foreground">Rental questions, answered</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {chat.sessions.length > 0 ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="ghost" size="icon" aria-label="Conversation history" title="Conversation history">
                      <MessagesSquare />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    {chat.sessions.map((session) => (
                      <DropdownMenuItem
                        key={session.id}
                        onSelect={() => chat.selectConversation(session.id)}
                        className="max-w-64"
                      >
                        <span className="truncate">{session.title}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="New conversation"
                title="New conversation"
                onClick={() => chat.createConversation()}
              >
                <Plus />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Open full chat"
                title="Open full chat"
                onClick={() => {
                  const id = chat.ensureActiveConversation();
                  void navigate({ to: "/chat/$conversationId", params: { conversationId: id } });
                }}
              >
                <ArrowUpRight />
              </Button>
              <Button type="button" variant="ghost" size="icon" aria-label="Close chat" onClick={() => setOpen(false)}>
                <X />
              </Button>
            </div>
          </header>
          <ChatSurface compact />
        </section>
      ) : null}
      <Button
        type="button"
        variant="default"
        size="icon"
        className="size-14 rounded-full shadow-lg shadow-primary/20"
        aria-label={open ? "Close DriveEasy chat" : "Open DriveEasy chat"}
        aria-expanded={open}
        onClick={handleOpen}
      >
        {open ? <X className="size-5" /> : <MessageCircle className="size-6" />}
      </Button>
    </div>
  );
}

export function ChatConversationList({
  activeId,
  onSelect,
}: {
  activeId: string;
  onSelect: (id: string) => void;
}) {
  const { sessions } = useDriveEasyChat();

  if (sessions.length === 0) {
    return <p className="px-3 py-2 text-sm text-muted-foreground">Your conversations will appear here.</p>;
  }

  return (
    <nav aria-label="Conversations" className="flex flex-col gap-1">
      {sessions.map((session) => (
        <Button
          key={session.id}
          type="button"
          variant={session.id === activeId ? "secondary" : "ghost"}
          className="h-auto min-h-10 justify-start whitespace-normal text-left font-normal"
          onClick={() => onSelect(session.id)}
        >
          <span className="truncate">{session.title}</span>
        </Button>
      ))}
    </nav>
  );
}

export function ChatNewConversationButton({ onCreate }: { onCreate: () => void }) {
  return (
    <Button type="button" className="w-full justify-start" onClick={onCreate}>
      <Plus />
      New conversation
    </Button>
  );
}

export function ChatBackLink() {
  return (
    <Button asChild variant="ghost" className="px-0">
      <Link to="/vehicles">Browse vehicles</Link>
    </Button>
  );
}