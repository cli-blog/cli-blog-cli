import { access, readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import {
  CliBlog,
  CliBlogError,
  type CreatePostInput,
  type CreateTermInput,
  type Metadata,
  type PostFieldGroup,
  type PostInclude,
  type PostGetParams,
  type PostListParams,
  type RelationMatch,
  type SeoFields,
  type TermInclude,
  type UpdatePostInput,
  type UpdateTermInput,
} from "@cli-blog/node";

import { flagArray, flagBoolean, flagString, parseArgs, type ParsedArgs } from "./args.js";
import { maskKey, readConfig, writeConfig } from "./config.js";
import { runDemo } from "./demo.js";
import { help, print } from "./output.js";
import { CLI_BLOG_CLI_VERSION } from "./version.js";

type RunOptions = {
  argv: string[];
  env?: NodeJS.ProcessEnv;
};

const maybeReadFile = async (value: string | undefined) => {
  if (!value) return undefined;
  try {
    await access(value);
    return readFile(value, "utf8");
  } catch {
    return value;
  }
};

const parseJson = (value: string | undefined): Metadata | undefined => {
  if (!value) return undefined;
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new CliBlogError("Metadata must be a JSON object", { code: "invalid_metadata" });
  }
  return parsed as Metadata;
};

const flagNumber = (flags: ParsedArgs["flags"], key: string): number | undefined => {
  if (flags[key] === true) {
    throw new CliBlogError(`Missing --${key.replaceAll("_", "-")} value`, { code: "missing_flag_value", param: key });
  }
  const value = flagString(flags, key);
  if (value === undefined) return undefined;
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new CliBlogError(`Invalid --${key.replaceAll("_", "-")} number`, { code: "invalid_number", param: key });
  }
  return number;
};

const integerFlag = (flags: ParsedArgs["flags"], key: string, min: number, max: number) => {
  const value = flagNumber(flags, key);
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new CliBlogError(`--${key.replaceAll("_", "-")} must be an integer between ${min} and ${max}`, {
      code: "validation_error",
      param: key,
    });
  }
  return value;
};

const flagLimit = (flags: ParsedArgs["flags"]) => {
  const limit = flagNumber(flags, "limit");
  if (limit === undefined) return undefined;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new CliBlogError("--limit must be an integer between 1 and 100", { code: "validation_error", param: "limit" });
  }
  return limit;
};

const hasFlag = (flags: ParsedArgs["flags"], key: string) => flags[key] !== undefined;

const listPagination = (flags: ParsedArgs["flags"]) => {
  const cursorMode = hasFlag(flags, "after") || hasFlag(flags, "limit");
  const numberedMode = hasFlag(flags, "page") || hasFlag(flags, "per_page");

  if (cursorMode && numberedMode) {
    throw new CliBlogError("Do not combine --page/--per-page with --after/--limit", {
      code: "pagination_mode_conflict",
      param: hasFlag(flags, "page") ? "page" : "per_page",
    });
  }

  if (hasFlag(flags, "per_page") && !hasFlag(flags, "page")) {
    throw new CliBlogError("--per-page requires --page", { code: "validation_error", param: "per_page" });
  }

  if (numberedMode) {
    return compact({
      page: integerFlag(flags, "page", 1, 2147483647),
      per_page: integerFlag(flags, "per_page", 1, 100),
    });
  }

  return compact({
    after: flagString(flags, "after"),
    limit: flagLimit(flags),
  });
};

const flagEnum = <T extends string>(flags: ParsedArgs["flags"], key: string, values: readonly T[]): T | undefined => {
  const value = flagString(flags, key);
  if (value === undefined) return undefined;
  if (values.includes(value as T)) return value as T;
  throw new CliBlogError(`Invalid --${key.replaceAll("_", "-")}. Expected one of: ${values.join(", ")}`, {
    code: "invalid_option",
  });
};

