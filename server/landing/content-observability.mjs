import { readFile } from "node:fs/promises";
import path from "node:path";
import { hashCanonicalJson } from "../obs/canonical-json.mjs";
// This module implements content/landing minimum-set OBS events
// required by CONTRACT-OBS-001 (Phase 1 baseline).
// DO NOT use console.log for runtime events.
// Use server/obs/logger.mjs instead (CONTRACT-OBS-001).

const defaultLandingContentFiles = {
  manifest: "content/landing/manifest.v1.json",
  modules: {
    "landing.step1.hero": "content/landing/step1.hero.v1.json",
    "landing.step2.roles": "content/landing/step2.roles.v1.json"
  }
};

const roleKeys = ["business_owner", "operations_lead", "it_lead"];
const heroVariantKeys = ["aggressive", "rational", "partner"];
const semverRegex = /^\d+\.\d+\.\d+$/;

let validatorRuntimePromise = null;

async function getValidatorRuntime() {
  if (validatorRuntimePromise) {
    return validatorRuntimePromise;
  }

  validatorRuntimePromise = (async () => {
    try {
      const contracts = await import("@seminar/contracts");
      if (
        contracts &&
        contracts.landingContentFiles &&
        typeof contracts.validateLandingContentRuntime === "function"
      ) {
        return {
          landingContentFiles: contracts.landingContentFiles,
          validateLandingContentRuntime: contracts.validateLandingContentRuntime
        };
      }
    } catch {
      // Fallback validator is used when runtime contract module is unavailable.
    }

    return {
      landingContentFiles: defaultLandingContentFiles,
      validateLandingContentRuntime: validateLandingContentRuntimeFallback
    };
  })();

  return validatorRuntimePromise;
}

function asObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value;
}

function parseSemver(value) {
  if (typeof value !== "string" || !semverRegex.test(value)) {
    return null;
  }
  const [major, minor, patch] = value.split(".").map((part) => Number.parseInt(part, 10));
  if ([major, minor, patch].some((part) => Number.isNaN(part))) {
    return null;
  }
  return { major, minor, patch };
}

function compareSemver(a, b) {
  if (a.major !== b.major) {
    return a.major - b.major;
  }
  if (a.minor !== b.minor) {
    return a.minor - b.minor;
  }
  return a.patch - b.patch;
}

function semverSatisfies(version, expects) {
  const parsedVersion = parseSemver(version);
  if (!parsedVersion || typeof expects !== "string") {
    return false;
  }

  if (expects.startsWith("^")) {
    const base = parseSemver(expects.slice(1));
    if (!base) {
      return false;
    }
    if (base.major > 0) {
      return parsedVersion.major === base.major && compareSemver(parsedVersion, base) >= 0;
    }
    if (base.minor > 0) {
      return (
        parsedVersion.major === 0 &&
        parsedVersion.minor === base.minor &&
        parsedVersion.patch >= base.patch
      );
    }
    return parsedVersion.major === 0 && parsedVersion.minor === 0 && parsedVersion.patch === base.patch;
  }

  const exact = parseSemver(expects);
  if (!exact) {
    return false;
  }
  return compareSemver(parsedVersion, exact) === 0;
}

function decodePointerToken(token) {
  return token.replaceAll("~1", "/").replaceAll("~0", "~");
}

function createObsError(code, category, retryable, origin, message) {
  return {
    code,
    category,
    retryable,
    origin,
    message
  };
}

function parseCookieValue(cookieHeader, key) {
  if (typeof cookieHeader !== "string" || !cookieHeader.trim()) {
    return null;
  }

  const entries = cookieHeader.split(";");
  for (const entry of entries) {
    const [rawKey, ...rawValueParts] = entry.split("=");
    if (!rawKey || rawValueParts.length === 0) {
      continue;
    }
    if (rawKey.trim() !== key) {
      continue;
    }
    const rawValue = rawValueParts.join("=").trim();
    if (!rawValue) {
      return null;
    }
    try {
      return decodeURIComponent(rawValue);
    } catch {
      return rawValue;
    }
  }

  return null;
}

function determineAffectedBlock(runtimeErrors) {
  let hasHero = false;
  let hasRoles = false;
  for (const error of runtimeErrors) {
    if (error.module === "landing.step1.hero") {
      hasHero = true;
    } else if (error.module === "landing.step2.roles") {
      hasRoles = true;
    }
  }

  if (hasHero && hasRoles) {
    return "landing";
  }
  if (hasHero) {
    return "hero";
  }
  if (hasRoles) {
    return "roles";
  }
  return "landing";
}

