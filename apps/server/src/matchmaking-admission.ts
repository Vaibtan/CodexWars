import type { AdmissionControl, AdmissionOperation } from "./admission-control.js";
import type { OperationalApplication, OperationalJsonResponse } from "./operational.js";

export interface MatchmakingRequest {
  readonly headers?: Readonly<Record<string, string | readonly string[] | undefined>>;
  readonly method?: string;
  readonly socket?: { readonly remoteAddress?: string };
  readonly url?: string;
}

export function matchmakingOperation(method: string | undefined, url: string | undefined): AdmissionOperation | undefined {
  if (method !== "POST" || url === undefined) return undefined;
  const match = /^\/matchmake\/(create|join|joinById|joinOrCreate)\/([^/?]+)(?:[/?]|$)/u.exec(url);
  if (match === null) return undefined;
  if (match[1] !== "joinById" && match[2] !== "war") return undefined;
  return match[1] === "create" || match[1] === "joinOrCreate" ? "room" : "join";
}

export function resolveMatchmakingIp(request: MatchmakingRequest, trustProxy: boolean): string {
  if (!trustProxy) return request.socket?.remoteAddress ?? "unknown";
  const forwarded = request.headers?.["x-forwarded-for"];
  const candidate = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return candidate?.split(",", 1)[0]?.trim() || request.socket?.remoteAddress || "unknown";
}

export function registerMatchmakingAdmission(app: OperationalApplication, admission: AdmissionControl, trustProxy: boolean, now: () => number = Date.now): void {
  app.use((request: MatchmakingRequest, response: OperationalJsonResponse, next: () => void) => {
    const operation = matchmakingOperation(request.method, request.url);
    if (operation === undefined || admission.allow(operation, resolveMatchmakingIp(request, trustProxy), now())) {
      next();
      return;
    }
    response.status(429).json({ code: "RATE_LIMITED", message: "Request limit reached" });
  });
}
