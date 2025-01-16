import { mkdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";

import { isTruthyEnvVar } from "@replayio/data/src/devMode";
import { deterministicObjectHash } from "@replayio/data/src/util/objectUtil";
import { ThisRepoRoot, getRepoLatestModificationDate } from "@replayio/data/src/util/repoUtil";
import createDebug from "debug";

import { CommandOutputResult } from "../commandsShared/commandOutput";
import { InputSpec } from "./toolWrapper";

const debug = createDebug("replay:toolCache");
const CacheFolder = path.resolve(__dirname, "..", "..", ".toolCache");

export function isToolCacheEnabled(): boolean {
  return isTruthyEnvVar("REPLAY_ENABLE_TOOL_CACHE");
}

export function getCachePath(input: InputSpec): string {
  const { recordingId, ...args } = input.args;
  if (!recordingId) {
    throw new Error(`Missing recordingId in input args: ${JSON.stringify(input, null, 2)}`);
  }
  const folder = path.join(CacheFolder, recordingId);
  const fname = `${input.command}-${deterministicObjectHash(args)}.json`;
  return path.join(folder, fname);
}

export async function clearCache(recordingId?: string): Promise<void> {
  try {
    if (recordingId) {
      // Clear specific recording cache
      const folder = path.join(CacheFolder, recordingId);
      await rm(folder, { recursive: true, force: true });
    } else {
      // Clear entire cache
      await rm(CacheFolder, { recursive: true, force: true });
      await mkdir(CacheFolder, { recursive: true });
      console.log(`Cleared cache folder: "${CacheFolder}"`);
    }
  } catch (error) {
    // Ignore errors if folders don't exist
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}

type CacheKey = {
  input: InputSpec;
  codeLastModified: number;
};

type CachedData = {
  key: CacheKey;
  value: CommandOutputResult;
};

function makeKey(input: InputSpec) {
  const codeLastModified = getRepoLatestModificationDate(ThisRepoRoot).getTime();
  const key = {
    input,
    codeLastModified,
  };
  return key;
}

function validateKey(input: InputSpec, key: CacheKey): boolean {
  const newKey = makeKey(input);
  return JSON.stringify(key) === JSON.stringify(newKey);
}

async function deserializeAndValidate(
  input: InputSpec,
  s: string
): Promise<CommandOutputResult | null> {
  const cached = JSON.parse(s) as CachedData;
  if (!validateKey(input, cached.key)) {
    const cachePath = getCachePath(input);
    await rm(cachePath);
    debug(`Invalidated cache at "${cachePath}"`);
    return null;
  }
  return cached.value;
}

function serialize(input: InputSpec, value: CommandOutputResult): string {
  const key = makeKey(input);
  const cached = { key, value } as CachedData;
  return JSON.stringify(cached, null, 2);
}

export async function readCachedResponse(input: InputSpec): Promise<CommandOutputResult | null> {
  const cachePath = getCachePath(input);
  try {
    const cachedString = await readFile(cachePath, "utf8");
    const result = await deserializeAndValidate(input, cachedString);

    debug(`Read cached response from "${cachePath}"`);
    return result;
  } catch (err: any) {
    if (err.code !== "ENOENT") {
      console.error(`Error reading cache file from "${cachePath}": ${err?.stack || err}`);
    }
    return null;
  }
}

export async function cacheResponse(input: InputSpec, value: CommandOutputResult): Promise<void> {
  const cachePath = getCachePath(input);
  await mkdir(path.dirname(cachePath), { recursive: true });
  const cached = serialize(input, value);
  await writeFile(cachePath, cached);
  debug(`Cached new response in "${cachePath}"`);
}
