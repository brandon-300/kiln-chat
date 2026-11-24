import { createFileRoute } from "@tanstack/react-router";
import { parseChatBody, streamChat } from "@/lib/kiln/upstream";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const raw = await request.json();
          const origin = new URL(request.url).origin;
          return streamChat(parseChatBody(raw, origin), request.signal);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Could not send that message.";
          return Response.json({ error: message }, { status: 400 });
        }
      },
    },
  },
});
