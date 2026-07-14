import { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ArDemoScreen } from "./src/ar/ArDemoScreen";
import type { CharacterSelection } from "./src/features/characters/types";
import type { WarRoomSession } from "./src/features/warRoom/types";
import { useWarRoom } from "./src/features/warRoom/useWarRoom";
import { ensureAnonymousFirebaseUser } from "./src/lib/firebase/client";
import { createWarRoom, joinWarRoom, selectCharacter } from "./src/lib/firebase/warRooms";
import { CharacterCustomizationScreen } from "./src/screens/CharacterCustomizationScreen";
import { BattleResultsScreen } from "./src/screens/BattleResultsScreen";
import { ArCharacterTestScreen } from "./src/screens/ArCharacterTestScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { ParticipantBattleScreen } from "./src/screens/ParticipantBattleScreen";
import { ParticipantPlacementScreen } from "./src/screens/ParticipantPlacementScreen";
import { QuizWaitingScreen } from "./src/screens/QuizWaitingScreen";

type AppScreen =
  | "home"
  | "ar-character-test"
  | "quiz-waiting"
  | "ar-demo"
  | "character-customization"
  | "participant-placement"
  | "participant-battle"
  | "organizer-results"
  | "participant-results";

const initialSelection: CharacterSelection = {
  characterId: "knight",
  colorId: "gold",
};
const demoCorrectAnswers = 7;

export default function App() {
  const [screen, setScreen] = useState<AppScreen>("home");
  const [selection, setSelection] = useState<CharacterSelection>(initialSelection);
  const [session, setSession] = useState<WarRoomSession | null>(null);
  const [connectionBusy, setConnectionBusy] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const warRoom = useWarRoom(session);
  const localMember = session?.role === "participant" ? warRoom.room?.members[session.uid] : null;
  const correctAnswers = localMember?.correctAnswers ?? demoCorrectAnswers;

  useEffect(() => {
    ensureAnonymousFirebaseUser().catch((error: unknown) => {
      console.warn("Firebase anonymous sign-in is unavailable", error);
    });
  }, []);

  useEffect(() => {
    if (!session || !warRoom.room) return;
    if (session.role === "participant" && localMember?.quizCompleted && screen === "quiz-waiting") {
      setSelection(localMember.selection ?? initialSelection);
      setScreen("character-customization");
    }
    if (session.role === "participant" && warRoom.room.phase === "battle" && screen === "participant-placement") {
      setScreen("participant-battle");
    }
    if (warRoom.room.phase === "results" && screen === "participant-battle") setScreen("participant-results");
    if (warRoom.room.phase === "results" && screen === "ar-demo") setScreen("organizer-results");
  }, [localMember?.quizCompleted, screen, session, warRoom.room]);

  const leaveRoom = () => {
    setSession(null);
    setConnectionError(null);
    setScreen("home");
  };

  const handleCreateRoom = async (nickname: string) => {
    setConnectionBusy(true);
    setConnectionError(null);
    try {
      const nextSession = await createWarRoom(nickname);
      setSession(nextSession);
      setScreen("ar-demo");
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : String(error));
    } finally {
      setConnectionBusy(false);
    }
  };

  const handleJoinRoom = async (roomCode: string, nickname: string) => {
    setConnectionBusy(true);
    setConnectionError(null);
    try {
      const nextSession = await joinWarRoom(roomCode, nickname);
      setSession(nextSession);
      setScreen("quiz-waiting");
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : String(error));
    } finally {
      setConnectionBusy(false);
    }
  };

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {screen === "home" && (
        <HomeScreen
          busy={connectionBusy}
          error={connectionError}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          onTestAr={() => setScreen("ar-character-test")}
        />
      )}
      {screen === "ar-character-test" && <ArCharacterTestScreen onDone={() => setScreen("home")} />}
      {screen === "quiz-waiting" && session && (
        <QuizWaitingScreen connected={warRoom.connected} onLeave={leaveRoom} room={warRoom.room} session={session} />
      )}
      {screen === "character-customization" && session && warRoom.room && (
        <CharacterCustomizationScreen
          onBack={() => setScreen("quiz-waiting")}
          onNext={(nextSelection) => {
            void selectCharacter(session, warRoom.room!, nextSelection);
            setScreen("participant-placement");
          }}
          onSelectionChange={(nextSelection) => {
            setSelection(nextSelection);
            void selectCharacter(session, warRoom.room!, nextSelection).catch((error: unknown) => setConnectionError(error instanceof Error ? error.message : String(error)));
          }}
          selection={selection}
        />
      )}
      {screen === "participant-placement" && session && warRoom.room && (
        <ParticipantPlacementScreen
          correctAnswers={correctAnswers}
          onBack={() => setScreen("character-customization")}
          onReturnHome={leaveRoom}
          onStartBattle={() => setScreen("participant-battle")}
          room={warRoom.room}
          selection={selection}
          session={session}
        />
      )}
      {screen === "participant-battle" && session && warRoom.room && (
        <ParticipantBattleScreen
          correctAnswers={correctAnswers}
          onBattleComplete={() => setScreen("participant-results")}
          room={warRoom.room}
          selection={selection}
          session={session}
        />
      )}
      {screen === "ar-demo" && session && warRoom.room && (
        <ArDemoScreen
          onBattleComplete={() => setScreen("organizer-results")}
          onExit={leaveRoom}
          room={warRoom.room}
          session={session}
        />
      )}
      {screen === "organizer-results" && (
        <BattleResultsScreen
          onDone={leaveRoom}
          role="organizer"
          room={warRoom.room}
        />
      )}
      {screen === "participant-results" && (
        <BattleResultsScreen
          onDone={leaveRoom}
          role="participant"
          room={warRoom.room}
          selection={selection}
        />
      )}
    </SafeAreaProvider>
  );
}
