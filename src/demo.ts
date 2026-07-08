import { CliBlogError } from "@cli-blog/node";

import { flagArray, flagString, type ParsedArgs } from "./args.js";

const now = "2026-06-17T12:00:00.000Z";
const organizationId = "org_demo";
const demoSite = "https://example.com/san-francisco-notes";

const numberFlag = (args: ParsedArgs, key: string, fallback: number) => {
  const value = flagString(args.flags, key);
  if (value === undefined) return fallback;
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return number;
};

const optionalNumberFlag = (args: ParsedArgs, key: string) => {
  const value = flagString(args.flags, key);
  if (value === undefined) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
};

const hasFlag = (args: ParsedArgs, key: string) => args.flags[key] !== undefined;

const idArg = (args: ParsedArgs, position = 2, fallback = "demo_123") => args.command[position] ?? fallback;

const localeFor = (args: ParsedArgs) => flagString(args.flags, "locale") ?? "en-US";

const bodyFor = (args: ParsedArgs) => {
  const body = flagString(args.flags, "body_markdown") ?? flagString(args.flags, "body");
  if (!body) {
    return "## Fog, hills, and neighborhoods\n\nSan Francisco is full of small details worth publishing: a quiet morning near the Ferry Building, a late coffee in the Mission, and the view of the bay when the fog finally opens.";
  }
  if (body.endsWith(".md") || body.includes("/")) {
    return `## San Francisco demo body\n\nThe real CLI would read ${body}. Demo mode stays offline and uses sample Markdown about San Francisco instead.`;
  }
  return body;
};

const list = <T>(data: T[], args: ParsedArgs) => {
  const cursorMode = hasFlag(args, "after") || hasFlag(args, "limit");
  const numberedMode = hasFlag(args, "page") || hasFlag(args, "per_page");

  if (cursorMode && numberedMode) {
    throw new CliBlogError("Do not combine --page/--per-page with --after/--limit", {
      code: "pagination_mode_conflict",
      param: hasFlag(args, "page") ? "page" : "per_page",
    });
  }

  if (hasFlag(args, "per_page") && !hasFlag(args, "page")) {
    throw new CliBlogError("--per-page requires --page", { code: "validation_error", param: "per_page" });
  }

  if (numberedMode) {
    const page = optionalNumberFlag(args, "page") ?? 1;
    const perPage = optionalNumberFlag(args, "per_page") ?? 20;
    const start = (page - 1) * perPage;
    const pageData = data.slice(start, start + perPage);
    const totalPages = data.length === 0 ? 0 : Math.ceil(data.length / perPage);
    return {
      object: "list" as const,
      data: pageData,
      has_more: page < totalPages,
      next_cursor: page < totalPages ? `demo_cursor_page_${page + 1}` : null,
      page,
      per_page: perPage,
      total_items: data.length,
      total_pages: totalPages,
    };
  }

  return {
    object: "list" as const,
    data: data.slice(0, numberFlag(args, "limit", data.length)),
    has_more: false,
    next_cursor: null,
  };
};

const author = (args: ParsedArgs, overrides: Record<string, unknown> = {}) => ({
  id: "demo_author_maya",
  object: "author",
  organization_id: organizationId,
  public_name: flagString(args.flags, "public_name") ?? flagString(args.flags, "name") ?? "Maya Chen",
  slug: flagString(args.flags, "slug") ?? "maya-chen",
  bio: flagString(args.flags, "bio") ?? "Writes field notes about San Francisco neighborhoods, food, parks, and builder culture.",
  avatar_media_id: flagString(args.flags, "avatar_media_id") ?? "demo_media_maya",
  avatar_url: "https://cdn.cli-blog.example/demo/san-francisco/maya.png",
  website_url: flagString(args.flags, "website_url") ?? `${demoSite}/authors/maya-chen`,
  metadata: {},
  created_at: now,
  updated_at: now,
  ...overrides,
});

