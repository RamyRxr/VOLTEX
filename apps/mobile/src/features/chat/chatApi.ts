import { z } from "zod";
import { networkError } from "@/api/errors";
import { supabase } from "@/auth/supabase";
import { randomUUID } from "@/lib/uuid";

/**
 * Chat straight on the Supabase "Message" table (docs/MOBILE-GUIDE.md): the conversation is the
 * accepted link, and RLS lets only the patient and her doctor read or write it.
 * A database row, not an API shape, so its schema lives here.
 */
const messageSchema = z.object({
  id: z.string(),
  linkId: z.string(),
  senderId: z.string(),
  body: z.string(),
  // Prisma DateTime is a Postgres timestamp without time zone, stored in UTC: mark it as such.
  createdAt: z.string().transform((s) => (/(Z|[+-]\d\d:?\d\d)$/i.test(s) ? s : `${s}Z`)),
});
export type ChatMessage = z.infer<typeof messageSchema>;

const COLUMNS = "id, linkId, senderId, body, createdAt";

export async function listMessages(linkId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase.from("Message").select(COLUMNS).eq("linkId", linkId).order("createdAt");
  if (error) throw networkError();
  return z.array(messageSchema).parse(data);
}

export async function sendMessage(linkId: string, senderId: string, body: string): Promise<ChatMessage> {
  const { data, error } = await supabase
    .from("Message")
    .insert({ id: randomUUID(), linkId, senderId, body: body.trim() })
    .select(COLUMNS)
    .single();
  if (error) throw networkError();
  return messageSchema.parse(data);
}

/** Live inserts in this conversation; returns the unsubscribe function. */
export function subscribeMessages(linkId: string, onMessage: (message: ChatMessage) => void): () => void {
  const channel = supabase
    .channel(`chat:${linkId}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "Message", filter: `linkId=eq.${linkId}` }, (payload) => {
      const message = messageSchema.safeParse(payload.new);
      if (message.success) onMessage(message.data);
    })
    .subscribe();
  return () => void supabase.removeChannel(channel);
}
