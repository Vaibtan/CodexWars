# CodexWars Pre-Deployment Backend TODO

**Status:** P0 complete; OpenAI-backed pre-deployment acceptance incomplete
**Last reviewed:** 2026-07-17
**Scope:** Backend work required after the completed P0 implementation and before the first hosted pilot. Deployment infrastructure itself is deliberately excluded.

The completed P0 tracker remains in [TODO.md](TODO.md) and must not be reopened. Product behavior and wire contracts remain authoritative in:

- [PRD.md](PRD.md)
- [BUILD_SPEC.md](BUILD_SPEC.md)
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [API_AND_REALTIME_SPEC.md](API_AND_REALTIME_SPEC.md)

This checklist records the agreed post-P0 change from a fixed programming quiz to server-generated general-knowledge and current-events quizzes. Any conflict with the authoritative documents must be resolved in PD-1 before implementation begins.

## Locked decisions

- Quiz content is general knowledge, current events, or a server-defined mixture; programming questions are no longer the product default.
- The server generates and validates the complete ten-question quiz before gameplay. It never generates a question while quiz or battle timers are running.
- Every participant in a round receives the same frozen questions, ordering, answer key, explanations, and scoring rules.
- Current-events content uses live web grounding and source evidence. Model training knowledge alone is not sufficient for time-sensitive facts.
- GPT-5.4 mini is the initial generation model. Production uses the pinned `gpt-5.4-mini-2026-03-17` snapshot until an explicit evaluated upgrade.
- Vercel AI SDK runs only in `apps/server`; the mobile app never imports it or receives `OPENAI_API_KEY`.
- The bundled programming template is replaced by a curated general-knowledge fallback so a round can still complete without an API key, internet access, or a successful model call.
- Generated questions, answer keys, source evidence, and review results remain private server state. Public state exposes only safe metadata and the active question projection.
- The first hosted deployment remains one Colyseus process. Database persistence, Redis Presence, horizontal scaling, and room recovery remain separate architectural decisions.

## Execution order

1. Revise the product and realtime contracts.
2. Introduce the quiz-preparation module and runtime schemas.
3. Replace the bundled programming fallback.
4. Add the OpenAI generation adapter and current-events grounding.
5. Integrate asynchronous preparation into `WarRoom` without weakening privacy or determinism.
6. Add public-host abuse, cost, configuration, and operational controls.
7. Complete pure domain tests, real-provider verification, and the pre-deployment gate.

## PD-1: Revise authoritative product and protocol documents

The previous documents required the fixed `programming-fundamentals-v1` template and no internet dependency. The authoritative documents have now been revised.

- [x] Replace the fixed programming-quiz product language with general-knowledge, current-events, and mixed content modes.
- [x] Define organizer-visible configuration: content mode, server-defined category, difficulty profile, and current-events recency window.
- [x] Initially expose category enums rather than an arbitrary free-text prompt.
- [x] Define the classroom-safety policy, prohibited topics, political-neutrality rules, geographic balance, and age/audience assumptions.
- [x] Define current-events eligibility: completed factual events only, an explicit lookback window, a freshness cutoff for still-developing stories, and at least two independent reputable sources.
- [x] Specify whether source links are organizer-only or shown to all clients after reveal. Sources must never expose the answer before reveal.
- [x] Define organizer preview, approval, regeneration limit, cancellation, and fallback UX.
- [x] Specify that `start_quiz` is unavailable while preparation is pending and becomes available after generated or fallback content is ready.
- [x] Define reset semantics: a rematch requires a newly prepared quiz unless an explicit reuse action is later approved.
- [x] Update error codes, public state, commands, events, privacy rules, room reset, reconnect behavior, and conformance cases in `API_AND_REALTIME_SPEC.md`.
- [x] Update the architecture diagrams and build milestones without making deployment or persistence part of this implementation slice.

### Acceptance criteria

- [x] PRD, build spec, architecture, API contract, and this checklist describe one consistent quiz lifecycle.
- [x] No authoritative document still claims that the programming template is the only P0/product quiz after the revision.
- [x] The offline fallback and hosted generation paths have identical gameplay, timing, privacy, and scoring semantics.

## PD-2: Deep quiz-preparation module

Create one deep module whose interface hides model calls, web grounding, evidence policy, retries, validation, and fallback selection from `WarRoom`.

```ts
interface QuizPreparation {
  prepare(request: QuizPreparationRequest, signal: AbortSignal): Promise<PreparedQuiz>;
}
```

