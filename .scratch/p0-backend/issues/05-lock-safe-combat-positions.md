# 05 — Configure the combat cohort and lock safe positions

**What to build:** The organizer can define who participates in combat and configure the arena; combat participants can localize, lock safe marker-relative positions, and become ready while the organizer sees the authoritative layout.

**Blocked by:** 04 — Run the fixed quiz and award shields.

**Status:** ready-for-agent

- [ ] During lobby, the organizer can mark a participant quiz-only; the choice freezes when the quiz starts.
- [ ] Quiz-only participants still count toward 12-person capacity and quiz results but have no combat position and never block battle readiness.
- [ ] Arena radius accepts finite values from 3 through 6 metres and freezes after the first position lock.
- [ ] Final quiz reveal enters localization; configured arena plus all combat participants localized enters positioning.
- [ ] Only combat participants can report localization, lock/unlock a position, or set battle readiness.
- [ ] `lost` before countdown clears readiness without deleting an already locked server position.
- [ ] Position lock accepts finite marker-relative X/Z only when radial distance is at least 0.75 m, no greater than arena radius, and at least 1.5 m from every locked combat participant.
- [ ] A rejected position returns the typed reason plus a finite shortest correction vector and its magnitude; state remains unlocked.
- [ ] Unlock clears the position and readiness before countdown.
- [ ] Ready=true requires quiz completion, current localization, and a valid locked position.
- [ ] Schema state exposes all locked combat positions for the organizer minimap and no continuous pose/camera data.
- [ ] Integration tests cover every boundary, conflicting positions, correction details, quiz-only behavior, loss, unlock, and readiness.
