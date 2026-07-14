import type { ImageSourcePropType } from "react-native";
import type { CharacterColorId, CharacterId } from "./types";

export type CharacterDefinition = {
  id: CharacterId;
  displayName: string;
  role: string;
  sources: Record<CharacterColorId, ImageSourcePropType>;
  scale: readonly [number, number, number];
};

export const characterCatalog: readonly CharacterDefinition[] = [
  {
    id: "knight",
    displayName: "Aegis",
    role: "Knight",
    sources: {
      gold: require("../../../../../assets/characters/runtime/knight-gold.glb"),
      coral: require("../../../../../assets/characters/runtime/knight-coral.glb"),
      aqua: require("../../../../../assets/characters/runtime/knight-aqua.glb"),
      violet: require("../../../../../assets/characters/runtime/knight-violet.glb"),
    },
    scale: [0.72, 0.72, 0.72],
  },
  {
    id: "ninja",
    displayName: "Kite",
    role: "Ninja",
    sources: {
      gold: require("../../../../../assets/characters/runtime/ninja-gold.glb"),
      coral: require("../../../../../assets/characters/runtime/ninja-coral.glb"),
      aqua: require("../../../../../assets/characters/runtime/ninja-aqua.glb"),
      violet: require("../../../../../assets/characters/runtime/ninja-violet.glb"),
    },
    scale: [0.72, 0.72, 0.72],
  },
  {
    id: "wizard",
    displayName: "Rune",
    role: "Wizard",
    sources: {
      gold: require("../../../../../assets/characters/runtime/wizard-gold.glb"),
      coral: require("../../../../../assets/characters/runtime/wizard-coral.glb"),
      aqua: require("../../../../../assets/characters/runtime/wizard-aqua.glb"),
      violet: require("../../../../../assets/characters/runtime/wizard-violet.glb"),
    },
    scale: [0.72, 0.72, 0.72],
  },
] as const;

export const characterColors: ReadonlyArray<{
  id: CharacterColorId;
  label: string;
  value: string;
}> = [
  { id: "gold", label: "Solar gold", value: "#FFCC4D" },
  { id: "coral", label: "Ember coral", value: "#FF6B7A" },
  { id: "aqua", label: "Arena aqua", value: "#5DE2D7" },
  { id: "violet", label: "Nova violet", value: "#B875FF" },
];

export function getCharacter(characterId: CharacterId): CharacterDefinition {
  return characterCatalog.find((character) => character.id === characterId) ?? characterCatalog[0];
}

export function getCharacterColor(colorId: CharacterColorId) {
  return characterColors.find((color) => color.id === colorId) ?? characterColors[0];
}

export function getCharacterSource(characterId: CharacterId, colorId: CharacterColorId) {
  return getCharacter(characterId).sources[colorId];
}