- [x] Define `QuizPreparationRequest` with bounded enums and values only; do not accept raw prompt text from the client.
- [x] Define `PreparedQuiz` as an immutable validated template plus private provenance and a discriminated source of `generated` or `fallback`.
- [x] Make the module return domain results with stable failure reasons rather than leaking SDK exceptions.
- [x] Define an internal `QuizModelPort` for the true external model dependency.
- [x] Implement an OpenAI adapter whose public constructor accepts only a real server-side API key; do not expose an injectable fake AI SDK client.
- [x] Keep the bundled fallback inside the quiz-preparation implementation; `WarRoom` must not orchestrate fallback branches.
- [x] Inject `QuizPreparation` into room construction/dependencies instead of creating provider clients inside `WarRoom` or `QuizRun`.
- [x] Change `QuizRun` to consume its frozen `QuizTemplate`; remove direct imports of `PROGRAMMING_FUNDAMENTALS_V1` from the runtime engine.
- [x] Test behavior through the module interface rather than testing AI SDK implementation details.

### Acceptance criteria

- [x] `WarRoom` needs to know only how to request preparation, observe its domain result, and freeze the result for the current round.
- [x] Replacing OpenAI or the fallback implementation does not require editing `WarRoom`, `QuizRun`, or mobile code.
- [x] The default suite tests CodexWars-owned domain and room behavior without claiming to validate OpenAI behavior.

## PD-3: Quiz domain, schema, and protocol generalization

- [x] Replace literal `programming-fundamentals-v1` types and guards with bounded generated/fallback template identifiers.
- [x] Add `QuizContentMode`, category, difficulty-profile, generation-status, and safe provenance types to `packages/shared`.
- [x] Add runtime schemas for generation input and structured model output. Compile-time TypeScript types alone are insufficient.
- [x] Preserve exactly ten questions, four distinct options, one valid answer option, sequential ordering, and existing duration/scoring bands unless the product contract deliberately changes.
- [x] Add conservative maximum lengths for prompts, option labels, explanations, source titles, and URLs.
- [x] Reject empty, duplicated, trivially equivalent, or answer-revealing options.
- [x] Use server-generated opaque question/template IDs; never trust model-generated identifiers as authority.
- [x] Define public preparation states such as `unconfigured`, `generating`, `ready`, and `fallback_ready` without publishing prompts, answer keys, or evidence early.
- [x] Add organizer commands for configuring and requesting a quiz, with exact payload parsing, role checks, phase checks, round checks, deduplication, and rate limits.
- [x] Add stable failures for invalid quiz configuration, generation already running, generation limit reached, preparation unavailable, and quiz not ready.

### Acceptance criteria

- [x] Every new command, state projection, event, and error validates at runtime in shared code.
- [x] Unknown fields and out-of-range configuration values reject without starting a model request.
- [x] Existing clients fail through the documented protocol-version path rather than misreading the new state shape.

## PD-4: Curated offline general-knowledge fallback

- [x] Replace the bundled programming template with a reviewed ten-question general-knowledge template.
- [x] Cover a balanced set of stable categories without culturally narrow or ambiguous trivia.
- [x] Record human-reviewed answers and explanations in source control.
- [x] Validate the fallback at server startup with the same domain validator used for generated content.
- [x] Ensure the fallback contains no current-event claim that can become stale.
- [x] Keep fallback selection internal; clients receive only `fallback_ready` and safe template metadata.
- [x] Preserve the ability to boot, create a room, complete a round, and reset with no OpenAI configuration or internet access.

### Acceptance criteria

- [x] Removing `OPENAI_API_KEY` cannot prevent server readiness or a complete game round.
- [x] The fallback passes the same privacy, boundary, scoring, and reset tests as generated templates.

## PD-5: OpenAI structured generation adapter

- [x] Add and exactly pin compatible stable versions of `ai`, `@ai-sdk/openai`, and the selected runtime-schema package.
- [x] Read `OPENAI_API_KEY` only from server environment configuration and ensure it is ignored by Git and absent from every `EXPO_PUBLIC_*` value.
- [x] Use the pinned GPT-5.4 mini snapshot and make model changes an explicit evaluated configuration change.
- [x] Generate a bounded question buffer in one non-streaming structured-output request, review every candidate, and deterministically select exactly ten approved questions.
- [x] Version the generation prompt independently from the model snapshot and store both in private provenance.
- [x] Give the provider a hard timeout and propagate room disposal/reset cancellation through `AbortSignal`.
- [x] Retry at most once for explicitly transient upstream failures; do not retry refusals, invalid requests, or exhausted room budgets.
- [x] Normalize refusals, schema failures, timeouts, rate limits, authentication failures, and upstream availability errors into private domain outcomes.
- [x] Never log the API key, raw authorization headers, full provider response, hidden answer key, or participant data.
- [x] Keep provider-specific types inside the adapter.

