/* Temporary local profile store. Replace with Firebase Authentication later. */
(function(){const PROFILE_KEY='codexwars:profile';window.ProfileService={saveName(name){const profile={name:name.trim()};sessionStorage.setItem(PROFILE_KEY,JSON.stringify(profile));return profile},current(){try{return JSON.parse(sessionStorage.getItem(PROFILE_KEY)||'null')}catch{return null}}}})();