const flagEnumArray = <T extends string>(flags: ParsedArgs["flags"], key: string, values: readonly T[]): T[] | undefined => {
  const items = flagArray(flags, key);
  if (!items) return undefined;
  for (const item of items) {
    if (!values.includes(item as T)) {
      throw new CliBlogError(`Invalid --${key.replaceAll("_", "-")} value ${item}. Expected: ${values.join(", ")}`, {
        code: "invalid_option",
      });
    }
  }
  return items as T[];
};

const flagMaybeBoolean = (flags: ParsedArgs["flags"], key: string): boolean | undefined => {
  const value = flags[key];
  if (value === undefined) return undefined;
  if (value === true) return true;
  if (value === false) return false;
  const text = Array.isArray(value) ? value.at(-1) : value;
  if (text === "true") return true;
  if (text === "false") return false;
  throw new CliBlogError(`Invalid --${key.replaceAll("_", "-")} boolean`, { code: "invalid_boolean" });
};

const compact = <T extends Record<string, unknown>>(value: T) =>
  Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as {
    [K in keyof T as undefined extends T[K] ? K : K]: Exclude<T[K], undefined>;
  };

const demoMode = (args: ParsedArgs) => flagBoolean(args.flags, "demo");

const contentTypesByExtension: Record<string, string> = {
  ".avif": "image/avif",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".key": "application/vnd.apple.keynote",
  ".mp4": "video/mp4",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".svg": "image/svg+xml",
  ".webm": "video/webm",
  ".webp": "image/webp",
};

const mediaContentType = (path: string, args: ParsedArgs) => {
  const explicit = flagString(args.flags, "content_type");
  if (explicit) return explicit;
  const inferred = contentTypesByExtension[extname(path).toLowerCase()];
  if (inferred) return inferred;
  throw new CliBlogError("Could not infer a supported media type. Pass --content-type explicitly.", {
    code: "missing_content_type",
  });
};

const clientFor = async (args: ParsedArgs, env: NodeJS.ProcessEnv = process.env) => {
  const saved = await readConfig();
  const apiKey = flagString(args.flags, "api_key") ?? env.CLI_BLOG_API_KEY ?? saved.apiKey;
  const apiUrl = flagString(args.flags, "api_url") ?? env.CLI_BLOG_API_URL ?? saved.apiUrl;

  if (!apiKey) {
    throw new CliBlogError("Missing API key. Run `cli-blog config set --api-key <key>` or set CLI_BLOG_API_KEY.", {
      code: "missing_api_key",
    });
  }

  return new CliBlog(compact({ apiKey, apiUrl }));
};

const confirm = async (message: string, args: ParsedArgs) => {
  if (flagBoolean(args.flags, "yes")) return;
  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question(`${message} Type "yes" to continue: `);
    if (answer !== "yes") throw new CliBlogError("Command canceled", { code: "canceled" });
  } finally {
    rl.close();
  }
};

const idArg = (args: ParsedArgs, position = 2) => {
  const id = args.command[position];
  if (!id) throw new CliBlogError("Missing resource ID or slug", { code: "missing_id" });
  return id;
};

const firstArrayFlag = (flags: ParsedArgs["flags"], ...keys: string[]) => {
  for (const key of keys) {
    const value = flagArray(flags, key);
    if (value) return value;
  }
  return undefined;
};

const firstStringFlag = (flags: ParsedArgs["flags"], ...keys: string[]) => {
  for (const key of keys) {
    const value = flagString(flags, key);
    if (value !== undefined) return value;
  }
  return undefined;
};

const seoBody = (args: ParsedArgs): SeoFields =>
  compact({
    canonical_url: flagString(args.flags, "canonical_url"),
    focus_keyphrase: flagString(args.flags, "focus_keyphrase"),
    open_graph_description: flagString(args.flags, "open_graph_description"),
    open_graph_media_asset_id: flagString(args.flags, "open_graph_media_asset_id"),
    open_graph_title: flagString(args.flags, "open_graph_title"),
    robots_follow: flagMaybeBoolean(args.flags, "robots_follow"),
    robots_index: flagMaybeBoolean(args.flags, "robots_index"),
    schema_type: flagString(args.flags, "schema_type"),
    seo_description: flagString(args.flags, "seo_description"),
    seo_keywords: flagArray(args.flags, "seo_keywords"),
    seo_title: flagString(args.flags, "seo_title"),
    twitter_description: flagString(args.flags, "twitter_description"),
    twitter_media_asset_id: flagString(args.flags, "twitter_media_asset_id"),
    twitter_title: flagString(args.flags, "twitter_title"),
  });

