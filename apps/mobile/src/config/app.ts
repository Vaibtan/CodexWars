export const APP_NAME = "CodexWars";

export const APP_TAGLINE = "Quiz hard. Battle together.";

export function getRealtimeServerUrl(): string {
  const configured = process.env.EXPO_PUBLIC_REALTIME_SERVER_URL?.trim();
  return configured && configured.length > 0 ? configured : "http://127.0.0.1:4000";
}
