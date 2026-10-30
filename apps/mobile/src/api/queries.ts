import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CONFIG } from "shared";
import { api } from "./index";
import type { Answers, PatientProfileInput, SessionInput } from "./types";
import { ME_KEY } from "@/auth/SessionProvider";

const DAY = 24 * 60 * 60 * 1000;

export const keys = {
  risk: ["risk"] as const,
  link: ["link"] as const,
  sessions: (days: number) => ["sessions", days] as const,
  questionnaires: (days: number) => ["questionnaires", days] as const,
  alerts: (status: "OPEN" | "ACKNOWLEDGED") => ["alerts", status] as const,
};

const sinceDays = (days: number) => new Date(Date.now() - days * DAY).toISOString();

export function useRisk() {
  return useQuery({ queryKey: keys.risk, queryFn: () => api.getRisk() });
}

export function useLink() {
  return useQuery({
    queryKey: keys.link,
    queryFn: () => api.getLink(),
    // Poll while the doctor has not answered, so the screen updates by itself.
    refetchInterval: (query) => (query.state.data?.status === "PENDING" ? 4_000 : false),
  });
}

export function useSessions(days: number) {
  return useQuery({ queryKey: keys.sessions(days), queryFn: () => api.listSessions({ from: sinceDays(days) }) });
}

export function useQuestionnaires(days: number) {
  return useQuery({ queryKey: keys.questionnaires(days), queryFn: () => api.listQuestionnaires({ from: sinceDays(days) }) });
}

export function useDoctorAlerts(status: "OPEN" | "ACKNOWLEDGED") {
  return useQuery({
    queryKey: keys.alerts(status),
    queryFn: () => api.listDoctorAlerts(status),
    refetchInterval: CONFIG.dashboardPollMs,
    refetchIntervalInBackground: false,
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
    mutationFn: (input: PatientProfileInput) => api.saveProfile(input),
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
    mutationFn: ({ id, action }: { id: string; action: "ACK" | "CLOSE" }) => api.updateDoctorAlert(id, action),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["alerts"] }),
  });
}
