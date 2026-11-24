import { createFileRoute } from "@tanstack/react-router";
import { asKey, asModel, synthesize } from "@/lib/kiln/upstream";

export const Route = createFileRoute("/api/speak")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as Record<string, unknown>;
          const provider = body.provider;
          if (provider !== "openai" && provider !== "elevenlabs" && provider !== "gemini" && provider !== "fish") {
            throw new Error("Choose a voice model.");
          }
          return await synthesize({
            provider,
            model: asModel(body.model),
            voice: typeof body.voice === "string" ? body.voice.slice(0, 80) : "",
            text: typeof body.text === "string" ? body.text : "",
            apiKey: asKey(body.apiKey),
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Could not speak that reply.";
          return Response.json({ error: message }, { status: 400 });
        }
      },
    },
  },
});
