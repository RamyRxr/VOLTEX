import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CONFIG, type Answers, type ProfileInput, type SessionInput } from "shared";
import { ME_KEY } from "@/auth/SessionProvider";
import { ApiError, isApiError } from "./errors";
import { api } from "./http";

const DAY = 24 * 60 * 60 * 1000;

export const keys = {
  risk: ["risk"] as const,
  link: ["link"] as const,
  sessions: (days: number) => ["sessions", days] as const,
  questionnaires: (days: number) => ["questionnaires", days] as const,
  alerts: (status: "OPEN" | "ACKNOWLEDGED") => ["alerts", status] as const,
};

const sinceDays = (days: number) => new Date(Date.now() - days * DAY).toISOString();

/** The API lists newest first; the screens read oldest → newest. */
const oldestFirst = <T>(at: (row: T) => string) => (rows: T[]) =>
  [...rows].sort((a, b) => new Date(at(a)).getTime() - new Date(at(b)).getTime());

/** Client errors (4xx) will not change on retry. */
const retryServerErrors = (count: number, err: unknown) =>
  !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 1;

export function useRisk() {
  return useQuery({
    queryKey: keys.risk,
    // No estimate yet is a normal state, not an error.
    queryFn: () => api.getRisk().catch((err: unknown) => (isApiError(err, "NOT_FOUND") ? null : Promise.reject(err))),
    retry: retryServerErrors,
  });
}

export function useLink() {
  return useQuery({
    queryKey: keys.link,
    queryFn: () => api.getLink(),
    // Poll while the doctor has not answered, so the screen updates by itself.
    refetchInterval: (query) => (query.state.data?.status === "PENDING" ? 4_000 : false),
    retry: retryServerErrors,
  });
}

export function useSessions(days: number) {
  return useQuery({
    queryKey: keys.sessions(days),
    queryFn: () => api.listSessions({ from: sinceDays(days) }),
    select: oldestFirst((s) => s.takenAt),
    retry: retryServerErrors,
  });
}

export function useQuestionnaires(days: number) {
  return useQuery({
    queryKey: keys.questionnaires(days),
    queryFn: () => api.listQuestionnaires({ from: sinceDays(days) }),
    select: oldestFirst((q) => q.answeredAt),
    retry: retryServerErrors,
  });
}

export function useDoctorAlerts(status: "OPEN" | "ACKNOWLEDGED") {
  return useQuery({
    queryKey: keys.alerts(status),
    queryFn: () => api.doctor.listAlerts(status),
    refetchInterval: CONFIG.dashboardPollMs,
    refetchIntervalInBackground: false,
    retry: retryServerErrors,
  });
}

/** After new patient data, everything derived from it is stale. */
function useInvalidatePatientData() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: keys.risk });
    void queryClient.invalidateQueries({ queryKey: ["sessions"] });
    void queryClient.invalidateQueries({ queryKey: ["questionnaires"] });
  };
}

export function useAddSession() {
  const invalidate = useInvalidatePatientData();
  return useMutation({ mutationFn: (input: SessionInput) => api.addSession(input), onSuccess: invalidate });
}

export function useAddQuestionnaire() {
  const invalidate = useInvalidatePatientData();
  return useMutation({ mutationFn: (answers: Answers) => api.addQuestionnaire(answers), onSuccess: invalidate });
}

export function useSaveProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ProfileInput) => api.saveProfile(input),
    onSuccess: async ({ risk }) => {
      queryClient.setQueryData(keys.risk, risk);
      await queryClient.invalidateQueries({ queryKey: ME_KEY });
    },
  });
}

export function useSubmitLinkCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => api.submitLinkCode(code),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.link }),
  });
}

export function useUpdateAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: "ACK" | "CLOSE" }) => api.doctor.updateAlert(id, action),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["alerts"] }),
  });
}
