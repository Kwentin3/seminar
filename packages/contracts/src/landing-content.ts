type Locale = "ru" | "en";

export const landingContentFiles = {
  manifest: "content/landing/manifest.v1.json",
  modules: {
    "landing.step1.hero": "content/landing/step1.hero.v1.json",
    "landing.step2.roles": "content/landing/step2.roles.v1.json"
  }
} as const;

export type LandingModuleName = keyof typeof landingContentFiles.modules;

export const heroVariantKeys = ["aggressive", "rational", "partner"] as const;
export type HeroVariantKey = (typeof heroVariantKeys)[number];

export const roleKeys = ["business_owner", "operations_lead", "it_lead"] as const;
export type RoleKey = (typeof roleKeys)[number];

export const contentErrorCodes = [
  "content_missing_field",
  "content_invalid_type",
  "schema_version_incompatible",
  "i18n_missing_locale",
  "i18n_empty_string",
  "invalid_id_format",
  "duplicate_id",
  "distribution_sum_invalid",
  "distribution_key_mismatch",
  "persist_key_invalid",
  "anchor_target_not_allowed",
  "anchor_invalid_format",
  "roles_key_mismatch",
  "roles_invalid_count",
  "stories_invalid_count",
  "manifest_module_missing",
  "manifest_version_mismatch"
] as const;

export type ContentErrorCode = (typeof contentErrorCodes)[number];

export type ContentValidationError = {
  file: string;
  json_pointer: string;
  error_code: ContentErrorCode;
};

export type I18nText = {
  i18n: Record<Locale, string>;
};

export type TextItem = {
  id: string;
  text: I18nText;
  enabled?: boolean;
};

export type Link = {
  kind: "anchor";
  target: string;
};

export type CtaItem = {
  id: string;
  text: I18nText;
  enabled?: boolean;
  link: Link;
};

export type HeroVariant = {
  headline: I18nText;
  subheadline: I18nText;
  body: TextItem[];
  badges: TextItem[];
  cta: CtaItem[];
};

export type Step1HeroModule = {
  schema_version: string;
  module: "landing.step1.hero";
  anchors: Record<string, string>;
  experiment: {
    id: string;
    persist_key: "heroVariant";
    variants: HeroVariantKey[];
    distribution: Record<HeroVariantKey, number>;
  };
  variants: Partial<Record<HeroVariantKey, HeroVariant>>;
};

export type RoleContent = {
  label: I18nText;
  stories: TextItem[];
};

export type Step2RolesModule = {
  schema_version: string;
  module: "landing.step2.roles";
  roles_order: RoleKey[];
  roles: Record<RoleKey, RoleContent>;
};

export type LandingManifest = {
  schema_version: string;
  module: "landing.manifest";
  modules: Record<
    LandingModuleName,
    {
      path: string;
      expects: string;
    }
  >;
};

export type LandingValidationInput = {
  manifest: unknown;
  modules: Partial<Record<LandingModuleName, unknown>>;
};

export type LandingValidationResult = {
  errors: ContentValidationError[];
  manifest: LandingManifest | null;
  step1: Step1HeroModule | null;
  step2: Step2RolesModule | null;
};

const semverRegex = /^\d+\.\d+\.\d+$/;
const stableIdRegex = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;
const anchorTargetRegex = /^#[a-z][a-z0-9_-]{0,49}$/;

const moduleNames: LandingModuleName[] = ["landing.step1.hero", "landing.step2.roles"];
const roleKeySet = new Set<RoleKey>(roleKeys);
const heroVariantSet = new Set<HeroVariantKey>(heroVariantKeys);

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function pushError(
  errors: ContentValidationError[],
  file: string,
  jsonPointer: string,
  errorCode: ContentErrorCode
) {
  errors.push({
    file,
    json_pointer: jsonPointer,
    error_code: errorCode
  });
}

function escapePointer(token: string): string {
  return token.replaceAll("~", "~0").replaceAll("/", "~1");
}

function appendPointer(base: string, token: string | number): string {
  const suffix = `/${escapePointer(String(token))}`;
  return base === "/" ? suffix : `${base}${suffix}`;
}

type ParsedSemver = {
  major: number;
  minor: number;
  patch: number;
};

