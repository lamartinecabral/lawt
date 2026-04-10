import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getToolByName } from "../../src/tools/index.js";
import os from "node:os";
import path from "node:path";
import fs from "fs-extra";

describe("tool schema validation", () => {
  it("validates read_file requires path", () => {
    const tool = getToolByName("read_file")!;
    const result = tool.schema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("validates read_file accepts valid input", () => {
    const tool = getToolByName("read_file")!;
    const result = tool.schema.safeParse({ path: "foo.txt" });
    expect(result.success).toBe(true);
  });

  it("validates write_file requires path and content", () => {
    const tool = getToolByName("write_file")!;
    expect(tool.schema.safeParse({}).success).toBe(false);
    expect(tool.schema.safeParse({ path: "x" }).success).toBe(false);
    expect(tool.schema.safeParse({ path: "x", content: "y" }).success).toBe(true);
  });

  it("validates replace_in_file requires path, search, replace", () => {
    const tool = getToolByName("replace_in_file")!;
    expect(tool.schema.safeParse({}).success).toBe(false);
    expect(
      tool.schema.safeParse({ path: "a", search: "b", replace: "c" }).success,
    ).toBe(true);
  });

  it("validates glob_search requires pattern", () => {
    const tool = getToolByName("glob_search")!;
    expect(tool.schema.safeParse({}).success).toBe(false);
    expect(tool.schema.safeParse({ pattern: "**/*.ts" }).success).toBe(true);
  });
});

describe("replace_in_file behavior", () => {
  let sandbox: string;

  beforeEach(async () => {
    sandbox = await fs.mkdtemp(path.join(os.tmpdir(), "minicode-test-"));
  });

  afterEach(async () => {
    await fs.remove(sandbox);
  });

  it("replaces a single occurrence", async () => {
    const file = path.join(sandbox, "test.txt");
    await fs.writeFile(file, "hello world hello");

    const tool = getToolByName("replace_in_file")!;
    const result = await tool.execute(
      { path: "test.txt", search: "hello", replace: "hi", replaceAll: false },
      sandbox,
    );

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ replacements: 1 });
    const content = await fs.readFile(file, "utf-8");
    expect(content).toBe("hi world hello");
  });

  it("replaces all occurrences by default", async () => {
    const file = path.join(sandbox, "test.txt");
    await fs.writeFile(file, "aaa bbb aaa ccc aaa");

    const tool = getToolByName("replace_in_file")!;
    const result = await tool.execute(
      { path: "test.txt", search: "aaa", replace: "xxx" },
      sandbox,
    );

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ replacements: 3 });
    const content = await fs.readFile(file, "utf-8");
    expect(content).toBe("xxx bbb xxx ccc xxx");
  });

  it("returns error on no match", async () => {
    const file = path.join(sandbox, "test.txt");
    await fs.writeFile(file, "hello world");

    const tool = getToolByName("replace_in_file")!;
    const result = await tool.execute(
      { path: "test.txt", search: "xyz", replace: "abc" },
      sandbox,
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("No matches found");
  });

  it("supports regex replacement", async () => {
    const file = path.join(sandbox, "test.txt");
    await fs.writeFile(file, "foo123bar456baz");

    const tool = getToolByName("replace_in_file")!;
    const result = await tool.execute(
      { path: "test.txt", search: "\\d+", replace: "#", isRegex: true },
      sandbox,
    );

    expect(result.success).toBe(true);
    const content = await fs.readFile(file, "utf-8");
    expect(content).toBe("foo#bar#baz");
  });
});

describe("tool execution", () => {
  let sandbox: string;

  beforeEach(async () => {
    sandbox = await fs.mkdtemp(path.join(os.tmpdir(), "minicode-test-"));
  });

  afterEach(async () => {
    await fs.remove(sandbox);
  });

  it("write_file creates file with content", async () => {
    const tool = getToolByName("write_file")!;
    const result = await tool.execute(
      { path: "new-file.txt", content: "test content" },
      sandbox,
    );
    expect(result.success).toBe(true);
    const content = await fs.readFile(path.join(sandbox, "new-file.txt"), "utf-8");
    expect(content).toBe("test content");
  });

  it("write_file rejects overwrite when not allowed", async () => {
    await fs.writeFile(path.join(sandbox, "existing.txt"), "old");
    const tool = getToolByName("write_file")!;
    const result = await tool.execute(
      { path: "existing.txt", content: "new" },
      sandbox,
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain("overwrite");
  });

  it("list_dir lists directory contents", async () => {
    await fs.writeFile(path.join(sandbox, "a.txt"), "a");
    await fs.mkdir(path.join(sandbox, "subdir"));

    const tool = getToolByName("list_dir")!;
    const result = await tool.execute({ path: "." }, sandbox);
    expect(result.success).toBe(true);
    const items = result.data as Array<{ name: string; type: string }>;
    expect(items.find((i) => i.name === "a.txt")).toBeTruthy();
    expect(items.find((i) => i.name === "subdir")).toBeTruthy();
  });

  it("read_file reads line range", async () => {
    await fs.writeFile(path.join(sandbox, "lines.txt"), "line1\nline2\nline3\nline4\n");

    const tool = getToolByName("read_file")!;
    const result = await tool.execute(
      { path: "lines.txt", startLine: 2, endLine: 3 },
      sandbox,
    );
    expect(result.success).toBe(true);
    expect(result.data).toBe("line2\nline3");
  });

  it("blocks reading binary files", async () => {
    await fs.writeFile(path.join(sandbox, "image.png"), "fakepng");

    const tool = getToolByName("read_file")!;
    const result = await tool.execute({ path: "image.png" }, sandbox);
    expect(result.success).toBe(false);
    expect(result.error).toContain("binary");
  });

  it("blocks path traversal in tools", async () => {
    const tool = getToolByName("read_file")!;
    const result = await tool.execute({ path: "../../../etc/passwd" }, sandbox);
    expect(result.success).toBe(false);
    expect(result.error).toContain("escapes sandbox");
  });
});
