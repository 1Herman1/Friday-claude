import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const r = spawnSync("python3", [fileURLToPath(new URL("./selftest.py", import.meta.url))], {stdio: "inherit"});
process.exit(r.status ?? 1);