async function postBody(args: ParsedArgs, options: { requireTitle: true }): Promise<CreatePostInput>;
async function postBody(args: ParsedArgs, options?: { requireTitle?: false }): Promise<UpdatePostInput>;
async function postBody(
  args: ParsedArgs,
  options: { requireTitle?: boolean } = {},
): Promise<CreatePostInput | UpdatePostInput> {
  const title = flagString(args.flags, "title");
  if (options.requireTitle && !title) {
    throw new CliBlogError("Missing required --title", { code: "missing_title" });
  }

  return compact({
    ...seoBody(args),
    author_profile_ids: firstArrayFlag(args.flags, "author_profile_ids", "author_ids", "authors"),
    body_markdown: await maybeReadFile(flagString(args.flags, "body_markdown") ?? flagString(args.flags, "body")),
    category_ids: firstArrayFlag(args.flags, "category_ids", "categories"),
    excerpt: flagString(args.flags, "excerpt"),
    expected_version: flagNumber(args.flags, "expected_version"),
    featured_media_asset_id: flagString(args.flags, "featured_media_asset_id"),
    is_featured: flagMaybeBoolean(args.flags, "is_featured"),
    locale: flagString(args.flags, "locale"),
    metadata: parseJson(flagString(args.flags, "metadata")),
    published_at: flagString(args.flags, "published_at"),
    scheduled_at: flagString(args.flags, "scheduled_at"),
    slug: flagString(args.flags, "slug"),
    media_asset_ids: firstArrayFlag(args.flags, "media_asset_ids", "media_ids", "attachments"),
    status: flagEnum(args.flags, "status", ["draft", "in_review", "scheduled", "published", "archived"] as const),
    tag_ids: firstArrayFlag(args.flags, "tag_ids", "tags"),
    title,
    translation_of_id: flagString(args.flags, "translation_of_id"),
  });
}

function termBody(args: ParsedArgs, options: { requireName: true }): CreateTermInput;
function termBody(args: ParsedArgs, options?: { requireName?: false }): UpdateTermInput;
function termBody(args: ParsedArgs, options: { requireName?: boolean } = {}): CreateTermInput | UpdateTermInput {
  const name = flagString(args.flags, "name");
  if (options.requireName && !name) {
    throw new CliBlogError("Missing required --name", { code: "missing_name" });
  }

  return compact({
    ...seoBody(args),
    description: flagString(args.flags, "description"),
    locale: flagString(args.flags, "locale"),
    metadata: parseJson(flagString(args.flags, "metadata")),
    name,
    parent_taxonomy_term_id: flagString(args.flags, "parent_taxonomy_term_id"),
    slug: flagString(args.flags, "slug"),
    translation_of_id: flagString(args.flags, "translation_of_id"),
  });
}

const runConfig = async (args: ParsedArgs, env: NodeJS.ProcessEnv) => {
  if (args.command[1] !== "set") throw new CliBlogError("Unknown config command", { code: "unknown_command" });
  const saved = await readConfig();
  const apiKey = flagString(args.flags, "api_key") ?? env.CLI_BLOG_API_KEY ?? saved.apiKey;
  const apiUrl = flagString(args.flags, "api_url") ?? env.CLI_BLOG_API_URL ?? saved.apiUrl;
  if (!apiKey && !apiUrl) {
    throw new CliBlogError("Pass --api-key or --api-url to save configuration", { code: "missing_config" });
  }
  await writeConfig(compact({ apiKey, apiUrl }));
  return { api_key: apiKey ? maskKey(apiKey) : undefined, api_url: apiUrl, saved: true };
};