### Acceptance criteria

- [x] A successful response produces a strongly typed candidate without unsafe casts crossing the module interface.
- [x] Every provider failure reaches a bounded fallback or terminal domain result within the configured preparation deadline.
- [x] OpenAI SDK details do not appear in shared or mobile packages.

## PD-6: General-knowledge and current-events quality pipeline

- [x] Apply deterministic structural validation before any semantic review.
- [x] Apply a separate semantic review pass that checks factual support, one unambiguous answer, explanation consistency, option plausibility, difficulty, duplication, and classroom suitability.
- [x] Require evidence for every generated factual claim: live web evidence for current events and either web or curated trusted-reference evidence for evergreen general knowledge.
- [x] Require at least two independent reputable sources for every current-events question.
- [x] Store canonical source URL, title, publisher/domain, retrieval time, and publication time when available.
- [x] Reject inaccessible sources, circular citations, user-generated rumor, opinion pieces used as fact, and sources outside the approved policy.
- [x] Reject current-events questions outside the configured lookback window or inside the developing-story cutoff.
- [x] Reject questions whose answer could change during the room's lifetime.
- [x] Reject graphic tragedy, active-conflict detail, targeted political persuasion, discriminatory framing, and unsafe material under the classroom policy.
- [x] Normalize Unicode and whitespace and run duplicate detection across prompts and answer choices before freezing.
- [x] Fall back when the buffer cannot supply exactly ten independently approved questions with the required content-mode and difficulty balance; never mix unverified candidates into a round.

### Acceptance criteria

- [x] Every accepted generated question has evidence and a completed review result in private state.
- [x] Current-events questions can be audited to their sources and generation timestamp.
- [x] Structured-output conformance alone is never treated as proof of factual correctness.

## PD-7: WarRoom lifecycle integration

- [x] Allow only the connected organizer in `lobby` to configure, generate, regenerate, approve, or cancel quiz preparation.
- [x] Permit at most one in-flight preparation per room.
- [x] Bind each request to `roomId`, `roundId`, and a server-generated preparation ID.
- [x] Ignore late completions after reset, room disposal, cancellation, or replacement by a newer preparation ID.
- [x] Treat command acknowledgement as acceptance of the preparation request, not completion of generation; publish completion through authoritative state/event transitions.
- [x] Freeze the validated template before `start_quiz` and prevent mutation until reset.
- [x] Preserve cohort freezing, deadlines, private answers, private running scores, reveal ordering, shield rewards, and transition into localization.
- [x] Expose source evidence only at the contract-approved reveal surface.
- [x] Reconnect organizers and participants to the current preparation/quiz state without restarting generation or exposing private data.
- [x] Abort in-flight work and clear private template/evidence/review state on room disposal.
- [x] Reset all generation state, quotas, preparation IDs, template data, evidence, and command-deduplication entries for the new round.
- [x] Ensure fallback readiness cannot deadlock quiz start or later phase progression.

### Acceptance criteria

- [x] Duplicate generation commands cannot create duplicate upstream requests or consume budget twice.
- [x] A stale asynchronous completion cannot mutate a new round.
- [x] No answer key, source-derived answer hint, provider payload, or review result appears in synchronized state before its approved reveal.
- [x] Gameplay after template freeze remains deterministic and makes no external API calls.

## PD-8: Hosted abuse and cost controls

Public hosting makes room creation and model-backed generation a billable attack surface even though P0 has no player accounts.

- [x] Add server-wide and per-room generation concurrency limits.
- [x] Add bounded organizer regeneration attempts per round.
- [x] Add trusted-proxy-aware per-IP throttles for room creation, room-code joins, and generation requests before the server is publicly reachable.
- [x] Add a configurable daily generation/search budget and a circuit breaker that switches new rooms to fallback when exhausted.
- [x] Bound provider input/output tokens, web-search calls, retry count, and total preparation duration.
- [x] Keep organizer input to allow-listed enums and short validated values; do not concatenate untrusted text into privileged prompt instructions.
- [x] Prevent room-code enumeration from triggering model calls.
- [x] Add secret-scanning coverage for OpenAI credentials and document immediate rotation after suspected exposure.
- [x] Redact quiz prompts, answers, sources, participant names, tokens, and coordinates from default operational logs.
- [x] Define retryability and player-facing messages without exposing provider names, billing state, dependency messages, or stack traces.

