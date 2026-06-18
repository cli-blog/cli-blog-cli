import { describe, expect, test } from "bun:test";

import { flagArray, flagBoolean, flagString, parseArgs } from "../src/args.js";

describe("@cli-blog/cli args", () => {
  test("parses commands and repeated flags", () => {
    const args = parseArgs(["posts", "list", "--fields", "summary", "--fields=content", "--json"]);

    expect(args.command).toEqual(["posts", "list"]);
    expect(flagArray(args.flags, "fields")).toEqual(["summary", "content"]);
    expect(flagBoolean(args.flags, "json")).toBe(true);
  });

  test("normalizes dashed flags", () => {
    const args = parseArgs(["authors", "create", "--public-name", "Ada Lovelace"]);

    expect(flagString(args.flags, "public_name")).toBe("Ada Lovelace");
  });

  test("parses demo flags as booleans", () => {
    const demo = parseArgs(["posts", "list", "--demo"]);
    const demoContent = parseArgs(["posts", "list", "--demo-content"]);

    expect(flagBoolean(demo.flags, "demo")).toBe(true);
    expect(flagBoolean(demoContent.flags, "demo_content")).toBe(true);
  });
});
