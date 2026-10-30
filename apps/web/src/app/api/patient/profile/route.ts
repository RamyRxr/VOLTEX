import { profileInputSchema } from "shared";
import { authenticate } from "@/server/auth";
import { json, limitWrites, readBody, route } from "@/server/http";
import { saveProfile } from "@/server/patient";

export const dynamic = "force-dynamic";

/** Create or update the patient profile (with consent) → { risk }. */
export async function POST(req: Request) {
  return route(async () => {
    const { userId } = await authenticate(req);
    limitWrites("profile", userId);
    const input = await readBody(req, profileInputSchema);
    return json(await saveProfile(userId, input, new Date()));
  });
}