function parseSemver(value: string): ParsedSemver | null {
  if (!semverRegex.test(value)) {
    return null;
  }

  const [major, minor, patch] = value.split(".").map((chunk) => Number.parseInt(chunk, 10));
  if ([major, minor, patch].some((part) => Number.isNaN(part))) {
    return null;
  }

  return { major, minor, patch };
}

function compareSemver(a: ParsedSemver, b: ParsedSemver): number {
  if (a.major !== b.major) {
    return a.major - b.major;
  }
  if (a.minor !== b.minor) {
    return a.minor - b.minor;
  }
  return a.patch - b.patch;
}

function semverSatisfies(version: string, expects: string): boolean {
  const parsedVersion = parseSemver(version);
  if (!parsedVersion) {
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

    return (
      parsedVersion.major === 0 &&
      parsedVersion.minor === 0 &&
      parsedVersion.patch === base.patch
    );
  }

  const exact = parseSemver(expects);
  if (!exact) {
    return false;
  }
  return compareSemver(parsedVersion, exact) === 0;
}

function validateSchemaVersion(
  value: unknown,
  file: string,
  pointer: string,
  errors: ContentValidationError[]
): string | null {
  if (typeof value !== "string") {
    pushError(errors, file, pointer, "content_invalid_type");
    return null;
  }

  if (!parseSemver(value)) {
    pushError(errors, file, pointer, "schema_version_incompatible");
    return null;
  }

  return value;
}

function validateI18nText(
  value: unknown,
  file: string,
  pointer: string,
  errors: ContentValidationError[]
): I18nText | null {
  const asI18nWrapper = asObject(value);
  if (!asI18nWrapper) {
    pushError(errors, file, pointer, "content_invalid_type");
    return null;
  }

  if (!Object.prototype.hasOwnProperty.call(asI18nWrapper, "i18n")) {
    pushError(errors, file, appendPointer(pointer, "i18n"), "content_missing_field");
    return null;
  }

  const asI18n = asObject(asI18nWrapper.i18n);
  if (!asI18n) {
    pushError(errors, file, appendPointer(pointer, "i18n"), "content_invalid_type");
    return null;
  }

  const locales: Locale[] = ["ru", "en"];
  const result = { i18n: { ru: "", en: "" } as Record<Locale, string> };

  for (const locale of locales) {
    if (!Object.prototype.hasOwnProperty.call(asI18n, locale)) {
      pushError(errors, file, appendPointer(appendPointer(pointer, "i18n"), locale), "i18n_missing_locale");
      continue;
    }

    const localizedValue = asI18n[locale];
    if (typeof localizedValue !== "string") {
      pushError(
        errors,
        file,
        appendPointer(appendPointer(pointer, "i18n"), locale),
        "content_invalid_type"
      );
      continue;
    }

    if (localizedValue.trim().length === 0) {
      pushError(
        errors,
        file,
        appendPointer(appendPointer(pointer, "i18n"), locale),
        "i18n_empty_string"
      );
      continue;
    }

    result.i18n[locale] = localizedValue;
  }

  if (!result.i18n.ru || !result.i18n.en) {
    return null;
  }

  return result;
}

function validateStableId(
  value: unknown,
  file: string,
  pointer: string,
  errors: ContentValidationError[]
): string | null {
  if (typeof value !== "string") {
    pushError(errors, file, pointer, "content_invalid_type");
    return null;
  }
  if (!stableIdRegex.test(value)) {
    pushError(errors, file, pointer, "invalid_id_format");
    return null;
  }
  return value;
}

function findAnyEnabledPointers(
  value: unknown,
  pointer: string,
  out: string[] = []
): string[] {
  const obj = asObject(value);
  if (!obj) {
    return out;
  }

  for (const [key, child] of Object.entries(obj)) {
    const nextPointer = appendPointer(pointer, key);
    if (key === "enabled") {
      out.push(nextPointer);
    }
    if (Array.isArray(child)) {
      child.forEach((item, index) => {
        findAnyEnabledPointers(item, appendPointer(nextPointer, index), out);
      });
      continue;
    }
    findAnyEnabledPointers(child, nextPointer, out);
  }

  return out;
}

