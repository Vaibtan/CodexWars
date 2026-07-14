# 04 — Run the fixed quiz and award shields

**What to build:** An organizer can run the approved ten-question Programming Fundamentals quiz, participants can answer against server deadlines, and every participant receives a deterministic shield reward without persistence or answer-key leakage.

**Blocked by:** 02 — Create and join a nickname-only War Room.

**Status:** ready-for-agent

- [ ] The server bundles and validates the exact versioned ten-question template defined by the PRD, including IDs, order, four options, answer keys, explanations, tiers, and durations.
- [ ] Template validation fails startup/test initialization for duplicate IDs, missing answers, invalid options, wrong count, or unsupported duration/tier.
- [ ] The organizer can select only the bundled P0 template and start only from lobby with at least one participant.
- [ ] Starting freezes the quiz cohort and publishes only the current public question projection.
- [ ] Seven basic/intermediate questions run for 30 seconds, three difficult questions for 45 seconds, and every reveal runs for five seconds.
- [ ] Each participant receives at most one accepted answer per question strictly before the server deadline.
- [ ] Wrong-question, invalid-option, duplicate, malformed, and exact-deadline/late answers do not alter score.
- [ ] No synchronized state or pre-reveal event exposes an answer key or another participant’s selected option.
- [ ] Missing answers score zero; the server advances every question/reveal automatically without an organizer Next command.
- [ ] Scores 0–2/3–4/5–6/7–8/9–10 produce starting shields 0/10/20/30/40.
- [ ] Final reveal completion marks quiz completion and moves the room to localization without a database write.
- [ ] Integration tests use controlled server time to cover boundaries, privacy, missing answers, all reward bands, and phase transition.
