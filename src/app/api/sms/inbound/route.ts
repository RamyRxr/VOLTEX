import { serviceContext } from "@/lib/demo";
import { bearerOr, fail, handle, ok, secretMatches } from "@/lib/http";
import { handleInboundSms } from "@/lib/services/sms";
import { inboundSmsSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

async function readPayload(req: Request): Promise<unknown> {
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("application/json")) return req.json();
  return Object.fromEntries((await req.formData()).entries());
}

/**
 * Android SMS gateway webhook (spec §4.3). Shared secret in
 * `Authorization: Bearer …` or `x-gateway-token`. Replies with the text to
 * send back; the exact payload format depends on the gateway app (open question).
 */
export async function POST(req: Request) {
  return handle(async () => {
    const expected = process.env.SMS_GATEWAY_TOKEN;
    if (!expected) return fail(503, "NOT_CONFIGURED", "SMS gateway token not configured");
    if (!secretMatches(bearerOr(req, "x-gateway-token"), expected)) return fail(401, "UNAUTHORIZED", "Bad gateway token");

    const sms = inboundSmsSchema.parse(await readPayload(req));
    const outcome = await handleInboundSms(await serviceContext(), sms);
    return ok({ to: sms.from, reply: outcome.reply });
  });
}
