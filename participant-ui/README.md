# CodexWars participant UI

Framework-free, portrait-first participant prototype. It is isolated from organizer screens.

## Run

Open `index.html` in a browser, or serve this folder with a static-file server.

## Demo onboarding flow

`Welcome → Enter Name → Join Meeting → Waiting for Organizer Approval`

The flow is rendered in place inside `index.html`. It uses hash navigation (`#welcome`, `#account`, `#join`, `#waiting`) so no screen transition reloads the browser.

## Temporary services

- `services/profile-service.js` stores the entered name in session storage.
- `services/meeting-service.js` stores the entered meeting code without validating it.

These are the only business-logic boundaries. They can later be replaced with Firebase services without changing the UI flow.

Existing quiz, battle-powers, results, and battle prototypes are retained separately and are not part of this temporary onboarding demo.