function classifySchemaViolationLevel(level) {
  return level === "structural" ? "error" : "warn";
}

function emitContentSchemaViolations(logger, runtimeErrors) {
  for (const runtimeError of runtimeErrors) {
    const missingFields =
      runtimeError.error_code === "content_missing_field"
        ? [decodePointerToken(runtimeError.json_pointer.split("/").filter(Boolean).at(-1) ?? "unknown")]
        : undefined;

    const payload = {
      degradation_tier: runtimeError.level,
      path: runtimeError.json_pointer
    };
    if (missingFields) {
      payload.missing_fields = missingFields;
    }

    logger[classifySchemaViolationLevel(runtimeError.level)]({
      event: "content_schema_violation_detected",
      domain: "content",
      module: "content/validator",
      payload,
      error: createObsError(
        `content.${runtimeError.error_code}`,
        "validation",
        false,
        "domain",
        "content schema violation detected"
      )
    });
  }
}

function selectHeroVariant(step1, cookieHeader) {
  if (!step1 || !step1.experiment || !step1.variants) {
    return null;
  }

  const available = step1.experiment.variants.filter((variant) => Boolean(step1.variants[variant]));
  if (!available.length) {
    return null;
  }

  const persisted = parseCookieValue(cookieHeader, "heroVariant");
  if (persisted && available.includes(persisted)) {
    return {
      variant: persisted,
      reason: "persisted"
    };
  }

  const ordered = step1.experiment.variants.filter((variant) => available.includes(variant));
  if (!ordered.length) {
    return {
      variant: available[0],
      reason: "fallback"
    };
  }

  const totalWeight = ordered.reduce((acc, variant) => {
    const weight = step1.experiment.distribution?.[variant];
    if (typeof weight !== "number" || !Number.isFinite(weight) || weight <= 0) {
      return acc;
    }
    return acc + weight;
  }, 0);

  if (totalWeight <= 0) {
    return {
      variant: ordered[0],
      reason: "fallback"
    };
  }

  const random = Math.random() * totalWeight;
  let cumulative = 0;
  for (const variant of ordered) {
    cumulative += step1.experiment.distribution[variant];
    if (random < cumulative) {
      return {
        variant,
        reason: "random"
      };
    }
  }

  return {
    variant: ordered[ordered.length - 1],
    reason: "random"
  };
}

function resolveManifestPath(repoRoot, manifestPathOverride, manifestPathFallback) {
  const candidate = manifestPathOverride || manifestPathFallback;
  if (path.isAbsolute(candidate)) {
    return candidate;
  }
  return path.resolve(repoRoot, candidate);
}

function resolveModulePath(repoRoot, modulePath) {
  if (path.isAbsolute(modulePath)) {
    return modulePath;
  }
  return path.resolve(repoRoot, modulePath);
}

function toRepoRelativePath(repoRoot, absolutePath) {
  return path.relative(repoRoot, absolutePath).split(path.sep).join("/");
}

class LandingContentLoadError extends Error {
  constructor({ code, category, retryable, origin, filePath, stage }) {
    super(stage);
    this.code = code;
    this.category = category;
    this.retryable = retryable;
    this.origin = origin;
    this.filePath = filePath;
    this.stage = stage;
  }
}

async function readJsonFileOrThrow(absolutePath) {
  let raw;
  try {
    raw = await readFile(absolutePath, "utf8");
  } catch {
    throw new LandingContentLoadError({
      code: "content.bundle_load_failed",
      category: "dependency",
      retryable: true,
      origin: "infra",
      filePath: absolutePath,
      stage: "read"
    });
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new LandingContentLoadError({
      code: "content.bundle_parse_failed",
      category: "validation",
      retryable: false,
      origin: "domain",
      filePath: absolutePath,
      stage: "parse"
    });
  }
}

async function loadLandingBundle({ repoRoot, manifestPathOverride, landingContentFiles }) {
  const manifestAbsolutePath = resolveManifestPath(
    repoRoot,
    manifestPathOverride,
    landingContentFiles.manifest
  );
  const manifest = await readJsonFileOrThrow(manifestAbsolutePath);
  const manifestModules = asObject(manifest?.modules) ?? {};
  const modules = {};

  for (const [moduleName, fallbackPath] of Object.entries(landingContentFiles.modules)) {
    const configured = asObject(manifestModules[moduleName]);
    const modulePathFromManifest =
      configured && typeof configured.path === "string" && configured.path.trim().length > 0
        ? configured.path
        : fallbackPath;
    const moduleAbsolutePath = resolveModulePath(repoRoot, modulePathFromManifest);
    modules[moduleName] = await readJsonFileOrThrow(moduleAbsolutePath);
  }

  const contentBundleHash = hashCanonicalJson({
    manifest,
    modules
  });

  return {
    manifest,
    modules,
    contentBundleHash
  };
}

