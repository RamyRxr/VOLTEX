import { keepPreviousData, useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { CONFIG } from "@/lib/domain/config";
import type { AlertStatus } from "@/lib/domain/types";
import type { IndicatorsDto } from "@/lib/services/indicators";
import type { AlertDto, DoctorPatientView, MessageDto, PatientSelfView, TriageDto } from "@/lib/services/views";
import { apiGet, apiSend } from "./api";

export const keys = {
  triage: ["triage"] as const,
  doctorPatient: (id: string) => ["doctor-patient", id] as const,
  self: (id: string) => ["self", id] as const,
  alerts: (status: AlertStatus) => ["alerts", status] as const,
  indicators: (weeks: number) => ["indicators", weeks] as const,
};

/**
 * The server snapshot a page was rendered with can be newer than a cached poll
 * (e.g. back on the home screen right after sending a reading): show the newer.
 */
function withFreshest<T extends { readonly generatedAt: string }>(query: UseQueryResult<T>, initial: T | undefined): UseQueryResult<T> {
  const cached = query.data;
  if (!initial || (cached && Date.parse(cached.generatedAt) >= Date.parse(initial.generatedAt))) return query;
  return { ...query, data: initial } as UseQueryResult<T>;
}

/** Triage list, polled every second (spec §4.2). Shared by the page and the red banner. */
export function useTriage(initial?: TriageDto) {
  return withFreshest(useTriageQuery(initial), initial);
}

function useTriageQuery(initial?: TriageDto) {
  return useQuery({
    queryKey: keys.triage,
    queryFn: ({ signal }) => apiGet<TriageDto>("/api/prototype/triage", signal),
    refetchInterval: CONFIG.dashboardPollMs,
    refetchIntervalInBackground: true,
    initialData: initial,
  });
}

export function useDoctorPatient(id: string, initial: DoctorPatientView) {
  const query = useQuery({
    queryKey: keys.doctorPatient(id),
    queryFn: ({ signal }) => apiGet<DoctorPatientView>(`/api/patients/${encodeURIComponent(id)}`, signal),
    refetchInterval: CONFIG.dashboardPollMs,
    initialData: initial,
  });
  return withFreshest(query, initial);
}

export function useSelf(id: string, initial: PatientSelfView) {
  const query = useQuery({
    queryKey: keys.self(id),
    queryFn: ({ signal }) => apiGet<PatientSelfView>(`/api/patients/${encodeURIComponent(id)}`, signal),
    refetchInterval: CONFIG.patientPollMs,
    initialData: initial,
  });
  return withFreshest(query, initial);
}

export function useAlerts(status: AlertStatus, initial?: AlertDto[]) {
  return useQuery({
    queryKey: keys.alerts(status),
    queryFn: ({ signal }) => apiGet<AlertDto[]>(`/api/alerts?status=${status}`, signal),
    refetchInterval: CONFIG.dashboardPollMs,
    initialData: initial,
  });
}

export function useIndicators(weeks: number, initial?: IndicatorsDto) {
  return useQuery({
    queryKey: keys.indicators(weeks),
    queryFn: ({ signal }) => apiGet<IndicatorsDto>(`/api/indicators?weeks=${weeks}`, signal),
    initialData: initial,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

type AlertAction = { readonly id: string; readonly status: "ACKNOWLEDGED" | "CLOSED" };

/** Acknowledge / close, applied optimistically so the stage never waits for the next poll. */
export function useAlertAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: AlertAction) => apiSend<AlertDto>(`/api/alerts/${encodeURIComponent(id)}`, "PATCH", { status }),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: keys.triage });
      const before = qc.getQueryData<TriageDto>(keys.triage);
      if (before) {
        qc.setQueryData<TriageDto>(keys.triage, {
          ...before,
          openRedAlerts: before.openRedAlerts.filter((a) => a.id !== id),
          rows: before.rows.map((r) => (r.alert?.id === id ? { ...r, alert: { ...r.alert, status } } : r)),
        });
      }
      return { before };
    },
    onError: (_error, _vars, context) => {
      if (context?.before) qc.setQueryData(keys.triage, context.before);
    },
    onSettled: () => qc.invalidateQueries(),
  });
}

export function useSendMessage(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => apiSend<MessageDto>("/api/messages", "POST", { patientId, body }),
    onSettled: () => qc.invalidateQueries(),
  });
}
