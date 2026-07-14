import { useEffect, useState } from "react";
import type { WarRoomSession, WarRoomSubscriptionState } from "./types";
import {
  markSessionConnected,
  startOrganizerAuthority,
  subscribeToFirebaseConnection,
  subscribeToWarRoom,
} from "../../lib/firebase/warRooms";

const initialState: WarRoomSubscriptionState = {
  connected: false,
  error: null,
  loading: true,
  room: null,
};

export function useWarRoom(session: WarRoomSession | null): WarRoomSubscriptionState {
  const [state, setState] = useState(initialState);

  useEffect(() => {
    if (!session) {
      setState({ ...initialState, loading: false });
      return;
    }

    setState(initialState);
    const unsubscribeConnection = subscribeToFirebaseConnection((connected) => {
      setState((current) => ({ ...current, connected }));
      if (connected) {
        markSessionConnected(session).catch((error: unknown) => {
          setState((current) => ({ ...current, error: error instanceof Error ? error : new Error(String(error)) }));
        });
      }
    });
    const unsubscribeRoom = subscribeToWarRoom(
      session.roomId,
      (room) => setState((current) => ({ ...current, loading: false, room })),
      (error) => setState((current) => ({ ...current, error, loading: false })),
    );
    const unsubscribeAuthority = startOrganizerAuthority(session, (error) => {
      setState((current) => ({ ...current, error }));
    });

    return () => {
      unsubscribeAuthority();
      unsubscribeConnection();
      unsubscribeRoom();
    };
  }, [session]);

  return state;
}
