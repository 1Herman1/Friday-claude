// Preloaded by `npm test`: every test file gets its own throwaway NULLUME_HOME,
// so a test that forgets to isolate itself can never touch the real ~/.nullume
// (config with the kie key, job history, the taste library).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const home = fs.mkdtempSync(path.join(os.tmpdir(), "nullume-test-"));
process.env.NULLUME_HOME = home;
process.on("exit", () => fs.rmSync(home, { recursive: true, force: true }));
