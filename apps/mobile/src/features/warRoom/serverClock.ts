import { useEffect, useRef, useState } from "react";

export type ServerClockAnchor = {
  observedLocalNow: number;
  serverNow: number;
};

export type ServerClockReading = {
  localNow: number;
  serverNow: number;
};

export function estimateServerNow(anchor: ServerClockAnchor, localNow: number): number {
  return anchor.serverNow + Math.max(0, localNow - anchor.observedLocalNow);
}

export function useServerClock(serverNow: number, tickIntervalMs: number): ServerClockReading {
  const [localNow, setLocalNow] = useState(Date.now);
  const anchor = useRef<ServerClockAnchor>({ observedLocalNow: localNow, serverNow });

  if (anchor.current.serverNow !== serverNow) {
    const observedLocalNow = Date.now();
    anchor.current = { observedLocalNow, serverNow };
  }

  useEffect(() => {
    const interval = setInterval(() => setLocalNow(Date.now()), tickIntervalMs);
    return () => clearInterval(interval);
  }, [tickIntervalMs]);

  return {
    localNow,
    serverNow: estimateServerNow(anchor.current, localNow),
  };
}
