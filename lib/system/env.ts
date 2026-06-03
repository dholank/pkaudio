import fs from "node:fs";
import path from "node:path";

function unquote(value: string) {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function loadLocalEnv(fileName = ".env.local") {
  const envPath = path.join(/* turbopackIgnore: true */ process.cwd(), fileName);
  if (!fs.existsSync(envPath)) return false;

  const text = fs.readFileSync(envPath, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separator = line.indexOf("=");
    if (separator <= 0) continue;

    const key = line.slice(0, separator).trim();
    const value = unquote(line.slice(separator + 1));
    if (!process.env[key]) process.env[key] = value;
  }

  return true;
}
