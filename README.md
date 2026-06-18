# @cli-blog/cli

Official command-line tool for the Cli Blog API.

Repository: [github.com/cli-blog/cli-blog-cli](https://github.com/cli-blog/cli-blog-cli)

## What Is This?

`@cli-blog/cli` lets developers, teams, CI jobs, and AI agents publish and manage Cli Blog content from a terminal. It wraps the public `/v1` content API with commands for posts, authors, media, categories, tags, locales, sitemap XML, feed XML, revisions, and slug redirects.

The CLI is built for trusted automation:

- Works with public keys for published-content reads.
- Works with private keys for server, CI, agent, and editorial writes.
- Prints JSON with `--json` for scripts.
- Stores saved config with current-user-only file permissions.
- Includes offline demo mode so users can try commands before creating an account or API key.

## Getting Started

Try the CLI without setup:

```sh
npx @cli-blog/cli posts list --demo --json
npx @cli-blog/cli posts create --demo --title "Hello from demo mode"
npx @cli-blog/cli feed get --demo
```

Install it globally:

```sh
npm install -g @cli-blog/cli
```

Configure a real private API key for publishing:

```sh
cli-blog config set --api-key "$CLI_BLOG_PRIVATE_KEY"
```

Or use environment variables, which are recommended for CI and shared shells:

```sh
CLI_BLOG_API_KEY=cli_blog_sk_...
CLI_BLOG_API_URL=https://api.cli-blog.com
```

Configuration precedence is:

1. `--api-key` and `--api-url` flags.
2. `CLI_BLOG_API_KEY` and `CLI_BLOG_API_URL`.
3. Saved config from `cli-blog config set`.

Prefer environment variables or a secret manager for private keys. Avoid passing private keys through `--api-key` because shell history and local process inspection may expose command arguments.

## Demo Mode

Demo mode returns deterministic sample content without config, API keys, network requests, file reads, uploads, writes, or destructive prompts.

Use either flag:

```sh
cli-blog posts list --demo
cli-blog posts list --demo-content
```

Demo mode works across the public command surface:

```sh
cli-blog posts create --demo --title "Launch notes" --body "# Shipped"
cli-blog authors create --demo --public-name "Ada Lovelace"
cli-blog media upload --demo --file ./cover.png --alt-text "Cover image"
cli-blog categories create --demo --name "Product Updates"
cli-blog tags create --demo --name "release"
cli-blog sitemap get --demo
cli-blog feed get --demo
```

## Reference

Global options:

| Option | Description |
| --- | --- |
| `--api-key <key>` | API key override. Prefer `CLI_BLOG_API_KEY` for private keys. |
| `--api-url <url>` | API base URL. Defaults to `https://api.cli-blog.com`. |
| `--demo` | Return offline demo content without setup. |
| `--demo-content` | Alias for `--demo`. |
| `--json` | Print formatted JSON. |
| `--yes` | Skip confirmation prompts for destructive real API commands. |
| `--help` | Print CLI help. |
| `--version` | Print the CLI version. |

Commands:

| Command | Purpose |
| --- | --- |
| `config set --api-key <key> [--api-url <url>]` | Save local CLI configuration. |
| `posts list [options]` | List posts with filters, field groups, and includes. |
| `posts get <id-or-slug> [options]` | Fetch one post by ID or locale-scoped slug. |
| `posts create [options]` | Create a post. |
| `posts update <id-or-slug> [options]` | Update a post. |
| `posts publish <id-or-slug> [options]` | Publish a post. |
| `posts schedule <id-or-slug> --scheduled-at <iso>` | Schedule a post. |
| `posts delete <id-or-slug> [options]` | Delete a post after confirmation. |
| `posts revisions list <post> [options]` | List post revisions. |
| `posts revisions get <post> <revision> [options]` | Fetch a revision snapshot. |
| `posts redirects get <slug> [options]` | Resolve a historical post slug redirect. |
| `authors list|get|create|update|delete` | Manage public author profiles. |
| `media list|get|upload|update|delete` | Manage uploaded media assets. |
| `categories list|get|create|update|delete` | Manage category terms. |
| `tags list|get|create|update|delete` | Manage tag terms. |
| `locales list` | List supported BCP 47 locale tags. |
| `sitemap get [options]` | Fetch sitemap XML. |
| `feed get [options]` | Fetch feed XML. |

Common post options:

```sh
--title <text>
--slug <slug>
--locale <tag>
--body <markdown-or-path>
--body-markdown <markdown-or-path>
--status draft|in_review|scheduled|published|archived
--published-at <iso>
--scheduled-at <iso>
--expected-version <number>
--author-ids <id,id>
--category-ids <id,id>
--tag-ids <id,id>
--featured-media-asset-id <id>
--fields summary,content,seo,workflow,metadata
--include authors,categories,tags,media,translations
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

## Examples

Create an author, category, tag, and post:

```sh
cli-blog authors create --public-name "Ada Lovelace" --bio "Notes from the engine room" --json
cli-blog categories create --name "Product Updates" --locale en-US --json
cli-blog tags create --name "release" --locale en-US --json
cli-blog posts create \
  --title "First post" \
  --body-markdown ./post.md \
  --author-ids author_123 \
  --category-ids term_category_123 \
  --tag-ids term_tag_123 \
  --seo-title "First post" \
  --json
```

Review and publish with optimistic concurrency:

```sh
cli-blog posts get post_123 --fields summary,content,seo --include authors,categories,tags --json
cli-blog posts update post_123 --expected-version 2 --excerpt "A concise summary"
cli-blog posts publish post_123 --expected-version 3
```

Schedule a post:

```sh
cli-blog posts schedule post_123 --scheduled-at 2026-06-18T16:00:00.000Z
```

Read published delivery content with a public key:

```sh
CLI_BLOG_API_KEY=cli_blog_pk_... cli-blog posts list \
  --status published \
  --fields summary,seo \
  --include authors,media \
  --json
```

Upload and update media:

```sh
cli-blog media upload ./cover.png --alt-text "Product screenshot" --caption "Launch dashboard" --json
cli-blog media update media_123 --alt-text "Updated product screenshot"
```

Work with localized taxonomy:

```sh
cli-blog locales list --json
cli-blog categories create --name "Noticias" --locale es-MX --slug noticias
cli-blog tags list --locale es-MX --include translations --json
```

Inspect revisions and redirects:

```sh
cli-blog posts revisions list post_123 --json
cli-blog posts revisions get post_123 rev_123 --json
cli-blog posts redirects get old-launch-notes --locale en-US --json
```

Fetch XML helpers:

```sh
cli-blog sitemap get --locale en-US > sitemap.xml
cli-blog feed get --locale en-US > feed.xml
```

Use JSON output in automation:

```sh
post_id="$(cli-blog posts create --title "CI release notes" --body "# Release" --json | jq -r .id)"
cli-blog posts publish "$post_id" --json
```

## Security

- Never expose private API keys in browsers, mobile apps, or other untrusted clients.
- Use public keys for published-content reads.
- Use private keys only in trusted shells, CI, servers, or agent environments.
- Saved config is restricted to the current OS user after every write.
- Destructive commands require confirmation unless `--yes` is passed.
- Runtime dependencies are limited to the first-party `@cli-blog/node` package.