function parseHeroTextItems(
  value: unknown,
  file: string,
  pointer: string,
  errors: ContentValidationError[],
  idRegistry: Set<string>,
  options: {
    minItems: number;
    allowEnabled: boolean;
  }
): TextItem[] {
  if (!Array.isArray(value)) {
    pushError(errors, file, pointer, "content_invalid_type");
    return [];
  }

  const parsedItems: TextItem[] = [];

  value.forEach((item, index) => {
    const itemPointer = appendPointer(pointer, index);
    const asItem = asObject(item);
    if (!asItem) {
      pushError(errors, file, itemPointer, "content_invalid_type");
      return;
    }

    let enabled: boolean | undefined;
    if (Object.prototype.hasOwnProperty.call(asItem, "enabled")) {
      if (!options.allowEnabled) {
        pushError(errors, file, appendPointer(itemPointer, "enabled"), "content_invalid_type");
      } else if (typeof asItem.enabled !== "boolean") {
        pushError(errors, file, appendPointer(itemPointer, "enabled"), "content_invalid_type");
      } else {
        enabled = asItem.enabled;
      }
    }

    const id = validateStableId(asItem.id, file, appendPointer(itemPointer, "id"), errors);
    const text = validateI18nText(asItem.text, file, appendPointer(itemPointer, "text"), errors);
    if (!id || !text) {
      return;
    }

    if (idRegistry.has(id)) {
      pushError(errors, file, appendPointer(itemPointer, "id"), "duplicate_id");
      return;
    }

    idRegistry.add(id);
    parsedItems.push({
      id,
      text,
      enabled
    });
  });

  const afterEnabled = parsedItems.filter((item) => item.enabled !== false);
  if (afterEnabled.length < options.minItems) {
    pushError(errors, file, pointer, "content_invalid_type");
  }

  return afterEnabled;
}

function parseHeroCtas(
  value: unknown,
  file: string,
  pointer: string,
  errors: ContentValidationError[],
  idRegistry: Set<string>,
  allowedAnchorTargets: Set<string>
): CtaItem[] {
  if (!Array.isArray(value)) {
    pushError(errors, file, pointer, "content_invalid_type");
    return [];
  }

  const parsed: CtaItem[] = [];

  value.forEach((item, index) => {
    const itemPointer = appendPointer(pointer, index);
    const asItem = asObject(item);
    if (!asItem) {
      pushError(errors, file, itemPointer, "content_invalid_type");
      return;
    }

    let enabled: boolean | undefined;
    if (Object.prototype.hasOwnProperty.call(asItem, "enabled")) {
      if (typeof asItem.enabled !== "boolean") {
        pushError(errors, file, appendPointer(itemPointer, "enabled"), "content_invalid_type");
      } else {
        enabled = asItem.enabled;
      }
    }

    const id = validateStableId(asItem.id, file, appendPointer(itemPointer, "id"), errors);
    const text = validateI18nText(asItem.text, file, appendPointer(itemPointer, "text"), errors);
    const linkObj = asObject(asItem.link);
    if (!linkObj) {
      pushError(errors, file, appendPointer(itemPointer, "link"), "content_invalid_type");
    }

    if (!id || !text || !linkObj) {
      return;
    }

    if (idRegistry.has(id)) {
      pushError(errors, file, appendPointer(itemPointer, "id"), "duplicate_id");
      return;
    }

    const kind = linkObj.kind;
    if (kind !== "anchor") {
      pushError(errors, file, appendPointer(appendPointer(itemPointer, "link"), "kind"), "content_invalid_type");
      return;
    }

    const target = linkObj.target;
    if (typeof target !== "string") {
      pushError(
        errors,
        file,
        appendPointer(appendPointer(itemPointer, "link"), "target"),
        "content_invalid_type"
      );
      return;
    }

    if (!anchorTargetRegex.test(target)) {
      pushError(
        errors,
        file,
        appendPointer(appendPointer(itemPointer, "link"), "target"),
        "anchor_invalid_format"
      );
      return;
    }

    if (!allowedAnchorTargets.has(target)) {
      pushError(
        errors,
        file,
        appendPointer(appendPointer(itemPointer, "link"), "target"),
        "anchor_target_not_allowed"
      );
      return;
    }

    idRegistry.add(id);
    parsed.push({
      id,
      text,
      enabled,
      link: { kind: "anchor", target }
    });
  });

  const afterEnabled = parsed.filter((item) => item.enabled !== false);
  if (!afterEnabled.length) {
    pushError(errors, file, pointer, "content_invalid_type");
  }
  if (!afterEnabled.some((item) => item.link.target === "#roles")) {
    pushError(errors, file, pointer, "anchor_target_not_allowed");
  }

  return afterEnabled;
}

