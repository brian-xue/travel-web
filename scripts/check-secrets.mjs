import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const ignored = new Set(["node_modules", ".git", "dist", "coverage"]);
const patterns = [
  /MAPTILER_API_KEY\s*=\s*(?!replace_me)[^\s]+/,
  /SESSION_SECRET\s*=\s*(?!replace_me)[^\s]+/,
  /AUTH_PASSWORD_HASH\s*=\s*(?!replace_me)[^\s]+/,
  /VIEWER_PASSWORD_HASH\s*=\s*(?!replace_me)[^\s]+/,
  /EDITOR_PASSWORD_HASH\s*=\s*(?!replace_me)[^\s]+/,
];

function walk(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    if (ignored.has(entry.name)) {
      continue;
    }
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(walk(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

const matches = [];
for (const file of walk(root)) {
  const content = fs.readFileSync(file, "utf8");
  for (const pattern of patterns) {
    if (pattern.test(content)) {
      matches.push(path.relative(root, file));
      break;
    }
  }
}

if (matches.length > 0) {
  console.error("Potential secrets found:", matches.join(", "));
  process.exit(1);
}

console.log("No obvious secrets found.");
