import { createFileRoute } from "@tanstack/react-router";
import { transcribe } from "@/lib/kiln/upstream.server";

export const Route = createFileRoute("/api/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const form = await request.formData();
          const text = await transcribe(form);
          return Response.json({ text });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Could not transcribe that recording.";
          return Response.json({ error: message }, { status: 400 });
        }
      },
    },
  },
});