const media = (args: ParsedArgs, overrides: Record<string, unknown> = {}) => ({
  id: "demo_media_bay_walk",
  object: "media_asset",
  organization_id: organizationId,
  url: "https://cdn.cli-blog.example/demo/san-francisco/bay-walk.png",
  original_filename: flagString(args.flags, "filename") ?? flagString(args.flags, "file") ?? args.command[2] ?? "bay-walk.png",
  alt_text: flagString(args.flags, "alt_text") ?? "Morning light over San Francisco Bay",
  caption: flagString(args.flags, "caption") ?? "A demo media asset for a San Francisco story.",
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
  const defaultName = kind === "category" ? "San Francisco" : "city-notes";
  const name = flagString(args.flags, "name") ?? defaultName;
  return {
    id: `demo_${kind}_${kind === "category" ? "san_francisco" : "city_notes"}`,
    object: "taxonomy_term",
    organization_id: organizationId,
    taxonomy_type: kind,
    parent_taxonomy_term_id: flagString(args.flags, "parent_taxonomy_term_id") ?? null,
    locale: localeFor(args),
    name,
    slug: flagString(args.flags, "slug") ?? name.toLowerCase().replaceAll(" ", "-"),
    description: flagString(args.flags, "description") ?? `${name} stories from local San Francisco demo content.`,
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
    schema_type: "CollectionPage",
    ...overrides,
  };
};

const post = (args: ParsedArgs, overrides: Record<string, unknown> = {}) => {
  const title = typeof overrides.title === "string" ? overrides.title : flagString(args.flags, "title") ?? "A developer's guide to San Francisco";
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
    slug: typeof overrides.slug === "string" ? overrides.slug : flagString(args.flags, "slug") ?? "developers-guide-to-san-francisco",
    is_featured: true,
    excerpt: flagString(args.flags, "excerpt") ?? "Fog, hills, neighborhoods, and the little builder rituals that make San Francisco memorable.",
    body_markdown: bodyFor(args),
    featured_media_asset_id: flagString(args.flags, "featured_media_asset_id") ?? "demo_media_bay_walk",
    media_asset_ids: flagArray(args.flags, "media_asset_ids") ?? ["demo_media_bay_walk"],
    published_at: status === "published" ? now : null,
    scheduled_at: scheduledAt,
    version: 3,
    metadata: {},
    created_at: now,
    updated_at: now,
    seo_title: flagString(args.flags, "seo_title") ?? title,
    seo_description: flagString(args.flags, "seo_description") ?? "A local demo story about parks, neighborhoods, and builder life in San Francisco.",
    canonical_url: flagString(args.flags, "canonical_url") ?? null,
    focus_keyphrase: flagString(args.flags, "focus_keyphrase") ?? null,
    seo_keywords: flagArray(args.flags, "seo_keywords") ?? ["san francisco", "city guide", "demo"],
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
    return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>San Francisco notes for builders</title><link>${demoSite}</link><description>Offline Cli Blog demo feed for ${locale}.</description><item><title>A developer's guide to San Francisco</title><link>${demoSite}/developers-guide-to-san-francisco</link><guid>demo_post_sf_guide</guid><description>Fog, hills, neighborhoods, and builder rituals.</description></item><item><title>The best parks in San Francisco</title><link>${demoSite}/best-parks-in-san-francisco</link><guid>demo_post_sf_parks</guid><description>A local parks guide for a quiet afternoon outside.</description></item></channel></rss>`;
  }
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${demoSite}/developers-guide-to-san-francisco</loc><lastmod>${now.slice(0, 10)}</lastmod></url><url><loc>${demoSite}/best-parks-in-san-francisco</loc><lastmod>${now.slice(0, 10)}</lastmod></url></urlset>`;
};

const deleted = (id: string) => ({ deleted: true, id });

const runDemoPosts = (args: ParsedArgs) => {
  const action = args.command[1];
  if (action === "revisions") {
    const revisionAction = args.command[2];
    const postId = args.command[3] ?? "demo_post_sf_guide";
    if (revisionAction === "list") {
      return list([
        {
          id: "demo_revision_1",
          object: "post_revision",
          parent_post_id: postId,
          title: "Draft: A developer's guide to San Francisco",
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
        title: "Draft: A developer's guide to San Francisco",
        version: 1,
        body_markdown: "## Early notes\n\nStart at the Ferry Building, walk through North Beach, and keep an eye on the fog over Twin Peaks.",
        created_at: now,
        updated_at: now,
      };
    }
  }
  if (action === "redirects" && args.command[2] === "get") {
    const fromSlug = args.command[3] ?? "old-san-francisco-guide";
    return {
      object: "slug_redirect",
      content_type: "blog_post",
      locale: localeFor(args),
      from_slug: fromSlug,
      to_slug: "developers-guide-to-san-francisco",
      post_id: "demo_post_sf_guide",
      status_code: 301,
    };
  }
  if (action === "list") {
    return list([
      post(args, { id: "demo_post_sf_guide", status: "published" }),
      post(args, { id: "demo_post_sf_parks", slug: "best-parks-in-san-francisco", status: "published", title: "The best parks in San Francisco" }),
      post(args, { id: "demo_post_sf_draft", slug: "mission-coffee-notes", status: "draft", title: "Mission coffee notes" }),
    ], args);
  }
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
  if (action === "list") return list([author(args), author(args, { id: "demo_author_rafael", public_name: "Rafael Torres", slug: "rafael-torres", bio: "Maps the best corners of San Francisco for readers who build and wander." })], args);
  if (action === "get") return author(args, { id: idArg(args) });
  if (action === "create" || action === "update") return author(args, { id: action === "update" ? idArg(args) : "demo_author_ada" });
  if (action === "delete") return deleted(idArg(args));
  throw new CliBlogError("Unknown authors command", { code: "unknown_command" });
};

const runDemoMedia = (args: ParsedArgs) => {
  const action = args.command[1];
  if (action === "list") return list([media(args), media(args, { id: "demo_media_dolores", url: "https://cdn.cli-blog.example/demo/san-francisco/dolores-park.png", original_filename: "dolores-park.png", alt_text: "Dolores Park on a clear San Francisco afternoon" })], args);
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
