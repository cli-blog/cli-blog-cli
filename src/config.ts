import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export type CliConfig = {
  apiKey?: string;
  apiUrl?: string;
};

const configPath = () => join(homedir(), ".config", "cli-blog", "config.json");

export const readConfig = async (): Promise<CliConfig> => {
  try {
    return JSON.parse(await readFile(configPath(), "utf8")) as CliConfig;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return {};
    throw error;
  }
};

export const writeConfig = async (config: CliConfig, path = configPath()) => {
  const directory = dirname(path);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  await chmod(path, 0o600);
};

export const maskKey = (key: string) => {
  if (key.length <= 14) return "********";
  return `${key.slice(0, 12)}...${key.slice(-4)}`;
};
