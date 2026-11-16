# Complete DriveEasy chat

## Scope
- Finish the floating chat popup and dedicated conversation pages using the existing AI Elements primitives and DriveEasy visual style.
- Keep multiple conversations in memory only for the current browser session, shared between popup and page routes; do not persist chat history.
- Stream assistant responses through Lovable AI on the server, with stop, retry/error feedback, and session-only conversation switching.

## Implementation
- Add the streamed TanStack API route and request-scoped gateway/Responses helpers using the configured Lovable AI key.
- Add session-level chat state and a shared chat surface, mounted outside the route-transition outlet; connect the animated popup and URL-backed conversation pages.
- Repair the broken AI Elements components only as needed, use their message/composer/loading primitives, and add route metadata.
- Update the roadmap when the complete flow has been validated.

## Verification
- Run the project typecheck, build, and lint; inspect preview diagnostics.
- Exercise the popup, streamed reply, Stop, create/switch conversations, and reload behavior in the browser. Confirm conversation history is not persisted after a fresh browser session.