const runPosts = async (args: ParsedArgs, client: CliBlog) => {
  const action = args.command[1];
  if (action === "revisions") {
    const revisionAction = args.command[2];
    const postId = args.command[3];
    if (!postId) throw new CliBlogError("Missing post ID or slug", { code: "missing_id" });
    if (revisionAction === "list") {
      return client.posts.revisions.list(postId, compact({
        ...listPagination(args.flags),
        locale: flagString(args.flags, "locale"),
      }));
    }
    if (revisionAction === "get") {
      const revisionId = args.command[4];
      if (!revisionId) throw new CliBlogError("Missing revision ID", { code: "missing_revision_id" });
      return client.posts.revisions.get(postId, revisionId, compact({ locale: flagString(args.flags, "locale") }));
    }
    throw new CliBlogError("Unknown posts revisions command", { code: "unknown_command" });
  }
  if (action === "redirects") {
    if (args.command[2] !== "get") throw new CliBlogError("Unknown posts redirects command", { code: "unknown_command" });
    const slug = args.command[3];
    if (!slug) throw new CliBlogError("Missing redirect slug", { code: "missing_slug" });
    return client.posts.slugRedirects.get(slug, compact({ locale: flagString(args.flags, "locale") }));
  }
  if (action === "list") {
    return client.posts.list(compact({
      ...listPagination(args.flags),
      author_id: firstArrayFlag(args.flags, "author_id", "author_ids"),
      author_slug: firstArrayFlag(args.flags, "author_slug", "author_slugs"),
      author_match: flagEnum(args.flags, "author_match", ["any", "all"] as const) as RelationMatch | undefined,
      category_id: firstArrayFlag(args.flags, "category_id", "category_ids"),
      category_slug: firstArrayFlag(args.flags, "category_slug", "category_slugs"),
      category_match: flagEnum(args.flags, "category_match", ["any", "all"] as const),
      direction: flagEnum(args.flags, "direction", ["asc", "desc"] as const),
      exclude_author_id: firstArrayFlag(args.flags, "exclude_author_id", "exclude_author_ids"),
      exclude_author_slug: firstArrayFlag(args.flags, "exclude_author_slug", "exclude_author_slugs"),
      exclude_category_id: firstArrayFlag(args.flags, "exclude_category_id", "exclude_category_ids"),
      exclude_category_slug: firstArrayFlag(args.flags, "exclude_category_slug", "exclude_category_slugs"),
      exclude_tag_id: firstArrayFlag(args.flags, "exclude_tag_id", "exclude_tag_ids"),
      exclude_tag_slug: firstArrayFlag(args.flags, "exclude_tag_slug", "exclude_tag_slugs"),
      fields: flagEnumArray(args.flags, "fields", ["summary", "content", "seo", "workflow", "metadata"] as const) as PostFieldGroup[] | undefined,
      include: flagEnumArray(args.flags, "include", ["authors", "categories", "tags", "media", "translations"] as const) as PostInclude[] | undefined,
      is_featured: flagMaybeBoolean(args.flags, "is_featured"),
      locale: flagString(args.flags, "locale"),
      search: flagString(args.flags, "search"),
      sort: flagEnum(args.flags, "sort", ["published_at", "created_at", "updated_at", "relevance"] as const) as PostListParams["sort"],
      status: flagEnum(args.flags, "status", ["draft", "in_review", "scheduled", "published", "archived"] as const) as PostListParams["status"],
      tag_id: firstArrayFlag(args.flags, "tag_id", "tag_ids"),
      tag_slug: firstArrayFlag(args.flags, "tag_slug", "tag_slugs"),
      tag_match: flagEnum(args.flags, "tag_match", ["any", "all"] as const),
    }));
  }
  if (action === "get") return client.posts.get(idArg(args), compact({ fields: flagArray(args.flags, "fields") as PostGetParams["fields"], include: flagArray(args.flags, "include") as PostGetParams["include"], locale: flagString(args.flags, "locale") }));
  if (action === "create") return client.posts.create(await postBody(args, { requireTitle: true }));
  if (action === "update") return client.posts.update(idArg(args), await postBody(args), compact({ locale: flagString(args.flags, "locale") }));
  if (action === "publish") {
    return client.posts.publish(
      idArg(args),
      compact({
        expected_version: flagNumber(args.flags, "expected_version"),
        published_at: flagString(args.flags, "published_at"),
      }),
      compact({ locale: flagString(args.flags, "locale") }),
    );
  }
  if (action === "schedule") {
    const scheduledAt = flagString(args.flags, "scheduled_at") ?? flagString(args.flags, "at");
    if (!scheduledAt) throw new CliBlogError("Missing --scheduled-at or --at", { code: "missing_scheduled_at" });
    return client.posts.schedule(
      idArg(args),
      scheduledAt,
      compact({ expected_version: flagNumber(args.flags, "expected_version") }),
      compact({ locale: flagString(args.flags, "locale") }),
    );
  }
  if (action === "delete") {
    await confirm(`Delete post ${idArg(args)}?`, args);
    return client.posts.delete(idArg(args), compact({ locale: flagString(args.flags, "locale") }));
  }
  throw new CliBlogError("Unknown posts command", { code: "unknown_command" });
};

