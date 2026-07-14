// Purpose: Browser-storage adapter for prototype state; replace with Firebase Auth/Firestore later.
// Kept as a browser global so the prototype also works when opened directly from file://.
const read=(key,fallback)=>JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback));const write=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
window.OrganizerSessionStore={loadState:()=>({accepted:new Set(read('codexWarsAccepted',[])),rejected:new Set(read('codexWarsRejected',[])),session:read('codexWarsSession',null)}),saveRoster:(accepted,rejected)=>{write('codexWarsAccepted',[...accepted]);write('codexWarsRejected',[...rejected])},saveSession:session=>write('codexWarsSession',session)};