function validateLandingContentRuntimeFallback(input) {
  const errors = [];
  const runtimeErrors = [];
  const manifestFile = defaultLandingContentFiles.manifest;
  const step1File = defaultLandingContentFiles.modules["landing.step1.hero"];
  const step2File = defaultLandingContentFiles.modules["landing.step2.roles"];

  const push = (file, pointer, errorCode, module, level) => {
    const entry = {
      file,
      json_pointer: pointer,
      error_code: errorCode
    };
    errors.push(entry);
    runtimeErrors.push({
      ...entry,
      module,
      level
    });
  };

  const manifest = asObject(input?.manifest);
  if (!manifest) {
    push(manifestFile, "/", "content_invalid_type", "landing.manifest", "structural");
    return { errors, runtime_errors: runtimeErrors, manifest: null, step1: null, step2: null };
  }

  if (manifest.module !== "landing.manifest") {
    push(manifestFile, "/module", "content_invalid_type", "landing.manifest", "structural");
  }
  if (!parseSemver(manifest.schema_version)) {
    push(manifestFile, "/schema_version", "schema_version_incompatible", "landing.manifest", "structural");
  }

  const modulesObject = asObject(manifest.modules);
  if (!modulesObject) {
    push(manifestFile, "/modules", "content_invalid_type", "landing.manifest", "structural");
  }

  const step1 = asObject(input?.modules?.["landing.step1.hero"]);
  const step2 = asObject(input?.modules?.["landing.step2.roles"]);
  if (!step1) {
    push(step1File, "/", "content_invalid_type", "landing.step1.hero", "structural");
  }
  if (!step2) {
    push(step2File, "/", "content_invalid_type", "landing.step2.roles", "structural");
  }

  if (step1) {
    if (step1.module !== "landing.step1.hero") {
      push(step1File, "/module", "content_invalid_type", "landing.step1.hero", "structural");
    }
    if (!parseSemver(step1.schema_version)) {
      push(step1File, "/schema_version", "schema_version_incompatible", "landing.step1.hero", "structural");
    }
    const experiment = asObject(step1.experiment);
    const variants = asObject(step1.variants);
    if (!experiment) {
      push(step1File, "/experiment", "content_missing_field", "landing.step1.hero", "variant");
    }
    if (!variants) {
      push(step1File, "/variants", "content_missing_field", "landing.step1.hero", "variant");
    }
    if (experiment) {
      if (!Array.isArray(experiment.variants)) {
        push(step1File, "/experiment/variants", "content_invalid_type", "landing.step1.hero", "variant");
      }
      if (!asObject(experiment.distribution)) {
        push(step1File, "/experiment/distribution", "content_invalid_type", "landing.step1.hero", "variant");
      }
      if (experiment.persist_key !== "heroVariant") {
        push(step1File, "/experiment/persist_key", "persist_key_invalid", "landing.step1.hero", "variant");
      }
    }
  }

  if (step2) {
    if (step2.module !== "landing.step2.roles") {
      push(step2File, "/module", "content_invalid_type", "landing.step2.roles", "structural");
    }
    if (!parseSemver(step2.schema_version)) {
      push(step2File, "/schema_version", "schema_version_incompatible", "landing.step2.roles", "structural");
    }
    if (!Array.isArray(step2.roles_order) || step2.roles_order.length !== roleKeys.length) {
      push(step2File, "/roles_order", "roles_invalid_count", "landing.step2.roles", "structural");
    }
    const roles = asObject(step2.roles);
    if (!roles) {
      push(step2File, "/roles", "content_invalid_type", "landing.step2.roles", "structural");
    } else {
      for (const roleKey of roleKeys) {
        const role = asObject(roles[roleKey]);
        if (!role) {
          push(step2File, `/roles/${roleKey}`, "roles_key_mismatch", "landing.step2.roles", "structural");
          continue;
        }
        if (!Array.isArray(role.stories) || role.stories.length !== 3) {
          push(
            step2File,
            `/roles/${roleKey}/stories`,
            "stories_invalid_count",
            "landing.step2.roles",
            "structural"
          );
        }
      }
    }
  }

  if (modulesObject && step1) {
    const entry = asObject(modulesObject["landing.step1.hero"]);
    const expects = entry?.expects;
    if (typeof expects === "string" && !semverSatisfies(step1.schema_version, expects)) {
      push(step1File, "/schema_version", "manifest_version_mismatch", "landing.step1.hero", "structural");
    }
  }
  if (modulesObject && step2) {
    const entry = asObject(modulesObject["landing.step2.roles"]);
    const expects = entry?.expects;
    if (typeof expects === "string" && !semverSatisfies(step2.schema_version, expects)) {
      push(step2File, "/schema_version", "manifest_version_mismatch", "landing.step2.roles", "structural");
    }
  }

  return {
    errors,
    runtime_errors: runtimeErrors,
    manifest,
    step1,
    step2
  };
}