function parseStep1Hero(raw: unknown, file: string, errors: ContentValidationError[]): Step1HeroModule | null {
  const root = asObject(raw);
  if (!root) {
    pushError(errors, file, "/", "content_invalid_type");
    return null;
  }

  if (Object.prototype.hasOwnProperty.call(root, "enabled")) {
    pushError(errors, file, "/enabled", "content_invalid_type");
  }

  const schemaVersion = validateSchemaVersion(root.schema_version, file, "/schema_version", errors);
  const moduleValue = root.module;
  if (moduleValue !== "landing.step1.hero") {
    pushError(errors, file, "/module", "content_invalid_type");
  }

  const anchorsRaw = asObject(root.anchors);
  if (!anchorsRaw) {
    pushError(errors, file, "/anchors", "content_invalid_type");
    return null;
  }

  const anchors: Record<string, string> = {};
  const allowedTargets = new Set<string>();
  for (const [key, value] of Object.entries(anchorsRaw)) {
    const pointer = appendPointer("/anchors", key);
    if (typeof value !== "string") {
      pushError(errors, file, pointer, "content_invalid_type");
      continue;
    }
    if (!anchorTargetRegex.test(value)) {
      pushError(errors, file, pointer, "anchor_invalid_format");
      continue;
    }
    anchors[key] = value;
    allowedTargets.add(value);
  }
  if (!allowedTargets.has("#roles")) {
    pushError(errors, file, "/anchors", "anchor_target_not_allowed");
  }

  const experimentRaw = asObject(root.experiment);
  if (!experimentRaw) {
    pushError(errors, file, "/experiment", "content_invalid_type");
    return null;
  }

  const experimentId = validateStableId(experimentRaw.id, file, "/experiment/id", errors);
  const persistKey = experimentRaw.persist_key;
  if (persistKey !== "heroVariant") {
    pushError(errors, file, "/experiment/persist_key", "persist_key_invalid");
  }

  const variantsArrayRaw = experimentRaw.variants;
  let experimentVariants: HeroVariantKey[] = [];
  if (!Array.isArray(variantsArrayRaw)) {
    pushError(errors, file, "/experiment/variants", "content_invalid_type");
  } else {
    if (variantsArrayRaw.length !== heroVariantKeys.length) {
      pushError(errors, file, "/experiment/variants", "distribution_key_mismatch");
    }

    const asVariantKeys = variantsArrayRaw.filter(
      (entry): entry is HeroVariantKey => typeof entry === "string" && heroVariantSet.has(entry as HeroVariantKey)
    );
    if (asVariantKeys.length !== variantsArrayRaw.length) {
      pushError(errors, file, "/experiment/variants", "distribution_key_mismatch");
    }

    experimentVariants = asVariantKeys;
    if (heroVariantKeys.some((variant, index) => variantsArrayRaw[index] !== variant)) {
      pushError(errors, file, "/experiment/variants", "distribution_key_mismatch");
    }
  }

  const distributionRaw = asObject(experimentRaw.distribution);
  const distribution: Record<HeroVariantKey, number> = {
    aggressive: 0,
    rational: 0,
    partner: 0
  };

  if (!distributionRaw) {
    pushError(errors, file, "/experiment/distribution", "content_invalid_type");
  } else {
    const distributionKeys = Object.keys(distributionRaw);
    const expectedKeys: HeroVariantKey[] = experimentVariants.length
      ? [...experimentVariants]
      : [...heroVariantKeys];
    if (distributionKeys.length !== expectedKeys.length) {
      pushError(errors, file, "/experiment/distribution", "distribution_key_mismatch");
    }

    for (const key of expectedKeys) {
      const pointer = appendPointer("/experiment/distribution", key);
      const rawWeight = distributionRaw[key];
      if (typeof rawWeight !== "number" || Number.isNaN(rawWeight) || rawWeight <= 0) {
        pushError(errors, file, pointer, "content_invalid_type");
        continue;
      }
      distribution[key] = rawWeight;
    }

    for (const key of distributionKeys) {
      if (!heroVariantSet.has(key as HeroVariantKey)) {
        pushError(errors, file, appendPointer("/experiment/distribution", key), "distribution_key_mismatch");
      }
    }

    const sum = expectedKeys.reduce((acc, key) => acc + (distribution[key] ?? 0), 0);
    if (Math.abs(sum - 1) > 1e-3) {
      pushError(errors, file, "/experiment/distribution", "distribution_sum_invalid");
    }
  }

  const variantsRaw = asObject(root.variants);
  if (!variantsRaw) {
    pushError(errors, file, "/variants", "content_invalid_type");
    return null;
  }

  const expectedVariantKeys: HeroVariantKey[] = experimentVariants.length
    ? [...experimentVariants]
    : [...heroVariantKeys];
  const variantObjectKeys = Object.keys(variantsRaw);
  if (expectedVariantKeys.some((variant) => !Object.prototype.hasOwnProperty.call(variantsRaw, variant))) {
    pushError(errors, file, "/variants", "distribution_key_mismatch");
  }
  if (
    variantObjectKeys.some((variant) => !expectedVariantKeys.includes(variant as HeroVariantKey))
  ) {
    pushError(errors, file, "/variants", "distribution_key_mismatch");
  }

  const idRegistry = new Set<string>();
  const parsedVariants: Partial<Record<HeroVariantKey, HeroVariant>> = {};

  for (const variantKey of expectedVariantKeys) {
    const variantPointer = appendPointer("/variants", variantKey);
    const variantRaw = asObject(variantsRaw[variantKey]);
    if (!variantRaw) {
      pushError(errors, file, variantPointer, "content_invalid_type");
      continue;
    }

    if (Object.prototype.hasOwnProperty.call(variantRaw, "id")) {
      pushError(errors, file, appendPointer(variantPointer, "id"), "content_invalid_type");
    }
    if (Object.prototype.hasOwnProperty.call(variantRaw, "enabled")) {
      pushError(errors, file, appendPointer(variantPointer, "enabled"), "content_invalid_type");
    }

    const headline = validateI18nText(variantRaw.headline, file, appendPointer(variantPointer, "headline"), errors);
    const subheadline = validateI18nText(
      variantRaw.subheadline,
      file,
      appendPointer(variantPointer, "subheadline"),
      errors
    );
    const body = parseHeroTextItems(
      variantRaw.body,
      file,
      appendPointer(variantPointer, "body"),
      errors,
      idRegistry,
      { minItems: 2, allowEnabled: true }
    );
    const badges = parseHeroTextItems(
      variantRaw.badges,
      file,
      appendPointer(variantPointer, "badges"),
      errors,
      idRegistry,
      { minItems: 1, allowEnabled: true }
    );
    const cta = parseHeroCtas(
      variantRaw.cta,
      file,
      appendPointer(variantPointer, "cta"),
      errors,
      idRegistry,
      allowedTargets
    );

    if (!headline || !subheadline || body.length < 2 || badges.length < 1 || cta.length < 1) {
      continue;
    }

    parsedVariants[variantKey] = {
      headline,
      subheadline,
      body,
      badges,
      cta
    };
  }

  if (expectedVariantKeys.some((variantKey) => !parsedVariants[variantKey])) {
    pushError(errors, file, "/variants", "content_invalid_type");
  }

  if (!schemaVersion || moduleValue !== "landing.step1.hero" || !experimentId || persistKey !== "heroVariant") {
    return null;
  }

  return {
    schema_version: schemaVersion,
    module: "landing.step1.hero",
    anchors,
    experiment: {
      id: experimentId,
      persist_key: "heroVariant",
      variants: expectedVariantKeys,
      distribution
    },
    variants: parsedVariants
  };
}

