import { CliBlogError } from "@cli-blog/node";

import { flagArray, flagString, type ParsedArgs } from "./args.js";

const now = "2026-06-17T12:00:00.000Z";
const organizationId = "org_demo";

const numberFlag = (args: ParsedArgs, key: string, fallback: number) => {
  const value = flagString(args.flags, key);
  if (value === undefined) return fallback;
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return number;
};

const idArg = (args: ParsedArgs, position = 2, fallback = "demo_123") => args.command[position] ?? fallback;

const localeFor = (args: ParsedArgs) => flagString(args.flags, "locale") ?? "en-US";

const bodyFor = (args: ParsedArgs) => {
  const body = flagString(args.flags, "body_markdown") ?? flagString(args.flags, "body");
  if (!body) return "## Launch-ready publishing\n\nThis demo post was generated locally by the Cli Blog CLI.";
  if (body.endsWith(".md") || body.includes("/")) {
    return `## Demo body\n\nThe real CLI would read ${body}. Demo mode stays offline and uses sample Markdown instead.`;
  }
  return body;
};

const list = <T>(data: T[], args: ParsedArgs) => ({
  object: "list" as const,
  data: data.slice(0, numberFlag(args, "limit", data.length)),
  has_more: false,
  next_cursor: null,
});

const author = (args: ParsedArgs, overrides: Record<string, unknown> = {}) => ({
  id: "demo_author_ada",
  object: "author",
  organization_id: organizationId,
  public_name: flagString(args.flags, "public_name") ?? flagString(args.flags, "name") ?? "Ada Lovelace",
  slug: flagString(args.flags, "slug") ?? "ada-lovelace",
  bio: flagString(args.flags, "bio") ?? "Writes clear launch notes for developer tools.",
  avatar_media_id: flagString(args.flags, "avatar_media_id") ?? "demo_media_avatar",
  avatar_url: "https://cdn.cli-blog.example/demo/ada.png",
  website_url: flagString(args.flags, "website_url") ?? "https://example.com/ada",
  metadata: {},
  created_at: now,
  updated_at: now,
  ...overrides,
});

const media = (args: ParsedArgs, overrides: Record<string, unknown> = {}) => ({
  id: "demo_media_cover",
  object: "media_asset",
  organization_id: organizationId,
  url: "https://cdn.cli-blog.example/demo/cover.png",
  original_filename: flagString(args.flags, "filename") ?? flagString(args.flags, "file") ?? args.command[2] ?? "cover.png",
  alt_text: flagString(args.flags, "alt_text") ?? "Demo cover image",
  caption: flagString(args.flags, "caption") ?? "Generated locally by demo mode.",
  mime_type: flagString(args.flags, "content_type") ?? "image/png",
  width: 1600,
  height: 900,
  size_bytes: 245760,
  metadata: {},
  created_at: now,
  updated_at: now,
  ...overrides,
});

const term = (args: ParsedArgs, kind: "category" | "tag", overrides: Record<string, unknown> = {}) => {
  const defaultName = kind === "category" ? "Product Updates" : "launch";
  const name = flagString(args.flags, "name") ?? defaultName;
  return {
    id: `demo_${kind}_${kind === "category" ? "product" : "launch"}`,
    object: "taxonomy_term",
    organization_id: organizationId,
    taxonomy_type: kind,
    parent_taxonomy_term_id: flagString(args.flags, "parent_taxonomy_term_id") ?? null,
    locale: localeFor(args),
    name,
    slug: flagString(args.flags, "slug") ?? name.toLowerCase().replaceAll(" ", "-"),
    description: flagString(args.flags, "description") ?? `${name} demo ${kind}.`,
    metadata: {},
    created_at: now,
    updated_at: now,
    seo_title: null,
    seo_description: null,
    canonical_url: null,
    focus_keyphrase: null,
    seo_keywords: [],
    robots_index: true,
    robots_follow: true,
    open_graph_title: null,
    open_graph_description: null,
    open_graph_media_asset_id: null,
    twitter_title: null,
    twitter_description: null,
    twitter_media_asset_id: null,
    schema_type: null,
    ...overrides,
  };
};

const post = (args: ParsedArgs, overrides: Record<string, unknown> = {}) => {
  const title = flagString(args.flags, "title") ?? "Shipping a developer-first blog workflow";
  const status = typeof overrides.status === "string" ? overrides.status : flagString(args.flags, "status") ?? "draft";
  const scheduledAt =
    typeof overrides.scheduled_at === "string"
      ? overrides.scheduled_at
      : flagString(args.flags, "scheduled_at") ?? flagString(args.flags, "at") ?? null;
  return {
    id: "demo_post_launch",
    object: "post",
    organization_id: organizationId,
    content_type: "blog_post",
    locale: localeFor(args),
    status,
    title,
    slug: flagString(args.flags, "slug") ?? "developer-first-blog-workflow",
    is_featured: true,
    excerpt: flagString(args.flags, "excerpt") ?? "A complete demo post returned without touching the network.",
    body_markdown: bodyFor(args),
    featured_media_asset_id: flagString(args.flags, "featured_media_asset_id") ?? "demo_media_cover",
    published_at: status === "published" ? now : null,
    scheduled_at: scheduledAt,
    version: 3,
    metadata: {},
    created_at: now,
    updated_at: now,
    seo_title: flagString(args.flags, "seo_title") ?? title,
    seo_description: flagString(args.flags, "seo_description") ?? "Demo SEO description.",
    canonical_url: flagString(args.flags, "canonical_url") ?? null,
    focus_keyphrase: flagString(args.flags, "focus_keyphrase") ?? null,
    seo_keywords: flagArray(args.flags, "seo_keywords") ?? ["cli-blog", "demo"],
    robots_index: true,
    robots_follow: true,
    open_graph_title: flagString(args.flags, "open_graph_title") ?? null,
    open_graph_description: flagString(args.flags, "open_graph_description") ?? null,
    open_graph_media_asset_id: flagString(args.flags, "open_graph_media_asset_id") ?? null,
    twitter_title: flagString(args.flags, "twitter_title") ?? null,
    twitter_description: flagString(args.flags, "twitter_description") ?? null,
    twitter_media_asset_id: flagString(args.flags, "twitter_media_asset_id") ?? null,
    schema_type: flagString(args.flags, "schema_type") ?? "Article",
    ...overrides,
  };
};

