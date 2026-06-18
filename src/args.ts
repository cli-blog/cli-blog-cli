export type ParsedArgs = {
  command: string[];
  flags: Record<string, string | boolean | string[]>;
};

const booleanFlags = new Set(["json", "yes", "help", "version", "demo", "demo_content"]);

const setFlag = (flags: ParsedArgs["flags"], key: string, value: string | boolean) => {
  const current = flags[key];
  if (current === undefined) {
    flags[key] = value;
  } else if (Array.isArray(current)) {
    current.push(String(value));
  } else {
    flags[key] = [String(current), String(value)];
  }
};

export const parseArgs = (argv: string[]): ParsedArgs => {
  const command: string[] = [];
  const flags: ParsedArgs["flags"] = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg) continue;

    if (!arg.startsWith("--")) {
      command.push(arg);
      continue;
    }

    const [rawKey, inlineValue] = arg.slice(2).split("=", 2);
    if (!rawKey) continue;
    const key = rawKey.replaceAll("-", "_");

    if (inlineValue !== undefined) {
      setFlag(flags, key, inlineValue);
      continue;
    }

    if (booleanFlags.has(key)) {
      setFlag(flags, key, true);
      continue;
    }

    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      setFlag(flags, key, next);
      index += 1;
    } else {
      setFlag(flags, key, true);
    }
  }

  return { command, flags };
};

export const flagString = (flags: ParsedArgs["flags"], key: string): string | undefined => {
  const value = flags[key];
  if (Array.isArray(value)) return value.at(-1);
  if (typeof value === "string") return value;
  return undefined;
};

export const flagBoolean = (flags: ParsedArgs["flags"], key: string) => flags[key] === true;

export const flagArray = (flags: ParsedArgs["flags"], key: string): string[] | undefined => {
  const value = flags[key];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") return value.split(",").map((item) => item.trim()).filter(Boolean);
  return undefined;
};