function parseStep2Stories(
  value: unknown,
  file: string,
  pointer: string,
  errors: ContentValidationError[],
  idRegistry: Set<string>
): TextItem[] {
  if (!Array.isArray(value)) {
    pushError(errors, file, pointer, "content_invalid_type");
    return [];
  }

  if (value.length !== 3) {
    pushError(errors, file, pointer, "stories_invalid_count");
  }

  const stories: TextItem[] = [];
  value.forEach((entry, index) => {
    const entryPointer = appendPointer(pointer, index);
    const asStory = asObject(entry);
    if (!asStory) {
      pushError(errors, file, entryPointer, "content_invalid_type");
      return;
    }

    if (Object.prototype.hasOwnProperty.call(asStory, "enabled")) {
      pushError(errors, file, appendPointer(entryPointer, "enabled"), "content_invalid_type");
    }

    const id = validateStableId(asStory.id, file, appendPointer(entryPointer, "id"), errors);
    const text = validateI18nText(asStory.text, file, appendPointer(entryPointer, "text"), errors);
    if (!id || !text) {
      return;
    }

    if (idRegistry.has(id)) {
      pushError(errors, file, appendPointer(entryPointer, "id"), "duplicate_id");
      return;
    }

    idRegistry.add(id);
    stories.push({ id, text });
  });

  return stories;
}

