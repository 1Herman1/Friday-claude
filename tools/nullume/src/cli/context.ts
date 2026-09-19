import type { CommandFlags } from "./types.js";

let currentFlags: CommandFlags = {};

export function setGlobalFlags(flags: CommandFlags): void {
  currentFlags = flags;
}

export function getGlobalFlags(): CommandFlags {
  return currentFlags;
}
