"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  alertSchema,
  alertsListSchema,
  CONFIG,
  conversationsSchema,
  draftAdviceSchema,
  inviteSchema,
  invitesSchema,
  linkRequestsSchema,
  meSchema,
  noteSchema,
  patientFileSchema,
  summarySchema,
  triageSchema,
} from "shared";
import { z } from "zod";
import { api } from "./api";

/** Server state of the dashboard; one hook per spec §8 route. */

export const keys = {
  me: ["me"] as const,
  triage: ["triage"] as const,
  file: (id: string) => ["file", id] as const,
  alerts: (status: string) => ["alerts", status] as const,
  requests: ["link-requests"] as const,
  conversations: ["conversations"] as const,
  invites: ["invites"] as const,
};

const POLL = CONFIG.dashboardPollMs;

export const useMe = () => useQuery({ queryKey: keys.me, queryFn: ({ signal }) => api("/api/me", meSchema, { signal }) });

/** Triage list, polled every 3 s (spec §4.2.3). */
export const useTriage = () =>
  useQuery({
    queryKey: keys.triage,
    queryFn: ({ signal }) => api("/api/doctor/patients", triageSchema, { signal }),
    refetchInterval: POLL,
  });

export const usePatientFile = (id: string) =>
  useQuery({
    queryKey: keys.file(id),
    queryFn: ({ signal }) => api(`/api/doctor/patients/${id}`, patientFileSchema, { signal }),
    refetchInterval: POLL,
  });

export type AlertFilter = "OPEN" | "ACKNOWLEDGED" | "CLOSED";

export const useAlerts = (status: AlertFilter) =>
  useQuery({
    queryKey: keys.alerts(status),
    queryFn: ({ signal }) => api(`/api/doctor/alerts?status=${status}`, alertsListSchema, { signal }),
    refetchInterval: POLL,
  });

export const useLinkRequests = () =>
  useQuery({
    queryKey: keys.requests,
    queryFn: ({ signal }) => api("/api/doctor/link-requests", linkRequestsSchema, { signal }),
    refetchInterval: POLL,
  });

/** Patients who wrote, most urgent first; drives the Messages tab and its counter. */
export const useConversations = () =>
  useQuery({
    queryKey: keys.conversations,
    queryFn: ({ signal }) => api("/api/doctor/conversations", conversationsSchema, { signal }),
    refetchInterval: POLL,
  });

export const useInvites = () =>
  useQuery({ queryKey: keys.invites, queryFn: ({ signal }) => api("/api/doctor/invites", invitesSchema, { signal }) });

export function useCreateInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api("/api/doctor/invites", inviteSchema, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.invites }),
  });
}

const decisionSchema = z.object({ status: z.enum(["ACCEPTED", "REFUSED"]) });

export function useDecideRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: "ACCEPT" | "REFUSE" }) =>
      api(`/api/doctor/link-requests/${id}`, decisionSchema, { method: "PATCH", body: { action } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.requests });
      void qc.invalidateQueries({ queryKey: keys.triage });
    },
  });
}

export function useAlertAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: "ACK" | "CLOSE" }) =>
      api(`/api/doctor/alerts/${id}`, alertSchema, { method: "PATCH", body: { action } }),
    onSuccess: (alert) => {
      void qc.invalidateQueries({ queryKey: ["alerts"] });
      void qc.invalidateQueries({ queryKey: keys.file(alert.patientId) });
      void qc.invalidateQueries({ queryKey: keys.triage });
    },
  });
}

/** New AI summary (spec §9.1); the file is refreshed to show the stored one. */
export function useGenerateSummary(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api(`/api/doctor/patients/${patientId}/summary`, summarySchema, { method: "POST", body: { refresh: true } }),
    onSuccess: (summary) => {
      if (summary.source === "AI") void qc.invalidateQueries({ queryKey: keys.file(patientId) });
    },
  });
}

/** Message suggestion for the chat (spec §9.2): the doctor edits it before sending. */
export const useDraftAdvice = (patientId: string) =>
  useMutation({ mutationFn: () => api(`/api/doctor/patients/${patientId}/draft-advice`, draftAdviceSchema, { method: "POST" }) });

export function useAddNote(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => api(`/api/doctor/patients/${patientId}/notes`, noteSchema, { method: "POST", body: { body } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.file(patientId) }),
  });
}
