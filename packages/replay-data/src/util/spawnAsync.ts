/* Copyright 2020-2024 Record Replay Inc. */

// Utilities for spawning processes.

import { ChildProcess, SpawnOptions, spawn } from "child_process";
import { Readable } from "stream";

import NestedError from "./NestedError";

export async function spawnAsync(
  command: string,
  args: string[],
  options: SpawnOptions = {}
): Promise<{ stdout: string; stderr: string }> {
  let p: ChildProcess;
  try {
    p = spawn(command, args, options);
  } catch (err: any) {
    throw new NestedError("Unable to spawn command: Make sure both, command and cwd, exist!", err);
  }

  const { code, signal, stdout, stderr } = await new Promise<{
    code: number | null;
    signal: NodeJS.Signals | null;
    stdout: string;
    stderr: string;
  }>((resolve, reject) => {
    const stdout = p.stdout ? streamStdioToBuffer(p.stdout) : "";
    const stderr = p.stderr ? streamStdioToBuffer(p.stderr) : "";
    p.on("error", reject);
    p.on("exit", async (code, signal) =>
      resolve({ code, signal, stdout: await stdout, stderr: await stderr })
    );
  });

  if (code || signal) {
    throw new Error(
      `spawnAsync FATAL EXIT: "${command} ${args.join(" ")}"\n signal=${signal} code=${
        code
      }\n stderr: ${stderr?.toString()}\n stdout: ${stdout?.toString()}`
    );
  }

  return { stdout, stderr };
}

// We don't use our usual streamToBuffer helper here because using that for stdio
// streams will trigger a "ERR_STREAM_PREMATURE_CLOSE" error because they don't
// emit 'close' events like a normal stream does.
async function streamStdioToBuffer(stdio: Readable): Promise<string> {
  const chunks = [];
  for await (const chunk of stdio) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString();
}
