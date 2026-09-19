import { stdout, stderr } from "node:process";
import type { CommandFlags, EmitPayload } from "./types.js";

export function emit(
  flags: CommandFlags,
  payload: EmitPayload,
  humanFn?: (data: unknown) => string
): void {
  if (flags.quiet) {
    return;
  }

  if (flags.json) {
    stdout.write(JSON.stringify(payload.data || payload, null, 2) + "\n");
    return;
  }

  if (humanFn && payload.data !== undefined) {
    stdout.write(humanFn(payload.data) + "\n");
  } else if (payload.message) {
    stdout.write(payload.message + "\n");
  }
}

export function table(
  rows: Record<string, unknown>[],
  columns: { key: string; header: string; format?: (v: unknown) => string }[]
): string {
  if (rows.length === 0) return "Нет данных";

  // Calculate column widths
  const widths: Record<string, number> = {};
  for (const col of columns) {
    widths[col.key] = col.header.length;
    for (const row of rows) {
      const val = col.format ? col.format(row[col.key]) : String(row[col.key] ?? "");
      widths[col.key] = Math.max(widths[col.key], val.length);
    }
  }

  // Build output
  const lines: string[] = [];

  // Header
  const headerParts = columns.map((col) => col.header.padEnd(widths[col.key]));
  lines.push(headerParts.join(" | "));
  lines.push(columns.map((col) => "".padEnd(widths[col.key], "-")).join("-|-"));

  // Rows
  for (const row of rows) {
    const rowParts = columns.map((col) => {
      const val = col.format ? col.format(row[col.key]) : String(row[col.key] ?? "");
      return val.padEnd(widths[col.key]);
    });
    lines.push(rowParts.join(" | "));
  }

  return lines.join("\n");
}
