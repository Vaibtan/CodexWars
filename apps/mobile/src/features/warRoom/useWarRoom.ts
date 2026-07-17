import { useEffect, useState } from "react";
import type { WarRoomRealtimeClient } from "./realtimeClient";
import type { WarRoomSubscriptionState } from "./types";

const disconnectedState: WarRoomSubscriptionState = {
  connected: false,
  error: null,
  loading: false,
  quizPreview: null,
  room: null,
};

export function useWarRoom(client: WarRoomRealtimeClient | null): WarRoomSubscriptionState {
  const [state, setState] = useState<WarRoomSubscriptionState>(disconnectedState);

  useEffect(() => {
    if (client === null) {
      setState(disconnectedState);
      return;
    }
    return client.subscribe((snapshot) => {
      setState({
        connected: snapshot.connected,
        error: snapshot.error,
        loading: snapshot.loading,
        quizPreview: snapshot.quizPreview,
        room: snapshot.room,
      });
    });
  }, [client]);

  return state;
}
