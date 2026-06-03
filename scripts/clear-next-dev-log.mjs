import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const logPath = ".next/dev/logs/next-development.log";

mkdirSync(dirname(logPath), { recursive: true });
writeFileSync(logPath, "");
console.log(`Cleared ${logPath}`);
