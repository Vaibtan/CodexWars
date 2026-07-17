import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
const forbidden = [
  /sk-(?:proj-)?[A-Za-z0-9_-]{20,}/u,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u
];
const findings = tracked.filter((path) => {
  if (/\.(?:apk|glb|jpe?g|png)$/iu.test(path)) return false;
  const content = readFileSync(path, "utf8");
  return forbidden.some((pattern) => pattern.test(content));
});
if (findings.length > 0) {
  console.error(`Potential credential material found in: ${findings.join(", ")}`);
  process.exitCode = 1;
}
