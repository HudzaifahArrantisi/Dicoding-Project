import { Elysia } from "elysia";
import { getAuthUser, type AuthUser } from "./plugins/auth";

export type InventoryTopic =
  | "orders"
  | "stocks"
  | "logs"
  | "products"
  | "notifications"
  | "metrics"
  | "partners";

type InventoryEvent = {
  partnerId: string | null;
  topics: InventoryTopic[];
};

type Subscriber = {
  user: AuthUser;
  send: (topics: InventoryTopic[]) => void;
};

const subscribers = new Set<Subscriber>();
const encoder = new TextEncoder();

export function publishInventoryChange(event: InventoryEvent): void {
  for (const subscriber of subscribers) {
    if (
      event.partnerId === null ||
      subscriber.user.role === "admin" ||
      subscriber.user.partnerId === event.partnerId
    ) {
      subscriber.send(event.topics);
    }
  }
}

export const realtimeModule = new Elysia().get(
  "/events",
  async ({ headers, request }) => {
    const user = await getAuthUser(headers);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    let subscriber: Subscriber;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let expires: ReturnType<typeof setTimeout> | undefined;
    const close = () => {
      if (heartbeat) clearInterval(heartbeat);
      if (expires) clearTimeout(expires);
      subscribers.delete(subscriber);
      request.signal.removeEventListener("abort", close);
    };

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        subscriber = {
          user,
          send(topics) {
            try {
              controller.enqueue(
                encoder.encode(`event: inventory\ndata: ${JSON.stringify({ topics })}\n\n`),
              );
            } catch {
              close();
            }
          },
        };
        subscribers.add(subscriber);
        controller.enqueue(encoder.encode("retry: 10000\nevent: ready\ndata: {}\n\n"));
        heartbeat = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(": heartbeat\n\n"));
          } catch {
            close();
          }
        }, 15_000);
        expires = setTimeout(() => {
          close();
          try {
            controller.close();
          } catch {
            // The browser may already have closed the connection.
          }
        }, 60 * 60_000);
        request.signal.addEventListener("abort", close, { once: true });
      },
      cancel: close,
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  },
);