const xml = (kind: "sitemap" | "feed", args: ParsedArgs) => {
  const locale = localeFor(args);
  if (kind === "feed") {
    return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Cli Blog Demo</title><item><title>Demo post (${locale})</title><link>https://example.com/blog/demo-post</link></item></channel></rss>`;
  }
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://example.com/blog/demo-post</loc><lastmod>${now.slice(0, 10)}</lastmod></url></urlset>`;
};

const deleted = (id: string) => ({ deleted: true, id });

const runDemoPosts = (args: ParsedArgs) => {
  const action = args.command[1];
  if (action === "revisions") {
    const revisionAction = args.command[2];
    const postId = args.command[3] ?? "demo_post_launch";
    if (revisionAction === "list") {
      return list([
        {
          id: "demo_revision_1",
          object: "post_revision",
          parent_post_id: postId,
          title: "Earlier demo draft",
          version: 1,
          created_at: now,
          updated_at: now,
        },
      ], args);
    }
    if (revisionAction === "get") {
      return {
        id: args.command[4] ?? "demo_revision_1",
        object: "post_revision",
        parent_post_id: postId,
        title: "Earlier demo draft",
        version: 1,
        body_markdown: "## Earlier demo draft\n\nThis is a local revision snapshot.",
        created_at: now,
        updated_at: now,
      };
    }
  }
  if (action === "redirects" && args.command[2] === "get") {
    const fromSlug = args.command[3] ?? "old-demo-post";
    return {
      object: "slug_redirect",
      content_type: "blog_post",
      locale: localeFor(args),
      from_slug: fromSlug,
      to_slug: "developer-first-blog-workflow",
      post_id: "demo_post_launch",
      status_code: 301,
    };
  }
  if (action === "list") return list([post(args, { status: "published" }), post(args, { id: "demo_post_draft", status: "draft", title: "Draft demo post" })], args);
  if (action === "get") return post(args, { id: idArg(args) });
  if (action === "create") return post(args);
  if (action === "update") return post(args, { id: idArg(args), version: 4 });
  if (action === "publish") return post(args, { id: idArg(args), status: "published", published_at: flagString(args.flags, "published_at") ?? now });
  if (action === "schedule") return post(args, { id: idArg(args), status: "scheduled", scheduled_at: flagString(args.flags, "scheduled_at") ?? flagString(args.flags, "at") ?? "2026-06-18T16:00:00.000Z" });
  if (action === "delete") return post(args, { id: idArg(args), status: "archived" });
  throw new CliBlogError("Unknown posts command", { code: "unknown_command" });
};

const runDemoAuthors = (args: ParsedArgs) => {
  const action = args.command[1];
  if (action === "list") return list([author(args), author(args, { id: "demo_author_grace", public_name: "Grace Hopper", slug: "grace-hopper" })], args);
  if (action === "get") return author(args, { id: idArg(args) });
  if (action === "create" || action === "update") return author(args, { id: action === "update" ? idArg(args) : "demo_author_ada" });
  if (action === "delete") return deleted(idArg(args));
  throw new CliBlogError("Unknown authors command", { code: "unknown_command" });
};

const runDemoMedia = (args: ParsedArgs) => {
  const action = args.command[1];
  if (action === "list") return list([media(args)], args);
  if (action === "get") return media(args, { id: idArg(args) });
  if (action === "upload" || action === "update") return media(args, { id: action === "update" ? idArg(args) : "demo_media_cover" });
  if (action === "delete") return deleted(idArg(args));
  throw new CliBlogError("Unknown media command", { code: "unknown_command" });
};

const runDemoTaxonomy = (args: ParsedArgs, kind: "category" | "tag") => {
  const action = args.command[1];
  if (action === "list") return list([term(args, kind)], args);
  if (action === "get") return term(args, kind, { id: idArg(args) });
  if (action === "create" || action === "update") return term(args, kind, { id: action === "update" ? idArg(args) : `demo_${kind}_new` });
  if (action === "delete") return deleted(idArg(args));
  throw new CliBlogError(`Unknown ${kind === "category" ? "categories" : "tags"} command`, { code: "unknown_command" });
};

export const runDemo = (args: ParsedArgs): unknown => {
  const command = args.command[0];
  if (command === "posts") return runDemoPosts(args);
  if (command === "authors") return runDemoAuthors(args);
  if (command === "media") return runDemoMedia(args);
  if (command === "categories") return runDemoTaxonomy(args, "category");
  if (command === "tags") return runDemoTaxonomy(args, "tag");
  if (command === "locales" && args.command[1] === "list") {
    return [
      { tag: "en-US", name: "English (United States)", language: "English", region: "United States" },
      { tag: "es-MX", name: "Spanish (Mexico)", language: "Spanish", region: "Mexico" },
      { tag: "es-ES", name: "Spanish (Spain)", language: "Spanish", region: "Spain" },
    ];
  }
  if (command === "sitemap" && args.command[1] === "get") return xml("sitemap", args);
  if (command === "feed" && args.command[1] === "get") return xml("feed", args);
  throw new CliBlogError("Unknown command", { code: "unknown_command" });
};
