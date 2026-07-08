import { afterAll, describe, expect, test } from "bun:test";
import { chmod, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { writeConfig } from "../src/config.js";

const temporaryPaths: string[] = [];

afterAll(async () => {
  await Promise.all(temporaryPaths.map((path) => rm(path, { force: true, recursive: true })));
});

describe("@cli-blog/cli config security", () => {
  test("tightens permissions on existing config directories and files", async () => {
    const directory = await mkdtemp(join(tmpdir(), "cli-blog-config-"));
    temporaryPaths.push(directory);
    const path = join(directory, "config.json");
    await chmod(directory, 0o755);
    await writeFile(path, '{"apiKey":"old"}\n', { mode: 0o644 });

    await writeConfig({ apiKey: "<private-api-key>" }, path);

    expect((await stat(directory)).mode & 0o777).toBe(0o700);
    expect((await stat(path)).mode & 0o777).toBe(0o600);
  });
});
