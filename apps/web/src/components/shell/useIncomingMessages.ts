"use client";

import { useEffect, useRef } from "react";
import { z } from "zod";
import { supabaseBrowser } from "@/lib/supabase";

const insertSchema = z.object({ id: z.string(), linkId: z.string(), senderId: z.string(), body: z.string() });
export type IncomingMessage = z.infer<typeof insertSchema>;

/**
 * Every new message to this doctor, live (Supabase Realtime on "Message").
 * RLS applies to Realtime too: only messages of his accepted links arrive.
 * The 3-second polling of the Messages tab stays as a fallback.
 */
export function useIncomingMessages(myId: string | null, onIncoming: (message: IncomingMessage) => void): void {
  const handler = useRef(onIncoming);
  useEffect(() => {
    handler.current = onIncoming;
  }, [onIncoming]);

  useEffect(() => {
    if (!myId) return;
    const supabase = supabaseBrowser();
    // Unique name per subscription: removeChannel is asynchronous (see useChat).
    const channel = supabase
      .channel(`inbox:${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "Message" }, (payload) => {
        const message = insertSchema.safeParse(payload.new);
        if (message.success && message.data.senderId !== myId) handler.current(message.data);
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [myId]);
}
