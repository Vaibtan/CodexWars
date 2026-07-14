<!-- Purpose: Architecture and integration guide for the Organizer prototype. -->
# Organizer prototype

This self-contained mobile HTML/CSS/JavaScript prototype is isolated from the landing page and participant UI.

## Screens and flow

`screens/dashboard.html` → `screens/waitlist.html` → `screens/quiz.html` → `screens/results.html` → `screens/battle.html`.

The dashboard creates a mock session. The waitlist accepts players before the quiz unlocks; the quiz proceeds through seven questions; results lead to the battle-ready roster.

## File map

- `screens/` — the five future React Native screens.
- `styles/base.css` — shared visual tokens and components.
- `styles/mobile.css` — phone viewport and single-column rules.
- `styles/animations.css` — reusable animations.
- `styles/session.css` — dashboard session-management components.
- `scripts/app.js` — shared UI behavior and per-screen initialization.
- `data/mock-data.js` — mock players, questions, and leaderboard data.
- `utils/session-store.js` — localStorage prototype state adapter.

## Firebase handoff

Replace `utils/session-store.js` with Firebase Auth/Firestore calls. Move session metadata, player acceptance state, questions, results, and battle state from `data/mock-data.js` into Firestore collections. `scripts/app.js` is the single integration point for those reads/writes.

## React Native handoff

Convert each file in `screens/` into a React Native Expo screen. Recreate the shared styles as tokens/components, and retain the data/store boundaries so Firebase logic remains separate from presentation.
