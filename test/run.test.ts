import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { run, runAndPrint } from "../src/index.js";

const originalFetch = globalThis.fetch;
const originalStdoutWrite = process.stdout.write;
const originalStderrWrite = process.stderr.write;
const temporaryPaths: string[] = [];

const jsonResponse = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
    status: init.status ?? 200,
  });

describe("@cli-blog/cli run", () => {
  afterEach(async () => {
    globalThis.fetch = originalFetch;
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
    await Promise.all(temporaryPaths.splice(0).map((path) => rm(path, { force: true, recursive: true })));
  });

  test("maps editorial flags into post create bodies", async () => {
    const requests: Array<{ input: URL | RequestInfo; init?: RequestInit }> = [];
    globalThis.fetch = async (input, init) => {
      requests.push({ init, input });
      return jsonResponse({
        content_type: "blog_post",
        id: "post_123",
        locale: "en-US",
        object: "post",
        organization_id: "org_123",
      });
    };

    await run({
      argv: [
        "posts",
        "create",
        "--title",
        "Hello",
        "--body",
        "# Hello",
        "--author-ids",
        "author_123",
        "--featured-media-asset-id",
        "media_123",
        "--media-asset-ids",
        "media_123,media_456",
        "--seo-title",
        "SEO Hello",
        "--robots-index=false",
      ],
      env: {
        CLI_BLOG_API_KEY: "<private-api-key>",
        CLI_BLOG_API_URL: "https://api.example.com",
      },
    });

    expect(String(requests[0]?.input)).toBe("https://api.example.com/v1/posts");
    expect(await new Response(requests[0]?.init?.body).json()).toMatchObject({
      author_profile_ids: ["author_123"],
      body_markdown: "# Hello",
      featured_media_asset_id: "media_123",
      media_asset_ids: ["media_123", "media_456"],
      robots_index: false,
      seo_title: "SEO Hello",
      title: "Hello",
    });
  });

  test("maps cursor and relation filters into post list queries", async () => {
    let requestUrl = "";
    globalThis.fetch = async (input) => {
      requestUrl = String(input);
      return jsonResponse({ data: [], has_more: false, next_cursor: null, object: "list" });
    };

    await run({
      argv: [
        "posts",
        "list",
        "--after",
        "cursor_123",
        "--author-match",
        "all",
        "--exclude-tag-slug",
        "internal,draft",
      ],
      env: { CLI_BLOG_API_KEY: "<public-api-key>", CLI_BLOG_API_URL: "https://api.example.com" },
    });

    expect(requestUrl).toContain("after=cursor_123");
    expect(requestUrl).toContain("author_match=all");
    expect(requestUrl).toContain("exclude_tag_slug=internal%2Cdraft");
  });

  test("maps numbered pagination into list queries without cursor defaults", async () => {
    const requests: string[] = [];
    globalThis.fetch = async (input) => {
      requests.push(String(input));
      return jsonResponse({
        data: [],
        has_more: true,
        next_cursor: "cursor_next",
        object: "list",
        page: 2,
        per_page: 5,
        total_items: 12,
        total_pages: 3,
      });
    };

    const commands = [
      ["posts", "list"],
      ["posts", "revisions", "list", "post_123"],
      ["authors", "list"],
      ["media", "list"],
      ["categories", "list"],
      ["tags", "list"],
    ];

    for (const command of commands) {
      const result = await run({
        argv: [...command, "--page", "2", "--per-page", "5"],
        env: { CLI_BLOG_API_KEY: "<public-api-key>", CLI_BLOG_API_URL: "https://api.example.com" },
      });
      expect(result).toMatchObject({ page: 2, per_page: 5, total_items: 12, total_pages: 3 });
    }

    expect(requests).toHaveLength(commands.length);
    for (const requestUrl of requests) {
      expect(requestUrl).toContain("page=2");
      expect(requestUrl).toContain("per_page=5");
      expect(requestUrl).not.toContain("limit=");
      expect(requestUrl).not.toContain("after=");
    }
  });

  test("rejects mixed cursor and numbered pagination before fetching", async () => {
    let attempts = 0;
    globalThis.fetch = async () => {
      attempts += 1;
      return jsonResponse({ data: [], has_more: false, next_cursor: null, object: "list" });
    };

    await expect(run({
      argv: ["posts", "list", "--page", "1", "--limit", "10"],
      env: { CLI_BLOG_API_KEY: "<public-api-key>", CLI_BLOG_API_URL: "https://api.example.com" },
    })).rejects.toMatchObject({
      code: "pagination_mode_conflict",
      param: "page",
    });
    await expect(run({
      argv: ["authors", "list", "--per-page", "10"],
      env: { CLI_BLOG_API_KEY: "<public-api-key>", CLI_BLOG_API_URL: "https://api.example.com" },
    })).rejects.toMatchObject({
      code: "validation_error",
      param: "per_page",
    });

    expect(attempts).toBe(0);
  });

  test("infers supported media content types from file extensions", async () => {
    const directory = await mkdtemp(join(tmpdir(), "cli-blog-media-"));
    temporaryPaths.push(directory);
    const path = join(directory, "cover.png");
    await writeFile(path, "png");
    let formData: FormData | undefined;
    globalThis.fetch = async (_input, init) => {
      formData = init?.body as FormData;
      return jsonResponse({ id: "media_123", object: "media_asset" });
    };

    await run({
      argv: ["media", "upload", path, "--alt", "Cover"],
      env: { CLI_BLOG_API_KEY: "<private-api-key>", CLI_BLOG_API_URL: "https://api.example.com" },
    });

    const file = formData?.get("file") as File | null;
    expect(file?.name).toBe("cover.png");
    expect(file?.type).toBe("image/png");
    expect(formData?.get("alt_text")).toBe("Cover");
  });

  test("supports revisions, redirects, sitemap, and author avatar media commands", async () => {
    const requests: Array<{ input: URL | RequestInfo; init?: RequestInit }> = [];
    globalThis.fetch = async (input, init) => {
      requests.push({ init, input });
      const path = String(input);
      if (path.includes("/v1/sitemap")) {
        return new Response("<urlset></urlset>", {
          headers: { "content-type": "application/xml" },
        });
      }
      if (path.includes("/v1/feed")) {
        return new Response("<rss></rss>", {
          headers: { "content-type": "application/rss+xml" },
        });
      }
      if (path.includes("/slug-redirects")) {
        return jsonResponse({
          content_type: "blog_post",
          from_slug: "old-slug",
          locale: "en-US",
          object: "slug_redirect",
          post_id: "post_123",
          status_code: 301,
          to_slug: "new-slug",
        });
      }
      if (path.includes("/revisions/rev_123")) {
        return jsonResponse({
          body_markdown: "# Snapshot",
          created_at: "2026-05-27T00:00:00.000Z",
          id: "rev_123",
          object: "post_revision",
          parent_post_id: "post_123",
          title: "Snapshot",
          updated_at: "2026-05-27T00:00:00.000Z",
          version: 2,
        });
      }
      if (path.includes("/revisions")) return jsonResponse({ data: [], object: "list" });
      return jsonResponse({
        avatar_media_id: "media_123",
        avatar_url: "https://cdn.example.com/avatar.png",
        bio: null,
        created_at: "2026-05-27T00:00:00.000Z",
        id: "author_123",
        metadata: {},
        object: "author",
        organization_id: "org_123",
        public_name: "Ada Lovelace",
        slug: "ada-lovelace",
        updated_at: "2026-05-27T00:00:00.000Z",
        website_url: null,
      });
    };

    await run({
      argv: ["authors", "create", "--public-name", "Ada Lovelace", "--avatar-media-id", "media_123"],
      env: { CLI_BLOG_API_KEY: "<private-api-key>", CLI_BLOG_API_URL: "https://api.example.com" },
    });
    await run({
      argv: ["posts", "revisions", "list", "post_123", "--locale", "en-US"],
      env: { CLI_BLOG_API_KEY: "<private-api-key>", CLI_BLOG_API_URL: "https://api.example.com" },
    });
    await run({
      argv: ["posts", "revisions", "get", "post_123", "rev_123"],
      env: { CLI_BLOG_API_KEY: "<private-api-key>", CLI_BLOG_API_URL: "https://api.example.com" },
    });
    await run({
      argv: ["posts", "redirects", "get", "old-slug", "--locale", "en-US"],
      env: { CLI_BLOG_API_KEY: "<private-api-key>", CLI_BLOG_API_URL: "https://api.example.com" },
    });
    const sitemap = await run({
      argv: ["sitemap", "get", "--limit", "100"],
      env: { CLI_BLOG_API_KEY: "<public-api-key>", CLI_BLOG_API_URL: "https://api.example.com" },
    });
    const feed = await run({
      argv: ["feed", "get", "--limit", "100"],
      env: { CLI_BLOG_API_KEY: "<public-api-key>", CLI_BLOG_API_URL: "https://api.example.com" },
    });

    expect(sitemap).toBe("<urlset></urlset>");
    expect(feed).toBe("<rss></rss>");
    expect(await new Response(requests[0]?.init?.body).json()).toMatchObject({
      avatar_media_id: "media_123",
      public_name: "Ada Lovelace",
    });
    expect(String(requests[1]?.input)).toContain("/v1/posts/post_123/revisions?");
    expect(String(requests[2]?.input)).toContain("/v1/posts/post_123/revisions/rev_123");
    expect(String(requests[3]?.input)).toContain("/v1/posts/slug-redirects/old-slug?");
    expect(String(requests[4]?.input)).toContain("/v1/sitemap?");
    expect(String(requests[5]?.input)).toContain("/v1/feed?");
  });

  test("demo mode returns offline responses for every public command family", async () => {
    globalThis.fetch = async () => {
      throw new Error("demo mode should not call fetch");
    };

    const commands = [
      ["posts", "list", "--demo", "--limit", "1"],
      ["posts", "get", "demo-post", "--demo"],
      ["posts", "create", "--demo", "--title", "Demo title", "--body", "# Demo"],
      ["posts", "update", "demo_post_launch", "--demo", "--title", "Updated"],
      ["posts", "publish", "demo_post_launch", "--demo"],
      ["posts", "schedule", "demo_post_launch", "--demo", "--at", "2026-06-18T16:00:00.000Z"],
      ["posts", "delete", "demo_post_launch", "--demo"],
      ["posts", "revisions", "list", "demo_post_launch", "--demo"],
      ["posts", "revisions", "get", "demo_post_launch", "demo_revision_1", "--demo"],
      ["posts", "redirects", "get", "old-demo-post", "--demo"],
      ["authors", "list", "--demo"],
      ["authors", "get", "demo_author_ada", "--demo"],
      ["authors", "create", "--demo", "--public-name", "Ada Lovelace"],
      ["authors", "update", "demo_author_ada", "--demo", "--bio", "Updated"],
      ["authors", "delete", "demo_author_ada", "--demo"],
      ["media", "list", "--demo"],
      ["media", "get", "demo_media_cover", "--demo"],
      ["media", "upload", "--demo", "--file", "/tmp/missing-demo-cover.png"],
      ["media", "update", "demo_media_cover", "--demo", "--alt-text", "Updated"],
      ["media", "delete", "demo_media_cover", "--demo"],
      ["categories", "list", "--demo"],
      ["categories", "get", "demo_category_product", "--demo"],
      ["categories", "create", "--demo", "--name", "News"],
      ["categories", "update", "demo_category_product", "--demo", "--name", "Updates"],
      ["categories", "delete", "demo_category_product", "--demo"],
      ["tags", "list", "--demo"],
      ["tags", "get", "demo_tag_launch", "--demo"],
      ["tags", "create", "--demo", "--name", "release"],
      ["tags", "update", "demo_tag_launch", "--demo", "--name", "shipping"],
      ["tags", "delete", "demo_tag_launch", "--demo"],
      ["locales", "list", "--demo"],
      ["sitemap", "get", "--demo"],
      ["feed", "get", "--demo"],
    ];

    for (const argv of commands) {
      const result = await run({ argv, env: {} });
      expect(result).toBeDefined();
    }
  });

  test("demo mode supports JSON printing without API credentials", async () => {
    let output = "";
    process.stdout.write = ((chunk: string | Uint8Array) => {
      output += String(chunk);
      return true;
    }) as typeof process.stdout.write;

    const exitCode = await runAndPrint(["posts", "create", "--demo", "--json", "--title", "Local demo"], {});

    expect(exitCode).toBe(0);
    expect(JSON.parse(output)).toMatchObject({
      id: "demo_post_launch",
      object: "post",
      title: "Local demo",
    });
  });

  test("demo mode preserves numbered list metadata", async () => {
    const result = await run({ argv: ["posts", "list", "--demo", "--page", "1", "--per-page", "2"], env: {} });

    expect(result).toMatchObject({
      data: expect.any(Array),
      object: "list",
      page: 1,
      per_page: 2,
      total_items: 3,
      total_pages: 2,
    });
  });

  test("prints version without requiring a command", async () => {
    expect(await run({ argv: ["--version"], env: {} })).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test("prints structured errors to stderr in JSON mode", async () => {
    let errorOutput = "";
    process.stderr.write = ((chunk: string | Uint8Array) => {
      errorOutput += String(chunk);
      return true;
    }) as typeof process.stderr.write;

    expect(await runAndPrint(["unknown", "--demo", "--json"], {})).toBe(1);
    expect(JSON.parse(errorOutput)).toEqual({
      error: {
        code: "unknown_command",
        message: "Unknown command",
      },
    });
  });

  test("keeps package and CLI versions synchronized", async () => {
    const packageJson = (await Bun.file(new URL("../package.json", import.meta.url)).json()) as { version: string };
    expect(await run({ argv: ["--version"], env: {} })).toBe(packageJson.version);
  });
});
