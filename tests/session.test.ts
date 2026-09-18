import assert from "node:assert/strict";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { Session, sessionPath } from "../src/session.ts";

const originalHome = process.env.HOME;
const originalCwd = process.cwd();
let home = "";
let cwd = "";

describe("sessions", () => {
  beforeEach(async () => {
    home = await fsp.mkdtemp(path.join(os.tmpdir(), "lawt-session-home-"));
    cwd = await fsp.mkdtemp(path.join(os.tmpdir(), "lawt-session-cwd-"));
    process.env.HOME = home;
    process.chdir(cwd);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    await Promise.all([
      fsp.rm(home, { recursive: true, force: true }),
      fsp.rm(cwd, { recursive: true, force: true }),
    ]);
  });

  it("saves a new session only after a non-user response", () => {
    const session = new Session([{ role: "system", content: "rules" }]);
    session.push({ role: "user", content: "hello" });
    assert.strictEqual(fs.existsSync(sessionPath()), false);

    session.push({ role: "assistant", content: "hi" });
    assert.deepStrictEqual(
      fs
        .readFileSync(sessionPath(), "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line).role),
      ["system", "user", "assistant"],
    );
  });

  it("resumes valid messages and ignores invalid session files", () => {
    const first = new Session([]);
    first.push({ role: "assistant", content: "saved" });
    const resumed = new Session([{ role: "user", content: "new" }], true);
    assert.equal(resumed.resumed, true);
    assert.deepStrictEqual(resumed.messages, [
      { role: "assistant", content: "saved" },
    ]);

    fs.writeFileSync(sessionPath(), '{"role":"invalid"}\n');
    const fallback = new Session([{ role: "user", content: "fallback" }], true);
    assert.equal(fallback.resumed, false);
    assert.deepStrictEqual(fallback.messages, [
      { role: "user", content: "fallback" },
    ]);
  });
});
