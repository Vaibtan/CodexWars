# CodexWars

**CodexWars** is a cross-platform multiplayer augmented-reality battle game built for the **OpenAI Codex Hackathon, Gurgaon**.

Players choose and customize a 3D character, place it in a shared AR arena, and join a live battle managed by an organizer. The experience is designed to run on both iPhone and Android devices using one React Native codebase.

## Aim

Our goal is to make a shared, social AR experience that is approachable to build and play: participants can personalize their characters, establish their position in the physical space, and take part in a real-time battle together.

## Team

- Shubhendu
- Ankit
- Vaibhav
- Mantavya

## Built with Codex

CodexWars was developed entirely with **OpenAI Codex** as a collaborative engineering partner. Every team member used Codex throughout the project.

We began by turning product ideas into Markdown documents, including the PRD, architecture, AR implementation plan, technical feasibility notes, and API contracts. Those documents became the shared source of context for Codex prompts; we then used Codex to scaffold the app, build features, write tests, integrate assets, and iterate on the implementation.

## Technology

- React Native with Expo SDK 54
- TypeScript
- Viro / ARKit / ARCore for AR and 3D rendering
- GLB character assets
- Firebase Realtime Database and Anonymous Authentication for planned hackathon live-room updates

## Project structure

```text
apps/
  mobile/       Expo / React Native app
  server/       Node.js services and game APIs
packages/
  shared/       Cross-platform game and protocol types
docs/           Product, AR, architecture, and implementation documentation
assets/         Optimized runtime 3D assets
```

## Getting started

Use Node.js 22.13 or newer:

```bash
npm install
npm run mobile
```

The AR experience uses native modules, so install a development build on the device; Expo Go cannot load the Viro integration. For device setup guidance, see [docs/PLATFORM_TESTING.md](docs/PLATFORM_TESTING.md).

## Submission

Built with Codex for the **OpenAI Codex Hackathon — Gurgaon**.
