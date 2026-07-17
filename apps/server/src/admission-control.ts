export type AdmissionOperation = "generation" | "join" | "room";

export interface AdmissionControl {
  allow(operation: AdmissionOperation, ip: string, now: number): boolean;
}

export interface AdmissionControlOptions {
  readonly generationPerHour: number;
  readonly joinsPerMinute: number;
  readonly roomsPerHour: number;
}

interface WindowState {
  count: number;
  startedAt: number;
}

const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;
const MAX_TRACKED_KEYS = 10_000;

export function createAdmissionControl(options: AdmissionControlOptions): AdmissionControl {
  const windows = new Map<string, WindowState>();
  const policy = (operation: AdmissionOperation): { readonly limit: number; readonly windowMs: number } => {
    if (operation === "join") return { limit: options.joinsPerMinute, windowMs: MINUTE_MS };
    return { limit: operation === "room" ? options.roomsPerHour : options.generationPerHour, windowMs: HOUR_MS };
  };

  return {
    allow(operation, ip, now) {
      const { limit, windowMs } = policy(operation);
      if (limit === 0) return false;
      const key = `${operation}:${ip}`;
      let state = windows.get(key);
      if (state === undefined || now - state.startedAt >= windowMs) {
        state = { count: 0, startedAt: now };
        windows.set(key, state);
      }
      if (state.count >= limit) return false;
      state.count += 1;

      if (windows.size > MAX_TRACKED_KEYS) {
        for (const [candidateKey, candidate] of windows) {
          if (now - candidate.startedAt >= HOUR_MS) windows.delete(candidateKey);
        }
      }
      return true;
    }
  };
}
