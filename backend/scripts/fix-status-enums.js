/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const EXTS = new Set([".ts", ".tsx"]);

const replacements = [
  ["'draft'", "ScenarioVersionStatus.DRAFT"],
  ['"draft"', "ScenarioVersionStatus.DRAFT"],

  ["'pending_approval'", "ScenarioVersionStatus.SUBMITTED"],
  ['"pending_approval"', "ScenarioVersionStatus.SUBMITTED"],

  ["'approved'", "ScenarioVersionStatus.APPROVED"],
  ['"approved"', "ScenarioVersionStatus.APPROVED"],

  ["'published'", "ScenarioVersionStatus.PUBLISHED"],
  ['"published"', "ScenarioVersionStatus.PUBLISHED"],

  ["'rejected'", "ScenarioVersionStatus.REJECTED"],
  ['"rejected"', "ScenarioVersionStatus.REJECTED"],

  ["'archived'", "ScenarioVersionStatus.ARCHIVED"],
  ['"archived"', "ScenarioVersionStatus.ARCHIVED"],
];

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name === "node_modules" || e.name === "dist" || e.name === ".next") continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else {
      const ext = path.extname(e.name);
      if (!EXTS.has(ext)) continue;

      const original = fs.readFileSync(full, "utf8");
      let updated = original;
      for (const [from, to] of replacements) updated = updated.split(from).join(to);

      if (updated !== original) {
        fs.writeFileSync(full, updated, "utf8");
        console.log("Updated:", path.relative(ROOT, full));
      }
    }
  }
}

walk(ROOT);
console.log("Done.");