function parseStep2Roles(raw: unknown, file: string, errors: ContentValidationError[]): Step2RolesModule | null {
  const root = asObject(raw);
  if (!root) {
    pushError(errors, file, "/", "content_invalid_type");
    return null;
  }

  const enabledPointers = findAnyEnabledPointers(root, "/");
  enabledPointers.forEach((pointer) => {
    pushError(errors, file, pointer, "content_invalid_type");
  });

  const schemaVersion = validateSchemaVersion(root.schema_version, file, "/schema_version", errors);
  const moduleValue = root.module;
  if (moduleValue !== "landing.step2.roles") {
    pushError(errors, file, "/module", "content_invalid_type");
  }

  const rolesOrderRaw = root.roles_order;
  const rolesOrder: RoleKey[] = [];
  if (!Array.isArray(rolesOrderRaw)) {
    pushError(errors, file, "/roles_order", "content_invalid_type");
  } else {
    if (rolesOrderRaw.length !== roleKeys.length) {
      pushError(errors, file, "/roles_order", "roles_invalid_count");
    }
    for (let index = 0; index < rolesOrderRaw.length; index += 1) {
      const value = rolesOrderRaw[index];
      if (typeof value !== "string" || !roleKeySet.has(value as RoleKey)) {
        pushError(errors, file, appendPointer("/roles_order", index), "roles_key_mismatch");
        continue;
      }
      rolesOrder.push(value as RoleKey);
    }

    const deduped = new Set(rolesOrder);
    if (deduped.size !== rolesOrder.length || deduped.size !== roleKeys.length) {
      pushError(errors, file, "/roles_order", "roles_invalid_count");
    }
  }

  const rolesRaw = asObject(root.roles);
  if (!rolesRaw) {
    pushError(errors, file, "/roles", "content_invalid_type");
    return null;
  }

  const keysInRoles = Object.keys(rolesRaw);
  if (keysInRoles.length !== roleKeys.length) {
    pushError(errors, file, "/roles", "roles_invalid_count");
  }
  for (const key of keysInRoles) {
    if (!roleKeySet.has(key as RoleKey)) {
      pushError(errors, file, appendPointer("/roles", key), "roles_key_mismatch");
    }
  }

  for (const roleKey of roleKeys) {
    if (!Object.prototype.hasOwnProperty.call(rolesRaw, roleKey)) {
      pushError(errors, file, appendPointer("/roles", roleKey), "roles_key_mismatch");
    }
  }

  if (rolesOrder.length === roleKeys.length) {
    const orderSet = new Set(rolesOrder);
    const roleSet = new Set(keysInRoles.filter((entry): entry is RoleKey => roleKeySet.has(entry as RoleKey)));
    if (orderSet.size !== roleSet.size || [...orderSet].some((entry) => !roleSet.has(entry))) {
      pushError(errors, file, "/roles_order", "roles_key_mismatch");
    }
  }

  const parsedRoles = {} as Record<RoleKey, RoleContent>;
  const idRegistry = new Set<string>();

  for (const roleKey of roleKeys) {
    const rolePointer = appendPointer("/roles", roleKey);
    const roleRaw = asObject(rolesRaw[roleKey]);
    if (!roleRaw) {
      pushError(errors, file, rolePointer, "content_invalid_type");
      continue;
    }

    const label = validateI18nText(roleRaw.label, file, appendPointer(rolePointer, "label"), errors);
    const stories = parseStep2Stories(
      roleRaw.stories,
      file,
      appendPointer(rolePointer, "stories"),
      errors,
      idRegistry
    );
    if (!label) {
      continue;
    }

    parsedRoles[roleKey] = {
      label,
      stories
    };
  }

  if (!schemaVersion || moduleValue !== "landing.step2.roles") {
    return null;
  }

  const hasAllRoles = roleKeys.every((roleKey) => parsedRoles[roleKey]);
  if (!hasAllRoles) {
    return null;
  }

  return {
    schema_version: schemaVersion,
    module: "landing.step2.roles",
    roles_order: rolesOrder.length === roleKeys.length ? rolesOrder : [...roleKeys],
    roles: parsedRoles
  };
}