### Search reuse and retry accounting

- [x] Keep full generated-quiz caching disabled so every preparation still performs its own candidate generation, independent review, validation, and template-ID assignment.
- [x] Add a bounded, process-local evidence cache keyed by model snapshot, prompt version, trusted-source policy, quiz configuration, and a short UTC freshness bucket.
- [x] Coalesce identical in-flight evidence lookups so concurrent rooms share one hosted web search without sharing generated questions or cancellation fate.
- [x] Retry only transient candidate-generation failures. Reuse the acquired evidence and never repeat hosted web search as part of a candidate retry.
- [x] Keep AI SDK retries disabled so the application owns the complete retry budget.
- [x] Reserve the maximum permitted search charge before a fresh evidence lookup and retain that accounting when discovery or any later stage fails.
- [x] Attribute cached and coalesced evidence reuse as zero new search calls while preserving the server-owned evidence and retrieval timestamp used for validation.
- [x] Let zero-search cache reuse continue after the daily search quota is exhausted; reject only a fresh search reservation while the independent generation budget remains available.
- [x] Keep the cache size, TTL, and candidate retry limit in validated server configuration; cache state remains process-local and is cleared by restart.

### Acceptance criteria

- [x] An unauthenticated remote client cannot create unbounded OpenAI spend.
- [x] Exhausted generation limits degrade to the bundled fallback; exhausted search limits block fresh evidence lookup while allowing zero-search cache reuse.
- [x] Cost and abuse controls have deterministic tests with no wall-clock sleeps or network calls.
- [x] Two concurrent equivalent preparations perform one evidence discovery but produce independently validated Quiz Templates.
- [x] A transient candidate failure retries candidate generation without a second evidence discovery.
- [x] A failed fresh discovery and a failure after successful discovery both retain conservative search usage in fallback provenance and telemetry.

## PD-9: Configuration and operational readiness

- [x] Add one typed server configuration module for port, generation feature flag, model snapshot, timeouts, retry limit, concurrency, regeneration allowance, source policy, and budgets.
- [x] Validate configuration once at startup and fail clearly only for unsafe/invalid configuration; a missing OpenAI key disables generation and retains fallback readiness.
- [x] Extend readiness metadata with generation capability state without calling OpenAI from a health probe or making fallback-capable readiness depend on OpenAI availability.
- [x] Add redacted structured logs for preparation requested, generated, rejected by validation, fallback selected, cancelled, timed out, and budget exhausted.
- [x] Add counters and duration histograms for generation attempts, web-search use, validation rejection reasons, fallback rate, latency, and estimated tokens/cost.
- [x] Define graceful `SIGTERM` behavior: stop new admission/generation, abort provider calls, close active rooms with the documented session-ended behavior, and release room IDs.
- [x] Keep metrics/logging adapters optional and local for the first deployment; do not introduce a database or third-party analytics SDK in this slice.

### Acceptance criteria

- [x] Operators can distinguish generated, fallback, disabled, upstream-failed, validation-failed, and budget-exhausted outcomes without inspecting sensitive content.
- [x] Health/readiness endpoints remain bounded, deterministic, and independent of live upstream calls.

## PD-10: Tests and content evaluation

Follow TDD through the public module and room interfaces. CI must not spend money or require external availability.

### Module and contract tests

- [x] Schema boundaries: bounded internal candidate count, exactly ten selected questions, four options, lengths, enums, IDs, ordering, answers, evidence, provenance, and unknown fields.
- [x] General-knowledge and current-events policy boundaries, including recency and developing-story cutoffs.
- [x] Semantic rejection reasons: ambiguous answer, unsupported fact, explanation mismatch, duplicate question, unsafe content, and insufficient sources.
- [ ] Validate the production OpenAI adapter through real API calls. Mocked credentials, injected AI SDK clients, and canned provider responses are not accepted as provider evidence.
- [ ] Operationally exercise provider timeout, cancellation, authentication, rate-limit, malformed-output, and transient-failure handling without representing deterministic provider doubles as live evidence.

### WarRoom integration tests

- [x] Organizer-only configuration and generation authorization.
- [x] Request deduplication, one in-flight job, regeneration cap, per-room quota, and global concurrency behavior.
- [x] `start_quiz` rejection while unconfigured/generating and acceptance for generated or fallback readiness.
- [x] Stale completion after reset/disposal/cancellation cannot mutate state.
- [x] Freeze, reconnect, answer privacy, reveal evidence, completion, standings, and reset across generated and fallback templates.
- [x] Full round completion with generation disabled and the curated fallback.
- [ ] Full round completion with a quiz produced through the real OpenAI adapter.

