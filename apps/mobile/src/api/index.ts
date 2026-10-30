import type { Api } from "./contract";
import { ENV } from "@/config/env";
import { httpApi } from "./http";
import { mockApi } from "./mock";

/** The single backend the screens talk to. Flip with EXPO_PUBLIC_API_URL / EXPO_PUBLIC_USE_MOCK. */
export const api: Api = ENV.useMock ? mockApi : httpApi;

export * from "./types";
