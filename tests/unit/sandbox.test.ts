import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolveSandboxed, isBinaryPath } from "../../src/lib/sandbox.js";
import os from "node:os";
import path from "node:path";
import fs from "fs-extra";

describe("sandbox", () => {
  let sandbox: string;

  beforeEach(async () => {
    sandbox = await fs.mkdtemp(path.join(os.tmpdir(), "minicode-test-"));
  });

  afterEach(async () => {
    await fs.remove(sandbox);
  });

  it("resolves a relative path inside sandbox", () => {
    const resolved = resolveSandboxed("foo/bar.txt", sandbox);
    expect(resolved).toBe(path.join(sandbox, "foo", "bar.txt"));
  });

  it("resolves '.' to the sandbox root", () => {
    const resolved = resolveSandboxed(".", sandbox);
    // On macOS, /var → /private/var, so use realpath for comparison
    expect(resolved).toBe(fs.realpathSync(path.resolve(sandbox)));
  });

  it("blocks path traversal with ..", () => {
    expect(() => resolveSandboxed("../outside.txt", sandbox)).toThrow("Path escapes sandbox");
  });

  it("blocks absolute path outside sandbox", () => {
    expect(() => resolveSandboxed("/etc/passwd", sandbox)).toThrow("Path escapes sandbox");
  });

  it("blocks path traversal hidden in nested path", () => {
    expect(() => resolveSandboxed("foo/../../outside", sandbox)).toThrow("Path escapes sandbox");
  });

  it("allows absolute path inside sandbox", () => {
    const filePath = path.join(sandbox, "inner.txt");
    const resolved = resolveSandboxed(filePath, sandbox);
    expect(resolved).toBe(filePath);
  });

  it("blocks symlink escape", async () => {
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), "minicode-outside-"));
    const target = path.join(outside, "secret.txt");
    await fs.writeFile(target, "secret");

    const link = path.join(sandbox, "sneaky-link");
    await fs.symlink(target, link);

    expect(() => resolveSandboxed("sneaky-link", sandbox)).toThrow("Symlink escapes sandbox");
    await fs.remove(outside);
  });
});

describe("isBinaryPath", () => {
  it("detects binary extensions", () => {
    expect(isBinaryPath("image.png")).toBe(true);
    expect(isBinaryPath("archive.zip")).toBe(true);
    expect(isBinaryPath("app.exe")).toBe(true);
  });

  it("allows text extensions", () => {
    expect(isBinaryPath("README.md")).toBe(false);
    expect(isBinaryPath("file.ts")).toBe(false);
    expect(isBinaryPath("data.json")).toBe(false);
  });
});
