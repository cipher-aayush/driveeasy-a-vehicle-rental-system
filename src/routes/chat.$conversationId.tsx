import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { ChatConversationList, ChatNewConversationButton, ChatSurface, useDriveEasyChat } from "@/components/DriveEasyChat";
import { SiteLayout } from "@/components/SiteLayout";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/chat/$conversationId")({
  head: () => ({
    meta: [
      { title: "DriveEasy assistant — rental help and booking questions" },
      {
        name: "description",
        content: "Get help with DriveEasy self-drive rentals, vehicles, and booking steps.",
      },
      { property: "og:title", content: "DriveEasy assistant — rental help" },
      {
        property: "og:description",
        content: "Ask DriveEasy about rentals, vehicles, and booking steps.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ChatPage,
});

function ChatPage() {
  const { conversationId } = Route.useParams();
  const navigate = useNavigate();
  const chat = useDriveEasyChat();

  function startConversation() {
    const id = chat.createConversation();
    void navigate({ to: "/chat/$conversationId", params: { conversationId: id } });
  }

  function openConversation(id: string) {
    chat.selectConversation(id);
    void navigate({ to: "/chat/$conversationId", params: { conversationId: id } });
  }

  return (
    <SiteLayout>
      <section className="mx-auto flex min-h-[calc(100dvh-9rem)] max-w-7xl flex-col px-4 py-6 sm:px-6 lg:py-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">DriveEasy assistant</p>
            <h1 className="mt-2 font-display text-3xl font-bold">How can we help?</h1>
          </div>
          <Button type="button" variant="outline" onClick={() => void navigate({ to: "/vehicles" })}>
            Browse vehicles
          </Button>
        </div>

        <div className="grid min-h-[36rem] flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
          <div className="order-2 flex min-h-[36rem] flex-col overflow-hidden rounded-xl border border-border bg-background/80 shadow-xl backdrop-blur-lg lg:order-1">
            <header className="flex items-center gap-3 border-b border-border px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {chat.sessions.find((session) => session.id === conversationId)?.title ?? "New conversation"}
                </p>
                <p className="text-xs text-muted-foreground">Rental questions, answered</p>
              </div>
            </header>
            <ChatSurface />
          </div>

          <aside className="order-1 flex flex-col gap-3 lg:order-2">
            <ChatNewConversationButton onCreate={startConversation} />
            <ChatConversationList activeId={conversationId} onSelect={openConversation} />
          </aside>
        </div>
      </section>
    </SiteLayout>
  );
}