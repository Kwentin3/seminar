import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { landingContentFiles, validateLandingContentStrict } from "@seminar/contracts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function loadJson(relativePath) {
  const absolutePath = path.resolve(repoRoot, relativePath);
  const raw = await readFile(absolutePath, "utf-8");
  return JSON.parse(raw);
}

function runCase(name, input, expectedCode) {
  const result = validateLandingContentStrict(input);

  if (!expectedCode) {
    assert.equal(result.errors.length, 0, `${name}: expected no errors`);
    return;
  }

  assert(
    result.errors.some((error) => error.error_code === expectedCode),
    `${name}: expected error_code=${expectedCode}, got ${JSON.stringify(result.errors, null, 2)}`
  );
}

const manifest = await loadJson(landingContentFiles.manifest);
const step1 = await loadJson(landingContentFiles.modules["landing.step1.hero"]);
const step2 = await loadJson(landingContentFiles.modules["landing.step2.roles"]);

const baseInput = {
  manifest,
  modules: {
    "landing.step1.hero": step1,
    "landing.step2.roles": step2
  }
};

runCase("valid_content", clone(baseInput));

{
  const input = clone(baseInput);
  input.modules["landing.step1.hero"].variants.aggressive.body[0].text.i18n.en = "   ";
  runCase("i18n_empty_string", input, "i18n_empty_string");
}

{
  const input = clone(baseInput);
  input.modules["landing.step1.hero"].experiment.distribution.partner = 0.5;
  runCase("distribution_sum_invalid", input, "distribution_sum_invalid");
}

{
  const input = clone(baseInput);
  input.modules["landing.step2.roles"].roles_order = ["business_owner", "operations_lead", "ops_lead"];
  runCase("roles_key_mismatch", input, "roles_key_mismatch");
}

console.log("Landing content validator checks passed.");
