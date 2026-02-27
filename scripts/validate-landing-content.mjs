import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  landingContentFiles,
  validateLandingContentStrict
} from "@seminar/contracts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

async function loadJson(relativePath) {
  const absolutePath = path.resolve(repoRoot, relativePath);
  try {
    const raw = await readFile(absolutePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

const manifest = await loadJson(landingContentFiles.manifest);
const manifestModules = manifest && typeof manifest === "object" ? manifest.modules : undefined;

const modulePayload = {};
for (const [moduleName, fallbackPath] of Object.entries(landingContentFiles.modules)) {
  const pathFromManifest =
    manifestModules &&
    typeof manifestModules === "object" &&
    manifestModules[moduleName] &&
    typeof manifestModules[moduleName] === "object" &&
    !Array.isArray(manifestModules[moduleName]) &&
    typeof manifestModules[moduleName].path === "string"
      ? manifestModules[moduleName].path
      : fallbackPath;
  modulePayload[moduleName] = await loadJson(pathFromManifest);
}

const result = validateLandingContentStrict({
  manifest,
  modules: modulePayload
});

if (result.errors.length > 0) {
  console.error("Landing content validation failed.");
  for (const error of result.errors) {
    console.error(JSON.stringify(error));
  }
  process.exitCode = 1;
} else {
  console.log("Landing content validation passed.");
}
