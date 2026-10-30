import { IndicatorsBoard } from "@/components/doctor/IndicatorsBoard";
import { doctorPage } from "@/lib/auth/server";
import { serviceContext } from "@/lib/demo";
import { getIndicators } from "@/lib/services/indicators";

export const dynamic = "force-dynamic";

/** spec §8: the brief's four indicators, then control rate and response time. */
export default async function IndicatorsPage() {
  const { viewer } = await doctorPage("/d/indicators");
  const indicators = await getIndicators(await serviceContext(), viewer, 8);
  return <IndicatorsBoard initial={indicators} />;
}