const runAuthors = async (args: ParsedArgs, client: CliBlog) => {
  const action = args.command[1];
  if (action === "list") return client.authors.list(listPagination(args.flags));
  if (action === "get") return client.authors.get(idArg(args));
  if (action === "create") {
    const publicName = flagString(args.flags, "public_name") ?? flagString(args.flags, "name");
    if (!publicName) throw new CliBlogError("Missing required --public-name", { code: "missing_public_name" });
    return client.authors.create(compact({
      avatar_media_id: flagString(args.flags, "avatar_media_id"),
      bio: flagString(args.flags, "bio"),
      metadata: parseJson(flagString(args.flags, "metadata")),
      member_id: flagString(args.flags, "member_id"),
      public_name: publicName,
      slug: flagString(args.flags, "slug"),
      website_url: flagString(args.flags, "website_url"),
    }));
  }
  if (action === "update") {
    return client.authors.update(idArg(args), compact({
      avatar_media_id: flagString(args.flags, "avatar_media_id"),
      bio: flagString(args.flags, "bio"),
      metadata: parseJson(flagString(args.flags, "metadata")),
      member_id: flagString(args.flags, "member_id"),
      public_name: flagString(args.flags, "public_name") ?? flagString(args.flags, "name"),
      slug: flagString(args.flags, "slug"),
      website_url: flagString(args.flags, "website_url"),
    }));
  }
  if (action === "delete") {
    await confirm(`Delete author ${idArg(args)}?`, args);
    return client.authors.delete(idArg(args));
  }
  throw new CliBlogError("Unknown authors command", { code: "unknown_command" });
};

const runMedia = async (args: ParsedArgs, client: CliBlog) => {
  const action = args.command[1];
  if (action === "list") return client.media.list(listPagination(args.flags));
  if (action === "get") return client.media.get(idArg(args));
  if (action === "upload") {
    const path = flagString(args.flags, "file") ?? args.command[2];
    if (!path) throw new CliBlogError("Missing --file path", { code: "missing_file" });
    const bytes = await readFile(path);
    return client.media.upload(compact({
      alt_text: firstStringFlag(args.flags, "alt_text", "alt"),
      caption: flagString(args.flags, "caption"),
      file: new Blob([bytes], { type: mediaContentType(path, args) }),
      filename: flagString(args.flags, "filename") ?? basename(path),
      metadata: parseJson(flagString(args.flags, "metadata")),
    }));
  }
  if (action === "update") {
    return client.media.update(idArg(args), compact({
      alt_text: firstStringFlag(args.flags, "alt_text", "alt"),
      caption: flagString(args.flags, "caption"),
      metadata: parseJson(flagString(args.flags, "metadata")),
    }));
  }
  if (action === "delete") {
    await confirm(`Delete media asset ${idArg(args)}?`, args);
    return client.media.delete(idArg(args));
  }
  throw new CliBlogError("Unknown media command", { code: "unknown_command" });
};

