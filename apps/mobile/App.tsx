import { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ArDemoScreen } from "./src/ar/ArDemoScreen";
import type { CharacterSelection, WaitingParticipant } from "./src/features/characters/types";
import { ensureAnonymousFirebaseUser } from "./src/lib/firebase/client";
import { CharacterCustomizationScreen } from "./src/screens/CharacterCustomizationScreen";
import { BattleResultsScreen } from "./src/screens/BattleResultsScreen";
import { HomeScreen } from "./src/screens/HomeScreen";
import { ParticipantBattleScreen } from "./src/screens/ParticipantBattleScreen";
import { ParticipantPlacementScreen } from "./src/screens/ParticipantPlacementScreen";

type AppScreen =
  | "home"
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
  const [waitingParticipant, setWaitingParticipant] = useState<WaitingParticipant | null>(null);

  useEffect(() => {
    ensureAnonymousFirebaseUser().catch((error: unknown) => {
      console.warn("Firebase anonymous sign-in is unavailable", error);
    });
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {screen === "home" && (
        <HomeScreen
          onOpenArDemo={() => setScreen("ar-demo")}
          onOpenParticipantSetup={() => setScreen("character-customization")}
        />
      )}
      {screen === "character-customization" && (
        <CharacterCustomizationScreen
          onBack={() => setScreen("home")}
          onNext={() => setScreen("participant-placement")}
          onSelectionChange={(nextSelection) => {
            setSelection(nextSelection);
            setWaitingParticipant(null);
          }}
          selection={selection}
        />
      )}
      {screen === "participant-placement" && (
        <ParticipantPlacementScreen
          onBack={() => setScreen("character-customization")}
          onReady={setWaitingParticipant}
          onReturnHome={() => setScreen("home")}
          onStartBattle={() => setScreen("participant-battle")}
          selection={selection}
        />
      )}
      {screen === "participant-battle" && (
        <ParticipantBattleScreen
          onBattleComplete={() => setScreen("participant-results")}
          selection={selection}
        />
      )}
      {screen === "ar-demo" && (
        <ArDemoScreen
          onBattleComplete={() => setScreen("organizer-results")}
          onExit={() => setScreen("home")}
          waitingParticipant={waitingParticipant}
        />
      )}
      {screen === "organizer-results" && (
        <BattleResultsScreen
          onDone={() => setScreen("home")}
          onRunAnotherRound={() => setScreen("ar-demo")}
          role="organizer"
        />
      )}
      {screen === "participant-results" && (
        <BattleResultsScreen
          onDone={() => setScreen("home")}
          role="participant"
          selection={selection}
        />
      )}
    </SafeAreaProvider>
  );
}
