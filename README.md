<p align="center">
  <a href="https://cli-blog.com">
    <img src="https://cli-blog.com/cli-blog-logo.png" alt="Cli Blog" width="72" height="72" />
  </a>
</p>

# @cli-blog/cli

Official command-line tool for the Cli Blog API.

[Homepage](https://cli-blog.com) · [Documentation](https://cli-blog.com/docs) · [CLI Docs](https://cli-blog.com/docs/cli) · [API Reference](https://cli-blog.com/docs/reference/endpoints) · [Agent Skill](https://github.com/cli-blog/cli-blog-skill) · [GitHub](https://github.com/cli-blog/cli-blog-cli)

## What Is This?

`@cli-blog/cli` lets developers, teams, CI jobs, and AI agents publish and manage [Cli Blog](https://cli-blog.com) content from a terminal. It wraps the public `/v1` content API with commands for [posts](#posts), [authors](#authors), [media](#media), [categories](#categories-and-tags), [tags](#categories-and-tags), [locales](#locales), [sitemap XML](#sitemap-and-feed), [feed XML](#sitemap-and-feed), [revisions](#revisions-and-redirects), and [slug redirects](#revisions-and-redirects).

After install, run commands with `cli-blog`:

```sh
cli-blog posts list --demo --json
```

## Install

Global install with npm:

```sh
npm install -g @cli-blog/cli
```

Global install with Bun:

```sh
bun add -g @cli-blog/cli
```

Global install with pnpm:

```sh
pnpm add -g @cli-blog/cli
```

Run without installing with npx:

```sh
npx @cli-blog/cli posts list --demo --json
```

Run without installing with Bun:

```sh
bunx @cli-blog/cli posts list --demo --json
```

Run without installing with pnpm:

```sh
pnpm dlx @cli-blog/cli posts list --demo --json
```

Configure a private API key for trusted publishing:

```sh
cli-blog config set --api-key "$CLI_BLOG_PRIVATE_KEY"
```

Or set an environment variable, which is usually best for CI:

```sh
CLI_BLOG_API_KEY=cli_blog_sk_...
```

Configuration precedence is:

1. `--api-key`.
2. `CLI_BLOG_API_KEY`.
3. Saved config from `cli-blog config set`.

Prefer environment variables or a secret manager for private keys. Avoid passing private keys through `--api-key` because shell history and local process inspection may expose command arguments.

## Try It Without Setup

Demo mode is fully offline. It returns deterministic San Francisco sample content without config, API keys, network requests, file reads, uploads, writes, or destructive prompts.

```sh
cli-blog posts list --demo --json
cli-blog posts create --demo --title "A developer's guide to San Francisco" --json
cli-blog feed get --demo
```

Run the same demo commands without installing:

```sh
npx @cli-blog/cli posts list --demo --json
bunx @cli-blog/cli posts create --demo --title "A developer's guide to San Francisco" --json
pnpm dlx @cli-blog/cli feed get --demo
```

Use `--demo` on any command that should return sample output instead of calling the API.

## Command Guide

Global options work on every command:

| Option | Description |
| --- | --- |
| `--api-key <key>` | API key override. Prefer `CLI_BLOG_API_KEY` for private keys. |
| `--demo` | Return offline demo content without setup. |
| `--json` | Print formatted JSON for successful JSON responses. |
| `--yes` | Skip confirmation prompts for destructive real API commands. |
| `--help` | Print CLI help. |
| `--version` | Print the CLI version. |

### Posts

| Command | Use it for | Common options |
| --- | --- | --- |
| `posts list` | List posts. | `--status`, `--locale`, `--limit`, `--search`, `--sort`, `--direction`, `--fields`, `--include`, author/category/tag filters. |
| `posts get <id-or-slug>` | Fetch one post. | `--locale`, `--fields`, `--include`. |
| `posts create` | Create a post. | `--title`, `--body`, `--body-markdown`, `--status`, `--locale`, author/category/tag/media IDs, SEO options. |
| `posts update <id-or-slug>` | Update a post. | Same editable fields as create, plus `--expected-version`. |
| `posts publish <id-or-slug>` | Publish a post. | `--expected-version`, `--published-at`, `--locale`. |
| `posts schedule <id-or-slug>` | Schedule a post. | `--scheduled-at` or `--at`, `--expected-version`, `--locale`. |
| `posts delete <id-or-slug>` | Delete/archive a post. | `--locale`, `--yes`. |

List posts:

```sh
cli-blog posts list \
  --status published \
  --locale en-US \
  --fields summary,seo \
  --include authors,categories,tags,media \
  --limit 20 \
  --json
```

Expected result shape:

```json
{
  "object": "list",
  "data": [
    {
      "id": "post_123",
      "object": "post",
      "title": "A developer's guide to San Francisco",
      "slug": "developers-guide-to-san-francisco",
      "status": "published",
      "authors": [{ "id": "author_123", "object": "author", "public_name": "Maya Chen" }]
    }
  ],
  "has_more": false,
  "next_cursor": null
}
```

Create and publish:

```sh
cli-blog posts create \
  --title "A developer's guide to San Francisco" \
  --body-markdown ./post.md \
  --author-ids author_123 \
  --category-ids term_category_123 \
  --tag-ids term_tag_123 \
  --seo-title "A developer's guide to San Francisco" \
  --json

cli-blog posts publish post_123 --expected-version 1 --json
```

Expected publish result shape:

```json
{
  "id": "post_123",
  "object": "post",
  "status": "published",
  "slug": "developers-guide-to-san-francisco",
  "version": 2
}
```

Post filters:

```sh
--status draft|in_review|scheduled|published|archived
--locale en-US # optional; omit to use your organization's default locale.
--search "coffee"
--sort published_at|created_at|updated_at|relevance
--direction asc|desc
--author-id author_123
--author-slug maya-chen
--category-id term_category_123
--category-slug san-francisco
--tag-id term_tag_123
--tag-slug city-notes
--fields summary,content,seo,workflow,metadata
--include authors,categories,tags,media,translations
```

Post create/update fields:

```sh
--title <text>
--slug <slug>
--body <markdown-or-path> # optional.
--body-markdown <markdown-or-path> # optional.
--excerpt <text>
--status draft|in_review|scheduled|published|archived
--published-at <iso>
--scheduled-at <iso>
--expected-version <number>
--author-ids <id,id>
--category-ids <id,id>
--tag-ids <id,id>
--featured-media-asset-id <id>
--metadata '{"source":"ci"}'
```

SEO options for posts, categories, and tags:

```sh
--seo-title <text>
--seo-description <text>
--canonical-url <url>
--focus-keyphrase <text>
--seo-keywords <word,word>
--robots-index=true|false
--robots-follow=true|false
--open-graph-title <text>
--open-graph-description <text>
--open-graph-media-asset-id <id>
--twitter-title <text>
--twitter-description <text>
--twitter-media-asset-id <id>
--schema-type <type>
```

### Authors

| Command | Use it for | Options |
| --- | --- | --- |
| `authors list` | List public authors. | `--limit`. |
| `authors get <id-or-slug>` | Fetch one author. | None. |
| `authors create` | Create an author. | `--public-name`, `--name`, `--slug`, `--bio`, `--avatar-media-id`, `--website-url`, `--metadata`. |
| `authors update <id-or-slug>` | Update an author. | Same fields as create. |
| `authors delete <id-or-slug>` | Delete an author. | `--yes`. |

```sh
cli-blog authors create \
  --public-name "Maya Chen" \
  --bio "Field notes from San Francisco" \
  --website-url "https://example.com/authors/maya-chen" \
  --json
```

Expected result shape:

```json
{
  "id": "author_123",
  "object": "author",
  "public_name": "Maya Chen",
  "slug": "maya-chen",
  "bio": "Field notes from San Francisco"
}
```

### Media

| Command | Use it for | Options |
| --- | --- | --- |
| `media list` | List media assets. | `--limit`. |
| `media get <id>` | Fetch one media asset. | None. |
| `media upload --file <path>` | Upload a local file. | `--file`, `--filename`, `--alt-text`, `--caption`, `--content-type`, `--metadata`. |
| `media update <id>` | Update media metadata. | `--alt-text`, `--caption`, `--metadata`. |
| `media delete <id>` | Delete media. | `--yes`. |

```sh
cli-blog media upload \
  --file ./bay-walk.png \
  --alt-text "Morning light over San Francisco Bay" \
  --caption "A local image for a San Francisco story." \
  --json
```

Expected result shape:

```json
{
  "id": "media_123",
  "object": "media_asset",
  "url": "https://cdn.example.com/media/bay-walk.png",
  "original_filename": "bay-walk.png",
  "alt_text": "Morning light over San Francisco Bay",
  "mime_type": "image/png"
}
```

### Categories And Tags

| Command | Use it for | Options |
| --- | --- | --- |
| `categories list` / `tags list` | List terms. | Optional: `--locale`, `--include translations`, `--limit`. |
| `categories get <id-or-slug>` / `tags get <id-or-slug>` | Fetch one term. | Optional: `--locale`, `--include translations`. |
| `categories create` / `tags create` | Create a term. | Required: `--name`. Optional: `--slug`, `--locale`, `--description`, `--translation-of-id`, SEO options. |
| `categories update <id-or-slug>` / `tags update <id-or-slug>` | Update a term. | Same fields as create, optional `--locale`. |
| `categories delete <id-or-slug>` / `tags delete <id-or-slug>` | Delete a term. | `--locale`, `--yes`. |

```sh
cli-blog categories create --name "San Francisco" --locale en-US --json
cli-blog tags create --name "City Notes" --locale en-US --json
```

Expected result shape:

```json
{
  "id": "term_123",
  "object": "taxonomy_term",
  "taxonomy_type": "category",
  "locale": "en-US",
  "name": "San Francisco",
  "slug": "san-francisco"
}
```

### Locales

```sh
cli-blog locales list --json
```

Expected result shape:

```json
[
  { "tag": "en-US", "name": "English (United States)", "language": "English", "region": "United States" },
  { "tag": "es-MX", "name": "Spanish (Mexico)", "language": "Spanish", "region": "Mexico" }
]
```

### Revisions And Redirects

```sh
cli-blog posts revisions list post_123 --json
cli-blog posts revisions get post_123 rev_123 --json
cli-blog posts redirects get old-san-francisco-guide --locale en-US --json
```

Expected result shape:

```json
{
  "object": "slug_redirect",
  "from_slug": "old-san-francisco-guide",
  "to_slug": "developers-guide-to-san-francisco",
  "post_id": "post_123",
  "status_code": 301
}
```

### Sitemap And Feed

```sh
cli-blog sitemap get --locale en-US > sitemap.xml
cli-blog feed get --locale en-US > feed.xml
```

These commands print XML unless `--json` is used on commands that return JSON.

## Demo Mode Examples

Demo mode works across the public command surface:

```sh
cli-blog posts list --demo --json
cli-blog posts create --demo --title "A developer's guide to San Francisco" --json
cli-blog authors create --demo --public-name "Maya Chen" --json
cli-blog media upload --demo --file ./missing.png --json
cli-blog categories create --demo --name "San Francisco" --json
cli-blog tags create --demo --name "City Notes" --json
cli-blog posts revisions list demo_post_sf_guide --demo --json
cli-blog posts redirects get old-san-francisco-guide --demo --json
cli-blog sitemap get --demo
cli-blog feed get --demo
```

The `media upload --demo` command does not read the file path. It returns a sample media object so you can test output parsing before setting up real storage or keys.

## AI Agent Skill

If you want an AI coding agent to add Cli Blog to an application, use the [Cli Blog agent skill](https://github.com/cli-blog/cli-blog-skill). It includes guidance for choosing the API, SDK, or CLI, plus framework patterns for common app stacks.

## Errors

Failed commands print a single `cli-blog:` message to stderr and exit with code `1`. Successful commands exit `0`.

Common cases:

| Error | When to expect it | What to do |
| --- | --- | --- |
| `Missing API key` | You ran a real API command without config or `CLI_BLOG_API_KEY`. | Run `cli-blog config set --api-key <key>` or set `CLI_BLOG_API_KEY`. |
| `Unknown command` | The command family or action is not supported. | Run `cli-blog --help` and check the command spelling. |
| `Missing resource ID or slug` | A command such as `posts get`, `posts update`, or `authors delete` needs an ID/slug. | Pass the resource ID or slug after the action. |
| `Invalid --expected-version number` | A numeric flag received non-numeric input. | Pass a valid number. |
| API `401` / `403` | The key is missing, invalid, public-only, or missing permission for the action. | Use the right organization key type and scope. |
| API `404` | The resource ID or locale-scoped slug was not found. | Check the ID, slug, and `--locale`. |
| API `409` | The `--expected-version` value is stale. | Fetch the latest post, then retry with the current version. |

Use `--json` when you want successful output to be machine-readable. Errors intentionally stay on stderr.

## Security

- Never expose private API keys in browsers, mobile apps, or other untrusted clients.
- Use public keys for published-content reads.
- Use private keys only in trusted shells, CI, servers, or agent environments.
- Saved config is restricted to the current OS user after every write.
- Destructive commands require confirmation unless `--yes` is passed.
- Runtime dependencies are limited to the first-party `@cli-blog/node` package.
