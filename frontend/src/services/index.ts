import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { create } from "zustand";
import { MockService } from "./mock";
import type { AppState, Command, Role, Service } from "../types";
export const isHttp = import.meta.env.VITE_API_MODE === "http";
export const usePreferences = create<{
  role: Role;
  setRole: (role: Role) => void;
  reduced: boolean;
  setReduced: (v: boolean) => void;
  toast: string;
  notify: (s: string) => void;
}>((set) => ({
  role: "Administrator",
  setRole: (role) => set({ role }),
  reduced: false,
  setReduced: (reduced) => set({ reduced }),
  toast: "",
  notify: (toast) => set({ toast }),
}));
class HttpService implements Service {
  async request(path: string, body?: unknown): Promise<AppState> {
    const res = await fetch(`/api/v1${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionStorage.getItem("sonorescue-token") ?? ""}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const error = await res
        .json()
        .catch(() => ({ detail: "API unavailable" }));
      throw Error(
        typeof error.detail === "string"
          ? error.detail
          : "Request validation failed",
      );
    }
    return res.json();
  }
  snapshot() {
    return this.request("/state");
  }
  command(command: Command) {
    return this.request("/commands", command);
  }
}
export const service: Service = isHttp ? new HttpService() : new MockService();
export function useData() {
  return useQuery({
    queryKey: ["state"],
    queryFn: () => service.snapshot(),
    retry: 1,
  });
}
export function useAction() {
  const qc = useQueryClient();
  const { role, notify } = usePreferences();
  return useMutation({
    mutationFn: (command: Command) => service.command(command, role),
    onSuccess: (data) => {
      qc.setQueryData(["state"], data);
      notify("Environment updated. Action recorded in audit trail.");
    },
    onError: (e) => notify(e.message),
  });
}
