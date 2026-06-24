export type OutputMode = {
  json: boolean;
};

export const print = (value: unknown, mode: OutputMode) => {
  if (mode.json) {
    process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) process.stdout.write(`${formatObject(item)}\n`);
    return;
  }

  process.stdout.write(`${formatObject(value)}\n`);
};

const formatObject = (value: unknown) => {
  if (value === null || typeof value !== "object") return String(value);
  const record = value as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id : undefined;
  const label =
    typeof record.title === "string"
      ? record.title
      : typeof record.public_name === "string"
        ? record.public_name
        : typeof record.name === "string"
          ? record.name
          : typeof record.slug === "string"
            ? record.slug
            : undefined;

  if (id && label) return `${id}\t${label}`;
  if (id) return id;
  return JSON.stringify(value);
};

export const help = `Cli Blog CLI

Usage:
  cli-blog config set --api-key <key>
  cli-blog posts list|get|create|update|publish|schedule|delete [options]
  cli-blog posts revisions list|get <post> [revision] [options]
  cli-blog posts redirects get <slug> [options]
  cli-blog authors list|get|create|update|delete [options]
  cli-blog media list|get|upload|update|delete [options]
  cli-blog categories list|get|create|update|delete [options]
  cli-blog tags list|get|create|update|delete [options]
  cli-blog locales list [options]
  cli-blog sitemap get [options]
  cli-blog feed get [options]

Global options:
  --api-key <key>       API key override. Prefer CLI_BLOG_API_KEY to avoid shell-history leaks.
  --demo                Return offline demo content without config, API keys, network, or writes.
  --json                Print JSON output.
  --yes                 Skip destructive confirmation prompts.

Examples:
  cli-blog posts list --demo --json
  cli-blog posts list --fields summary --include authors
  cli-blog authors create --public-name "Maya Chen" --avatar-media-id media_123
  cli-blog posts create --title "A developer's guide to San Francisco" --body-markdown ./post.md --author-ids author_123
  cli-blog posts publish post_123 --expected-version 3
  cli-blog posts revisions get post_123 rev_123
  cli-blog posts redirects get old-slug --locale en-US
  cli-blog sitemap get > sitemap.xml
  cli-blog feed get > feed.xml
`;