function parseManifest(raw: unknown, file: string, errors: ContentValidationError[]): LandingManifest | null {
  const root = asObject(raw);
  if (!root) {
    pushError(errors, file, "/", "content_invalid_type");
    return null;
  }

  const schemaVersion = validateSchemaVersion(root.schema_version, file, "/schema_version", errors);
  if (root.module !== "landing.manifest") {
    pushError(errors, file, "/module", "content_invalid_type");
  }

  const modulesRaw = asObject(root.modules);
  if (!modulesRaw) {
    pushError(errors, file, "/modules", "content_invalid_type");
    return null;
  }

  const modules = {} as LandingManifest["modules"];

  for (const moduleName of moduleNames) {
    const pointer = appendPointer("/modules", moduleName);
    const entryRaw = asObject(modulesRaw[moduleName]);
    if (!entryRaw) {
      pushError(errors, file, pointer, "manifest_module_missing");
      continue;
    }

    const path = entryRaw.path;
    const expects = entryRaw.expects;
    if (typeof path !== "string" || path.trim().length === 0) {
      pushError(errors, file, appendPointer(pointer, "path"), "content_invalid_type");
      continue;
    }
    if (typeof expects !== "string" || expects.trim().length === 0) {
      pushError(errors, file, appendPointer(pointer, "expects"), "content_invalid_type");
      continue;
    }

    modules[moduleName] = {
      path,
      expects
    };
  }

  if (!schemaVersion || root.module !== "landing.manifest") {
    return null;
  }

  if (!moduleNames.every((moduleName) => modules[moduleName])) {
    return null;
  }

  return {
    schema_version: schemaVersion,
    module: "landing.manifest",
    modules
  };
}

function validateLandingContent(input: LandingValidationInput): LandingValidationResult {
  const errors: ContentValidationError[] = [];

  const manifest = parseManifest(input.manifest, landingContentFiles.manifest, errors);
  const step1Raw = input.modules["landing.step1.hero"];
  const step2Raw = input.modules["landing.step2.roles"];

  if (step1Raw === undefined) {
    pushError(errors, landingContentFiles.manifest, "/modules/landing.step1.hero", "manifest_module_missing");
  }
  if (step2Raw === undefined) {
    pushError(errors, landingContentFiles.manifest, "/modules/landing.step2.roles", "manifest_module_missing");
  }

  const step1 = step1Raw === undefined
    ? null
    : parseStep1Hero(step1Raw, landingContentFiles.modules["landing.step1.hero"], errors);
  const step2 = step2Raw === undefined
    ? null
    : parseStep2Roles(step2Raw, landingContentFiles.modules["landing.step2.roles"], errors);

  if (manifest) {
    for (const moduleName of moduleNames) {
      const moduleConfig = manifest.modules[moduleName];
      if (!moduleConfig) {
        continue;
      }

      const moduleParsed = moduleName === "landing.step1.hero" ? step1 : step2;
      if (!moduleParsed) {
        continue;
      }

      if (moduleParsed.module !== moduleName) {
        pushError(errors, landingContentFiles.modules[moduleName], "/module", "content_invalid_type");
      }

      if (!semverSatisfies(moduleParsed.schema_version, moduleConfig.expects)) {
        pushError(errors, landingContentFiles.modules[moduleName], "/schema_version", "manifest_version_mismatch");
      }
    }
  }

  return {
    errors,
    manifest,
    step1,
    step2
  };
}

export function validateLandingContentStrict(input: LandingValidationInput): LandingValidationResult {
  return validateLandingContent(input);
}

export function validateLandingContentRuntime(input: LandingValidationInput): LandingValidationResult {
  return validateLandingContent(input);
}
