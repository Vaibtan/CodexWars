import { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ArDemoScreen } from "./src/ar/ArDemoScreen";
import { ensureAnonymousFirebaseUser } from "./src/lib/firebase/client";
import { HomeScreen } from "./src/screens/HomeScreen";

type AppScreen = "home" | "ar-demo";

export default function App() {
  const [screen, setScreen] = useState<AppScreen>("home");

  useEffect(() => {
    ensureAnonymousFirebaseUser().catch((error: unknown) => {
      console.warn("Firebase anonymous sign-in is unavailable", error);
    });
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {screen === "home" ? (
        <HomeScreen onOpenArDemo={() => setScreen("ar-demo")} />
      ) : (
        <ArDemoScreen onExit={() => setScreen("home")} />
      )}
    </SafeAreaProvider>
  );
}