export async function observeLandingRequest({
  logger,
  request,
  repoRoot,
  manifestPathOverride
}) {
  const loadStartedAt = Date.now();
  try {
    const { landingContentFiles, validateLandingContentRuntime } = await getValidatorRuntime();
    const loaded = await loadLandingBundle({
      repoRoot,
      manifestPathOverride,
      landingContentFiles
    });

    logger.info({
      event: "content_bundle_loaded",
      domain: "content",
      module: "content/loader",
      duration_ms: Math.max(0, Date.now() - loadStartedAt),
      payload: {
        content_bundle_hash: loaded.contentBundleHash,
        bundle_version: typeof loaded.manifest?.schema_version === "string" ? loaded.manifest.schema_version : null
      }
    });

    const validation = validateLandingContentRuntime({
      manifest: loaded.manifest,
      modules: loaded.modules
    });

    if (validation.runtime_errors.length > 0) {
      emitContentSchemaViolations(logger, validation.runtime_errors);
      logger.warn({
        event: "landing_render_degraded",
        domain: "landing",
        module: "landing/render",
        payload: {
          reason: "content_schema_violation",
          affected_block: determineAffectedBlock(validation.runtime_errors)
        },
        error: createObsError(
          "landing.render_degraded",
          "validation",
          false,
          "domain",
          "landing rendered with content schema degradation"
        )
      });
    }

    const selection = selectHeroVariant(validation.step1, request.get("cookie"));
    if (!selection) {
      logger.warn({
        event: "landing_render_degraded",
        domain: "landing",
        module: "landing/render",
        payload: {
          reason: "hero_unavailable",
          affected_block: "hero"
        },
        error: createObsError(
          "landing.render_degraded",
          "validation",
          false,
          "domain",
          "hero block is unavailable"
        )
      });
      return;
    }

    const selectedUnit = validation.step1?.variants?.[selection.variant] ?? null;
    const contentUnitHash = selectedUnit ? hashCanonicalJson(selectedUnit) : null;
    logger.info({
      event: "hero_variant_selected",
      domain: "landing",
      module: "landing/ab-selector",
      payload: {
        variant_id: selection.variant,
        reason: selection.reason,
        content_unit_hash: contentUnitHash
      }
    });

    if (selection.reason === "fallback") {
      logger.warn({
        event: "landing_render_degraded",
        domain: "landing",
        module: "landing/render",
        payload: {
          reason: "hero_fallback_used",
          affected_block: "hero",
          content_unit_hash: contentUnitHash
        },
        error: createObsError(
          "landing.hero_fallback_used",
          "validation",
          false,
          "domain",
          "hero fallback variant selected"
        )
      });
    }
  } catch (error) {
    const filePath =
      error instanceof LandingContentLoadError
        ? error.filePath
        : path.resolve(repoRoot, defaultLandingContentFiles.manifest);
    const durationMs = Math.max(0, Date.now() - loadStartedAt);
    const safePath = toRepoRelativePath(repoRoot, filePath);
    const contentError =
      error instanceof LandingContentLoadError
        ? error
        : new LandingContentLoadError({
            code: "content.bundle_load_failed",
            category: "internal",
            retryable: true,
            origin: "infra",
            filePath,
            stage: "unexpected"
          });

    logger.error({
      event: "content_bundle_failed",
      domain: "content",
      module: "content/loader",
      duration_ms: durationMs,
      payload: {
        stage: contentError.stage,
        path: safePath
      },
      error: createObsError(
        contentError.code,
        contentError.category,
        contentError.retryable,
        contentError.origin,
        "landing content bundle load failed"
      )
    });

    logger.warn({
      event: "landing_render_degraded",
      domain: "landing",
      module: "landing/render",
      payload: {
        reason: "content_bundle_failed",
        affected_block: "landing"
      },
      error: createObsError(
        "landing.render_degraded",
        "dependency",
        true,
        "infra",
        "landing rendered without content observability context"
      )
    });
  }
}