### Evaluation and live verification

- [x] Create a versioned evaluation set covering every allowed category, difficulty profile, and content mode.
- [x] Define measurable acceptance thresholds for factual correctness, ambiguity, source quality, category balance, unsafe-content rate, latency, fallback rate, and estimated cost before live rollout.
- [ ] Review a representative live-provider sample manually and record only aggregate results after a server-side `OPENAI_API_KEY` is supplied.
- [x] Add an explicit real-provider acceptance command that fails fast without `OPENAI_API_KEY` and runs generation, review, and domain validation through the production adapter.
- [x] Force the default Vitest suite into fallback-only mode even when a developer has a real key in the root `.env`; only the explicit live-test command may load provider credentials.
- [x] Keep deterministic fixtures only for pure CodexWars validation policies; do not use them as evidence that an LLM or provider works.
- [x] Collect both final-message citations and hosted web-search action sources from the provider response; structured JSON does not reliably emit inline citation annotations.
- [x] Apply the production trusted-domain policy directly to provider web search and normalize only safe URL differences before attribution matching.
- [x] Replace model-echoed source URLs with a server-owned evidence catalog and model-selected source identifiers. Provider URLs are canonicalized once, assigned stable IDs, and resolved back to authoritative server-owned metadata after structured generation.
- [x] Remove model authority over content-mode question kinds, option ordering, and `answerIndex`; the server derives them deterministically from configuration, question order, one explicit correct answer, and three distractors.
- [x] Run a five-attempt live diagnostic matrix after the catalog redesign. `science-general` passed end to end at $0.0319. Mixed and current-events runs proved one-response search grounding, stable source IDs, deterministic answer placement, two sources per question, coded review failures, and bounded fallback; the final current-events run produced eight approved questions from twelve at $0.0482.
- [ ] Pass the final live-provider acceptance matrix after increasing the internal buffer to sixteen and enforcing server-side selection of ten questions with exactly three difficult questions and, for mixed mode, five current plus five evergreen. These changes address every observed five-run failure but were applied after the fifth authorized request and are not yet live-verified.

## PD-11: Pre-deployment definition of done

- [ ] PD-1 through PD-10 are complete after the live-provider sample above passes the locked evaluation thresholds.
- [ ] The server completes a full round using a quiz returned by the real OpenAI adapter.
- [x] The server completes a full round with generation disabled and the curated fallback.
- [ ] Real-provider failure behavior has been observed for the failure modes that can be safely reproduced before deployment.
- [x] The room state machine applies identical gameplay/privacy invariants to any approved frozen template, independent of its source.
- [ ] Representative real current-events output is grounded, manually reviewed, date-bounded, and source-backed.
- [x] No API key or provider credential appears in mobile bundles, synchronized state, logs, fixtures, or Git history introduced by this work.
- [x] Hosted-facing admission and generation limits prevent unbounded anonymous spend.
- [x] Root `npm run typecheck` passes.
- [x] Root `npm test` passes.
- [x] Existing deterministic twelve-combatant rehearsal still passes twice.
- [x] Documentation and implementation agree on content modes, preparation lifecycle, fallback, errors, reset, reconnect, privacy, and operational behavior.
- [x] Deployment selection, Docker/container configuration, TLS/WSS, domain/DNS, hosted secret provisioning, and physical hosted-device rehearsal are handed to the separate deployment checklist.

## Explicitly deferred beyond the first hosted pilot

These are valid roadmap items, not unfinished work in PD-1 through PD-11:

- Database-backed quiz banks, approval history, player accounts, analytics, and classroom reporting
- Room resurrection after process restart
- Redis Presence/Driver, multiple Colyseus processes, load balancing, and horizontal scaling
- Arbitrary organizer-authored prompts or document uploads
- Personalized/adaptive questions per participant, which would violate the current shared-round fairness model
- Minimap fallback protocol, spectator authorization, organizer moderation beyond quiz configuration, and tracking-pause workflows from M2
- Loadout economy, Fireball, teams, tournaments, and big-screen spectator presentation
- Deployment infrastructure and provider migration

## External implementation references

- [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [OpenAI web search](https://developers.openai.com/api/docs/guides/tools-web-search)
- [OpenAI API-key safety](https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety)
- [Vercel AI SDK structured data](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data)
- [Vercel AI SDK OpenAI provider](https://ai-sdk.dev/providers/ai-sdk-providers/openai)