const runTaxonomy = async (args: ParsedArgs, client: CliBlog, kind: "categories" | "tags") => {
  const resource = client[kind];
  const action = args.command[1];
  if (action === "list") return resource.list(compact({ ...listPagination(args.flags), include: flagEnumArray(args.flags, "include", ["translations"] as const) as TermInclude[] | undefined, locale: flagString(args.flags, "locale") }));
  if (action === "get") return resource.get(idArg(args), compact({ include: flagEnumArray(args.flags, "include", ["translations"] as const), locale: flagString(args.flags, "locale") }));
  if (action === "create") return resource.create(termBody(args, { requireName: true }));
  if (action === "update") return resource.update(idArg(args), termBody(args), compact({ locale: flagString(args.flags, "locale") }));
  if (action === "delete") {
    await confirm(`Delete ${kind.slice(0, -1)} ${idArg(args)}?`, args);
    return resource.delete(idArg(args), compact({ locale: flagString(args.flags, "locale") }));
  }
  throw new CliBlogError(`Unknown ${kind} command`, { code: "unknown_command" });
};

const runSitemap = async (args: ParsedArgs, client: CliBlog) => {
  if (args.command[1] !== "get") throw new CliBlogError("Unknown sitemap command", { code: "unknown_command" });
  return client.sitemap.get(compact({
    limit: flagNumber(args.flags, "limit"),
    locale: flagString(args.flags, "locale"),
  }));
};

const runFeed = async (args: ParsedArgs, client: CliBlog) => {
  if (args.command[1] !== "get") throw new CliBlogError("Unknown feed command", { code: "unknown_command" });
  return client.feed.get(compact({
    limit: flagNumber(args.flags, "limit"),
    locale: flagString(args.flags, "locale"),
  }));
};

export const run = async ({ argv, env = process.env }: RunOptions): Promise<unknown> => {
  const args = parseArgs(argv);

  if (flagBoolean(args.flags, "version")) return CLI_BLOG_CLI_VERSION;
  if (!args.command.length || flagBoolean(args.flags, "help")) return help;
  if (args.command[0] === "config") return runConfig(args, env);
  if (demoMode(args)) return runDemo(args);

  const client = await clientFor(args, env);
  const command = args.command[0];

  if (command === "posts") return runPosts(args, client);
  if (command === "authors") return runAuthors(args, client);
  if (command === "media") return runMedia(args, client);
  if (command === "categories") return runTaxonomy(args, client, "categories");
  if (command === "tags") return runTaxonomy(args, client, "tags");
  if (command === "locales" && args.command[1] === "list") return client.locales.list();
  if (command === "sitemap") return runSitemap(args, client);
  if (command === "feed") return runFeed(args, client);

  throw new CliBlogError("Unknown command", { code: "unknown_command" });
};

export const runAndPrint = async (argv: string[], env: NodeJS.ProcessEnv = process.env) => {
  const args = parseArgs(argv);
  try {
    const result = await run({ argv, env });
    print(result, { json: flagBoolean(args.flags, "json") });
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (flagBoolean(args.flags, "json")) {
      const detail = error instanceof CliBlogError ? error : undefined;
      process.stderr.write(`${JSON.stringify({
        error: {
          code: detail?.code ?? "command_failed",
          message,
          param: detail?.param,
          request_id: detail?.requestId,
          status: detail?.status,
        },
      })}\n`);
    } else {
      const status = error instanceof CliBlogError && error.status ? ` (${error.status})` : "";
      process.stderr.write(`cli-blog: ${message}${status}\n`);
    }
    return 1;
  }
};
