# CodexWars

**CodexWars** is a multiplayer learning experience built for the **OpenAI Codex Hackathon, Gurgaon**. It turns the end of a classroom lesson or workshop quiz into a shared, physical finale: participants earn battle advantages by answering questions correctly, then use those rewards in a short augmented-reality battle.

Think **Kahoot meets laser tag**—the quiz drives learning, and the AR battle makes progress feel immediate, social, and memorable.

## Problem statement

Quizzes are useful for checking understanding, but they often feel disconnected from what happens next. Scores appear, a leaderboard is shown, and the energy quickly disappears. Learners who fall behind may disengage, while facilitators have few ways to turn assessment into a shared experience that the whole room wants to complete.

CodexWars connects knowledge directly to play. Correct answers earn useful battle powers such as starting shields, giving learners an immediate reason to participate and improve. Quiz performance creates an advantage without guaranteeing victory, so the final activity remains inclusive, competitive, and exciting.

## Product

An organizer—such as a teacher or workshop facilitator—creates a room and shares a four-digit code. Participants join with a nickname, complete a quiz, and receive battle rewards based on their answers. They then scan a common floor marker, lock a safe position in the shared arena, and battle through their phone cameras using 3D characters and fantasy effects.

The complete experience is designed to:

- make quiz results immediately meaningful;
- increase participation and recall through a memorable reward loop;
- give educators a session they can organize in under 15 minutes;
- support Android and iPhone participants in the same room;
- encourage stationary, safely spaced play;
- protect learner privacy through nickname-only participation and no camera uploads.

The hackathon demo targets 3–4 physical devices, while the room model supports up to 12 participants and one non-combat organizer.

## Experience

1. The organizer creates a room and starts the quiz.
2. Participants answer questions and earn battle shields.
3. Everyone scans the same printed marker to establish a shared arena.
4. Participants lock their positions and wait for the organizer.
5. The organizer starts a synchronized 60-second AR battle.
6. Players see the final standings and can begin another learning round.

## Delivery status

The authoritative Colyseus backend, mobile realtime adapter, shared marker-space conversion, retained Viro scene, bundled character catalog, Android bundle, and ARM64 development APK build are implemented. Physical Android/iPhone M0 measurements and the complete mixed-platform M1 rehearsal are still open; see [`M0_RESULTS.md`](M0_RESULTS.md). A successful build does not prove shared physical alignment.

## Team

- Shubhendu
- Ankit
- Vaibhav
- Mantavya

## Built with Codex

CodexWars was developed entirely with **OpenAI Codex** as a collaborative product and engineering partner. Every team member used Codex throughout the project.

We began by turning the idea into Markdown documents and prompts, including the PRD, architecture, AR implementation plan, technical feasibility notes, and API contracts. Those documents became the shared source of context for Codex. We then built on top of them with Codex to scaffold the app, implement features, write tests, integrate 3D assets, troubleshoot device builds, and iterate on the product.

## Technology

- React Native with Expo SDK 54
- TypeScript
- Viro / ARKit / ARCore for AR and 3D rendering
- GLB character assets
- Colyseus 0.17 for the authoritative in-memory War Room and session authentication

## Specification map

Each decision has one authoritative home:

| Document | Owns |
|---|---|
| [`PRD.md`](PRD.md) | Product outcomes, roles, game rules, scope, and acceptance criteria |
| [`BUILD_SPEC.md`](BUILD_SPEC.md) | Pinned stack, development environment, repository shape, and milestone order |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Component boundaries, runtime flows, state ownership, and invariants |
| [`API_AND_REALTIME_SPEC.md`](API_AND_REALTIME_SPEC.md) | Exact P0 admission, synchronized state, commands, events, errors, and reconnect contract |
| [`docs/AR_IMPLEMENTATION_SPEC.md`](docs/AR_IMPLEMENTATION_SPEC.md) | Marker/pose adapter and GLB rendering/asset contract |
| [`CONTEXT.md`](CONTEXT.md) | Canonical domain terms used by the specifications and code |
| [`M0_RESULTS.md`](M0_RESULTS.md) | Physical marker-colocation acceptance results and remaining measurements |

Supporting evidence and procedures live in [`docs/TECHNICAL_FEASIBILITY.md`](docs/TECHNICAL_FEASIBILITY.md), [`docs/PLATFORM_TESTING.md`](docs/PLATFORM_TESTING.md), and [`docs/adr/`](docs/adr/). They do not override the specifications above.

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

Use Node.js 22.23.1:

```bash
npm install
npm run server
# In a second terminal:
npm run mobile
```

The AR experience uses native modules, so install a development build on the device; Expo Go cannot load the Viro integration. Print the [A4 arena marker](output/pdf/codexwars-arena-marker-a4.pdf) at 100% / Actual size and verify its black square is 180 mm wide. For device setup guidance, see [docs/PLATFORM_TESTING.md](docs/PLATFORM_TESTING.md).

## Submission

Built with Codex for the **OpenAI Codex Hackathon — Gurgaon**.
