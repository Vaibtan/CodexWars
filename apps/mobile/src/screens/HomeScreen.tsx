import { StyleSheet, Text, View } from "react-native";
import { APP_NAME, APP_TAGLINE } from "../config/app";

export function HomeScreen() {
  return (
    <View style={styles.screen}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>FIRST BUILD</Text>
      </View>
      <Text style={styles.title}>{APP_NAME}</Text>
      <Text style={styles.tagline}>{APP_TAGLINE}</Text>
      <Text style={styles.detail}>
        The Expo client is running. Lobby, quiz, shared AR arena, and battle
        features will attach here.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    alignItems: "center",
    backgroundColor: "#10162F",
    flex: 1,
    justifyContent: "center",
    padding: 32,
  },
  badge: {
    backgroundColor: "#FFCC4D",
    borderRadius: 999,
    marginBottom: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeText: {
    color: "#10162F",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 52,
    fontWeight: "800",
    letterSpacing: -1.5,
  },
  tagline: {
    color: "#AFC4FF",
    fontSize: 20,
    marginTop: 8,
  },
  detail: {
    color: "#D8E0FF",
    fontSize: 16,
    lineHeight: 24,
    marginTop: 32,
    maxWidth: 340,
    textAlign: "center",
  },
});
