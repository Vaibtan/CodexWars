import { useState } from "react";
import { StatusBar } from "expo-status-bar";
import { HomeScreen } from "./src/screens/HomeScreen";
import { OrganizerDashboardScreen } from "./src/screens/OrganizerDashboardScreen";

export default function App() {
  const [role, setRole] = useState<"choose" | "organizer">("choose");

  return (
    <>
      <StatusBar style="light" />
      {role === "organizer" ? (
        <OrganizerDashboardScreen onReturnHome={() => setRole("choose")} />
      ) : (
        <HomeScreen onJoinAsOrganizer={() => setRole("organizer")} />
      )}
    </>
  );
}
