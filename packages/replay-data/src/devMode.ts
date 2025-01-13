export function isTruthyEnvVar(envVar: string): boolean {
  return (process.env[envVar]?.length && process.env[envVar] !== "0") || false;
}

export function isReplayDevMode(): boolean {
  return isTruthyEnvVar("REPLAY_DEV_MODE");
}
