import { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ArDemoScreen } from "./src/ar/ArDemoScreen";
import type { CharacterSelection } from "@codexwars/shared";
import {
  createOrganizerWarRoom,
  joinParticipantWarRoom,
  useWarRoom,
  type WarRoomRealtimeClient,
} from "./src/features/warRoom";
import { CharacterCustomizationScreen } from "./src/screens/CharacterCustomizationScreen";
import { BattleResultsScreen } from "./src/screens/BattleResultsScreen";
import { ArCharacterTestScreen } from "./src/screens/ArCharacterTestScreen";
import { DemoStoryScreen } from "./src/screens/DemoStoryScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { OrganizerDashboardScreen } from "./src/screens/OrganizerDashboardScreen";
import { ParticipantArenaScreen } from "./src/screens/ParticipantArenaScreen";
import { ParticipantQuizResultsScreen } from "./src/screens/ParticipantQuizResultsScreen";
import { ParticipantQuizScreen } from "./src/screens/ParticipantQuizScreen";
import { QuizWaitingScreen } from "./src/screens/QuizWaitingScreen";

type AppScreen =
  | "home"
  | "demo-story"
  | "ar-character-test"
  | "organizer-dashboard"
  | "quiz-waiting"
  | "participant-quiz"
  | "participant-quiz-results"
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

export default function App() {
  const [screen, setScreen] = useState<AppScreen>("home");
  const [selection, setSelection] = useState<CharacterSelection>(initialSelection);
  const [client, setClient] = useState<WarRoomRealtimeClient | null>(null);
  const [connectionBusy, setConnectionBusy] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const warRoom = useWarRoom(client);
  const session = client?.session ?? null;
  const localPlayer = session?.playerId ? warRoom.room?.players[session.playerId] : undefined;

  useEffect(() => {
    const room = warRoom.room;
    if (!session || !room) return;
    if (session.role === "participant" && room.phase === "quiz" && screen === "quiz-waiting") {
      setScreen("participant-quiz");
    }
    if (session.role === "participant" && room.phase === "localization" && screen === "participant-quiz") {
      setScreen("participant-quiz-results");
    }
    if (session.role === "organizer" && room.phase === "localization" && screen === "organizer-dashboard") {
      setScreen("ar-demo");
    }
    if (session.role === "participant" && (room.phase === "countdown" || room.phase === "battle") && screen === "participant-placement") {
      setScreen("participant-battle");
    }
    if (room.phase === "results" && screen === "participant-battle") setScreen("participant-results");
    if (room.phase === "results" && screen === "ar-demo") setScreen("organizer-results");
  }, [screen, session, warRoom.room]);

  const leaveRoom = () => {
    const activeClient = client;
    setClient(null);
    setConnectionError(null);
    setScreen("home");
    if (activeClient) void activeClient.dispose();
  };

  const handleCreateRoom = async (nickname: string) => {
    setConnectionBusy(true);
    setConnectionError(null);
    try {
      const nextClient = await createOrganizerWarRoom(nickname);
      setClient(nextClient);
      setScreen("organizer-dashboard");
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
      const nextClient = await joinParticipantWarRoom(roomCode, nickname);
      setClient(nextClient);
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
          onShowDemo={() => setScreen("demo-story")}
          onTestAr={() => setScreen("ar-character-test")}
        />
      )}
      {screen === "demo-story" && <DemoStoryScreen onDone={() => setScreen("home")} />}
      {screen === "ar-character-test" && <ArCharacterTestScreen onDone={() => setScreen("home")} />}
      {screen === "organizer-dashboard" && client && warRoom.room && (
        <OrganizerDashboardScreen client={client} connected={warRoom.connected} onLeave={leaveRoom} quizPreview={warRoom.quizPreview} room={warRoom.room} />
      )}
      {screen === "quiz-waiting" && session && (
        <QuizWaitingScreen connected={warRoom.connected} onLeave={leaveRoom} room={warRoom.room} session={session} />
      )}
      {screen === "participant-quiz" && client && warRoom.room && (
        <ParticipantQuizScreen client={client} onLeave={leaveRoom} room={warRoom.room} />
      )}
      {screen === "participant-quiz-results" && session?.playerId && warRoom.room && (
        <ParticipantQuizResultsScreen
          onContinue={() => {
            if (localPlayer?.characterId && localPlayer.characterId !== "default") {
              setSelection({ characterId: localPlayer.characterId, colorId: localPlayer.characterColorId });
            }
            setScreen("character-customization");
          }}
          onLeave={leaveRoom}
          participantId={session.playerId}
          room={warRoom.room}
        />
      )}
      {screen === "character-customization" && client && warRoom.room && (
        <CharacterCustomizationScreen
          onBack={() => setScreen("participant-quiz-results")}
          onNext={(nextSelection) => {
            setSelection(nextSelection);
            void client.send("select_character", nextSelection)
              .then(() => setScreen("participant-placement"))
              .catch((error: unknown) => setConnectionError(error instanceof Error ? error.message : String(error)));
          }}
          onSelectionChange={setSelection}
          selection={selection}
        />
      )}
      {(screen === "participant-placement" || screen === "participant-battle") && client && warRoom.room && (
        <ParticipantArenaScreen
          client={client}
          mode={screen === "participant-battle" ? "battle" : "positioning"}
          onBack={() => setScreen("character-customization")}
          onBattleComplete={() => setScreen("participant-results")}
          onReturnHome={leaveRoom}
          onStartBattle={() => setScreen("participant-battle")}
          room={warRoom.room}
          selection={selection}
        />
      )}
      {screen === "ar-demo" && client && warRoom.room && (
        <ArDemoScreen
          client={client}
          onBattleComplete={() => setScreen("organizer-results")}
          onExit={leaveRoom}
          room={warRoom.room}
        />
      )}
      {screen === "organizer-results" && (
        <BattleResultsScreen
          onDone={leaveRoom}
          onRunAnotherRound={client && warRoom.room ? () => {
            void client.send("reset_round", {}).then(() => setScreen("organizer-dashboard"));
          } : undefined}
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
