import { describe, expect, it } from "vitest";
import { createAdmissionControl } from "../src/admission-control.js";
import { matchmakingOperation, resolveMatchmakingIp } from "../src/matchmaking-admission.js";

describe("public admission controls", () => {
  it("applies independent fixed-window limits by IP and operation", () => {
    const admission = createAdmissionControl({ generationPerHour: 1, joinsPerMinute: 2, roomsPerHour: 1 });
    expect(admission.allow("room", "203.0.113.1", 0)).toBe(true);
    expect(admission.allow("room", "203.0.113.1", 1)).toBe(false);
    expect(admission.allow("join", "203.0.113.1", 1)).toBe(true);
    expect(admission.allow("join", "203.0.113.1", 2)).toBe(true);
    expect(admission.allow("join", "203.0.113.1", 3)).toBe(false);
    expect(admission.allow("generation", "203.0.113.1", 3_600_000)).toBe(true);
  });

  it("classifies matchmaking routes and trusts forwarding headers only when configured", () => {
    expect(matchmakingOperation("POST", "/matchmake/create/war")).toBe("room");
    expect(matchmakingOperation("POST", "/matchmake/joinById/0427")).toBe("join");
    const request = { headers: { "x-forwarded-for": "203.0.113.9, 10.0.0.1" }, socket: { remoteAddress: "127.0.0.1" } };
    expect(resolveMatchmakingIp(request, false)).toBe("127.0.0.1");
    expect(resolveMatchmakingIp(request, true)).toBe("203.0.113.9");
  });
});
