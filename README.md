<p align="center">
  <a href="https://cli-blog.com">
    <img src="https://cli-blog.com/cli-blog-logo.png" alt="Cli Blog" width="72" height="72" />
  </a>
</p>

# @cli-blog/cli

Official command-line tool for the Cli Blog API.

[Homepage](https://cli-blog.com) · [Documentation](https://cli-blog.com/docs) · [CLI Docs](https://cli-blog.com/docs/cli) · [API Reference](https://cli-blog.com/docs/reference/endpoints) · [GitHub](https://github.com/cli-blog/cli-blog-cli)

## What Is This?

`@cli-blog/cli` lets developers, teams, CI jobs, and AI agents publish and manage Cli Blog content from a terminal. It wraps the public `/v1` content API with commands for posts, authors, media, categories, tags, locales, sitemap XML, feed XML, revisions, and slug redirects.

The package name is `@cli-blog/cli`, but the installed command is `cli-blog`:

```sh
npm install -g @cli-blog/cli
cli-blog posts list --demo --json
```

You can also run it without a global install:

```sh
npx @cli-blog/cli posts list --demo --json
```

## Getting Started

Try the CLI without setup. Demo mode is fully offline and uses San Francisco sample content:

```sh
npx @cli-blog/cli posts list --demo --json
npx @cli-blog/cli posts create --demo --title "A developer's guide to San Francisco"
npx @cli-blog/cli feed get --demo
```

Install it globally when you want the `cli-blog` command available everywhere:

```sh
npm install -g @cli-blog/cli
```

Configure a private API key for trusted publishing:

```sh
cli-blog config set --api-key "$CLI_BLOG_PRIVATE_KEY"
```

Environment variables override saved config and are recommended for CI:

```sh
CLI_BLOG_API_KEY=cli_blog_sk_...
```

Configuration precedence is:

1. `--api-key`.
2. `CLI_BLOG_API_KEY`.
3. Saved config from `cli-blog config set`.

Prefer environment variables or a secret manager for private keys. Avoid passing private keys through `--api-key` because shell history and local process inspection may expose command arguments.

## Demo Mode

Demo mode returns deterministic San Francisco sample content without config, API keys, network requests, file reads, uploads, writes, or destructive prompts.

Use either flag:

```sh
cli-blog posts list --demo
cli-blog posts list --demo-content
```

Demo mode works across the public command surface:

```sh
cli-blog posts create --demo --title "A developer's guide to San Francisco"
cli-blog authors create --demo --public-name "Maya Chen"
cli-blog media upload --demo --file ./bay-walk.png --alt-text "Morning light over San Francisco Bay"
cli-blog categories create --demo --name "San Francisco"
cli-blog tags create --demo --name "city-notes"
cli-blog posts revisions list demo_post_sf_guide --demo --json
cli-blog posts redirects get old-san-francisco-guide --demo --json
cli-blog sitemap get --demo
cli-blog feed get --demo
```

## Reference

Global options:

| Option | Description |
| --- | --- |
| `--api-key <key>` | API key override. Prefer `CLI_BLOG_API_KEY` for private keys. |
| `--demo` | Return offline demo content without setup. |
| `--demo-content` | Alias for `--demo`. |
| `--json` | Print formatted JSON. |
| `--yes` | Skip confirmation prompts for destructive real API commands. |
| `--help` | Print CLI help. |
| `--version` | Print the CLI version. |

Commands:

| Command | Purpose |
| --- | --- |
| `config set --api-key <key>` | Save local CLI configuration. |
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

## Examples

Create an author, category, tag, and post:

```sh
cli-blog authors create --public-name "Maya Chen" --bio "Field notes from San Francisco" --json
cli-blog categories create --name "San Francisco" --locale en-US --json
cli-blog tags create --name "city-notes" --locale en-US --json
cli-blog posts create \
  --title "A developer's guide to San Francisco" \
  --body-markdown ./post.md \
  --author-ids author_123 \
  --category-ids term_category_123 \
  --tag-ids term_tag_123 \
  --seo-title "A developer's guide to San Francisco" \
  --json
```

Review and publish with optimistic concurrency:

```sh
cli-blog posts get post_123 --fields summary,content,seo --include authors,categories,tags --json
cli-blog posts update post_123 --expected-version 2 --excerpt "Fog, hills, neighborhoods, and builder rituals."
cli-blog posts publish post_123 --expected-version 3
```

Fetch XML helpers:

```sh
cli-blog sitemap get --locale en-US > sitemap.xml
cli-blog feed get --locale en-US > feed.xml
```

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

## Publishing A New Version

This repository publishes to npm from GitHub releases after `NPM_TOKEN` is configured in repository Actions secrets.

For a CLI-only patch:

```sh
npm version patch
git push origin main --follow-tags
```

Then create a GitHub release for the new tag, such as `v0.1.1`. The publish workflow verifies that the release tag matches `package.json`, runs typecheck/tests/build, and publishes with npm provenance.

If the CLI depends on a new `@cli-blog/node` version, publish `@cli-blog/node` first, then update this package's dependency and publish the CLI.

## Security

- Never expose private API keys in browsers, mobile apps, or other untrusted clients.
- Use public keys for published-content reads.
- Use private keys only in trusted shells, CI, servers, or agent environments.
- Saved config is restricted to the current OS user after every write.
- Destructive commands require confirmation unless `--yes` is passed.
- Runtime dependencies are limited to the first-party `@cli-blog/node` package.
