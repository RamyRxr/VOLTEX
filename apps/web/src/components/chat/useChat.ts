"use client";

import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { supabaseBrowser } from "@/lib/supabase";

/**
 * Chat of one accepted link (spec §4.1.9): read and written directly in Supabase,
 * protected by RLS (only the patient and her doctor), live through Realtime.
 */

const messageSchema = z.object({
  id: z.string(),
  senderId: z.string(),
  body: z.string(),
  createdAt: z.string(),
});

export type ChatMessage = z.infer<typeof messageSchema>;

const HISTORY_LIMIT = 200;
const MAX_LENGTH = 2000;

const byTime = (a: ChatMessage, b: ChatMessage): number => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();

/** Adds a message once (own insert and Realtime echo carry the same id). */
const withMessage = (list: readonly ChatMessage[], message: ChatMessage): ChatMessage[] =>
  list.some((m) => m.id === message.id) ? [...list] : [...list, message].sort(byTime);

export function useChat(linkId: string, senderId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const supabase = supabaseBrowser();
    let active = true;

    void supabase
      .from("Message")
      .select("id, senderId, body, createdAt")
      .eq("linkId", linkId)
      .order("createdAt", { ascending: true })
      .limit(HISTORY_LIMIT)
      .then(({ data, error }) => {
        if (!active) return;
        const parsed = z.array(messageSchema).safeParse(data);
        if (error || !parsed.success) {
          setStatus("error");
          return;
        }
        setMessages(parsed.data);
        setStatus("ready");
      });

    const channel = supabase
      .channel(`chat:${linkId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "Message", filter: `linkId=eq.${linkId}` }, (payload) => {
        const parsed = messageSchema.safeParse(payload.new);
        if (parsed.success) setMessages((list) => withMessage(list, parsed.data));
      })
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [linkId]);

  const send = useCallback(
    async (text: string): Promise<boolean> => {
      const body = text.trim().slice(0, MAX_LENGTH);
      if (!body || !senderId) return false;
      const message: ChatMessage = { id: crypto.randomUUID(), senderId, body, createdAt: new Date().toISOString() };
      const { error } = await supabaseBrowser().from("Message").insert({ id: message.id, linkId, senderId, body });
      if (error) return false;
      setMessages((list) => withMessage(list, message));
      return true;
    },
    [linkId, senderId],
  );

  return { messages, status, send };
}
