import { createHash, randomUUID } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { extname, join, relative, resolve, sep } from "node:path";

const MATERIAL_STATUSES = new Set(["draft", "working", "final"]);
const CURATION_REVIEWED_AT = "2026-03-13";
const THEME_LABELS_BY_TAG = {
  "knowledge-domain": "Карта домена",
  "teaching-model": "Модель семинара",
  "deep-research": "Внешние кейсы и практика",
  "adoption-playbook": "Внедрение и adoption",
  "implementation-scenarios": "Сценарии внедрения",
  "adaptive-prompting-systems": "Адаптивные prompt-системы",
  "negative-ux-taxonomy": "Проблемы и недоверие",
  taxonomy: "Карта проблем и решений",
  glossary: "Термины и glossary",
  terminology: "Термины и glossary",
  research: "Следующие исследования",
  "research-directions": "Следующие исследования",
  "structured-outputs": "Структурированные ответы",
  "workflow-integration": "Встраивание в workflow",
  "capability-model": "Оценка зрелости",
  maturity: "Оценка зрелости",
  methodology: "Методика семинара"
};

const MATERIALS_REGISTRY = {
  roots: [
    {
      root: "docs/seminar",
      sourceKind: "repo_markdown",
      materialType: "markdown",
      category: "seminar-knowledge",
      audience: "internal-team",
      language: "ru"
    },
    {
      root: "content",
      sourceKind: "repo_pdf",
      materialType: "pdf",
      category: "seminar-assets",
      audience: "internal-team",
      language: "ru"
    }
  ],
  exclude: new Set([
    "docs/seminar/INDEX.md",
    "docs/seminar/LLM_OFFICE_WORK/INDEX.md",
    "content/Методические материалы семинара (1).pdf"
  ]),
  overrides: {
    "content/Методические материалы семинара.pdf": {
      title: "Методические материалы семинара",
      summary: "Базовый PDF-артефакт семинара для внутренней команды.",
      tags: ["pdf", "seminar", "methodology"],
      materialStatus: "final",
      theme: "Методика семинара",
      recommendedForLecturePrep: true,
      curationReviewedAt: CURATION_REVIEWED_AT
    },
    "docs/seminar/ARCH-003.ai.office-work-knowledge-domain.v0.1.md": {
      materialStatus: "final",
      theme: "Карта домена",
      recommendedForLecturePrep: true,
      curationReviewedAt: CURATION_REVIEWED_AT
    },
    "docs/seminar/LLM_OFFICE_WORK/ARCH-004.ai.office-work-taxonomy.v0.1.md": {
      materialStatus: "working",
      theme: "Карта проблем и решений",
      recommendedForLecturePrep: false,
      curationReviewedAt: CURATION_REVIEWED_AT
    },
    "docs/seminar/LLM_OFFICE_WORK/ARCH-005.ai.office-work-terminology.v0.1.md": {
      materialStatus: "working",
      theme: "Термины и glossary",
      recommendedForLecturePrep: false,
      curationReviewedAt: CURATION_REVIEWED_AT
    },
    "docs/seminar/LLM_OFFICE_WORK/ARCH-006.ai.office-work-research-directions.v0.1.md": {
      materialStatus: "draft",
      theme: "Следующие исследования",
      recommendedForLecturePrep: false,
      curationReviewedAt: CURATION_REVIEWED_AT
    },
    "docs/seminar/LLM_OFFICE_WORK/ARCH-007.ai.office-work-negative-ux-taxonomy.v0.1.md": {
      materialStatus: "working",
      theme: "Проблемы и недоверие",
      recommendedForLecturePrep: true,
      curationReviewedAt: CURATION_REVIEWED_AT
    },
    "docs/seminar/LLM_OFFICE_WORK/ARCH-008.ai.office-work-structured-outputs.v0.1.md": {
      materialStatus: "final",
      theme: "Структурированные ответы",
      recommendedForLecturePrep: true,
      curationReviewedAt: CURATION_REVIEWED_AT
    },
    "docs/seminar/LLM_OFFICE_WORK/ARCH-009.ai.office-work-workflow-integration.v0.1.md": {
      materialStatus: "final",
      theme: "Встраивание в workflow",
      recommendedForLecturePrep: true,
      curationReviewedAt: CURATION_REVIEWED_AT
    },
    "docs/seminar/LLM_OFFICE_WORK/ARCH-010.ai.office-work-deep-research.v0.1.md": {
      materialStatus: "working",
      theme: "Внешние кейсы и практика",
      recommendedForLecturePrep: true,
      curationReviewedAt: CURATION_REVIEWED_AT
    },
    "docs/seminar/LLM_OFFICE_WORK/ARCH-011.ai.office-work-adoption-playbook.v0.1.md": {
      materialStatus: "working",
      theme: "Внедрение и adoption",
      recommendedForLecturePrep: true,
      curationReviewedAt: CURATION_REVIEWED_AT
    },
    "docs/seminar/LLM_OFFICE_WORK/ARCH-012.ai.office-work-implementation-scenarios.v0.1.md": {
      materialStatus: "working",
      theme: "Сценарии внедрения",
      recommendedForLecturePrep: true,
      curationReviewedAt: CURATION_REVIEWED_AT
    },
    "docs/seminar/LLM_OFFICE_WORK/ARCH-013.ai.office-work-adaptive-prompting-systems.v0.1.md": {
      materialStatus: "working",
      theme: "Адаптивные prompt-системы",
      recommendedForLecturePrep: true,
      curationReviewedAt: CURATION_REVIEWED_AT
    },
    "docs/seminar/LLM_OFFICE_WORK/ARCH-014.ai.office-work-seminar-teaching-model.v0.1.md": {
      materialStatus: "final",
      theme: "Модель семинара",
      recommendedForLecturePrep: true,
      curationReviewedAt: CURATION_REVIEWED_AT
    },
    "docs/seminar/LLM_OFFICE_WORK/ARCH-015.ai.office-work-capability-model.v0.1.md": {
      materialStatus: "draft",
      theme: "Оценка зрелости",
      recommendedForLecturePrep: false,
      curationReviewedAt: CURATION_REVIEWED_AT
    }
  }
};

function normalizeRelativePath(filePath) {
  return filePath.split(sep).join("/");
}

function collectFiles(rootDir, collected = []) {
  if (!existsSync(rootDir)) {
    return collected;
  }

  const entries = readdirSync(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = join(rootDir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(absolutePath, collected);
      continue;
    }

    collected.push(absolutePath);
  }

  return collected;
}

function toSlug(relativePath) {
  const digest = createHash("sha1").update(relativePath).digest("hex").slice(0, 10);
  const raw = relativePath
    .toLowerCase()
    .replace(/\\/g, "/")
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9/.-]+/g, "-")
    .replace(/[/.]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return raw ? `${raw}-${digest}` : `material-${digest}`;
}

function toTitleFromFileName(fileName) {
  return fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractMarkdownMetadata(absolutePath) {
  const text = readFileSync(absolutePath, "utf8");
  const frontmatter = extractFrontmatter(text);
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  const contentLines = stripFrontmatter(lines);
  const titleLine = contentLines.find((line) => line.startsWith("# "));
  const title = titleLine ? titleLine.slice(2).trim() : null;

  let summary = null;
  for (const line of contentLines) {
    if (!isMeaningfulSummaryLine(line)) {
      continue;
    }
    summary = line;
    break;
  }

  return {
    title,
    summary,
    materialStatus: sanitizeMaterialStatus(frontmatter.status),
    sourceUpdatedAt: readSimpleString(frontmatter.last_updated),
    tags: extractFrontmatterTagList(frontmatter.tags)
  };
}

function stripFrontmatter(lines) {
  if (lines[0] !== "---") {
    return lines;
  }

  const closingIndex = lines.findIndex((line, index) => index > 0 && line === "---");
  if (closingIndex === -1) {
    return lines;
  }

  return lines.slice(closingIndex + 1);
}

function isMeaningfulSummaryLine(line) {
  if (!line || line.startsWith("#")) {
    return false;
  }

  if (line === "---") {
    return false;
  }

  if (/^[a-z_][a-z0-9_]*:\s*/i.test(line)) {
    return false;
  }

  return true;
}

function inferTags(relativePath, category, sourceKind, frontmatterTags = []) {
  const segments = relativePath.split("/");
  const tags = new Set([category, sourceKind, "cabinet"]);

  for (const segment of segments.slice(0, -1)) {
    const normalized = segment
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    if (normalized) {
      tags.add(normalized);
    }
  }

  for (const tag of frontmatterTags) {
    const normalized = tag
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-|-$/g, "");
    if (normalized) {
      tags.add(normalized);
    }
  }

  return Array.from(tags);
}

function buildMaterialRecord(repoRoot, relativePath, rootConfig) {
  const absolutePath = resolve(repoRoot, relativePath);
  const override = MATERIALS_REGISTRY.overrides[relativePath] ?? {};
  const markdownMetadata =
    rootConfig.sourceKind === "repo_markdown"
      ? extractMarkdownMetadata(absolutePath)
      : { title: null, summary: null, materialStatus: null, sourceUpdatedAt: null, tags: [] };
  const title = override.title ?? markdownMetadata.title ?? toTitleFromFileName(relativePath.split("/").at(-1) ?? relativePath);
  const summary = override.summary ?? markdownMetadata.summary ?? null;
  const tags = override.tags ?? inferTags(relativePath, rootConfig.category, rootConfig.sourceKind, markdownMetadata.tags);
  const materialStatus = sanitizeMaterialStatus(override.materialStatus)
    ?? markdownMetadata.materialStatus
    ?? "draft";
  const sourceUpdatedAt = readSimpleString(override.sourceUpdatedAt)
    ?? markdownMetadata.sourceUpdatedAt
    ?? null;
  // Curator review timestamp tracks when the cabinet metadata was manually re-evaluated.
  // It is intentionally separate from sourceUpdatedAt so lecturers can trust library curation
  // without assuming the underlying source document changed on the same date.
  const curationReviewedAt = readSimpleString(override.curationReviewedAt) ?? CURATION_REVIEWED_AT;
  const theme = readSimpleString(override.theme) ?? inferTheme(tags, rootConfig.category);
  const recommendedForLecturePrep =
    typeof override.recommendedForLecturePrep === "boolean"
      ? override.recommendedForLecturePrep
      : materialStatus === "working" || materialStatus === "final";

  return {
    id: randomUUID(),
    slug: toSlug(relativePath),
    title,
    summary,
    materialStatus,
    materialType: rootConfig.materialType,
    category: rootConfig.category,
    theme,
    audience: rootConfig.audience,
    language: rootConfig.language,
    sourceUpdatedAt,
    curationReviewedAt,
    sourceKind: rootConfig.sourceKind,
    sourcePath: relativePath,
    recommendedForLecturePrep,
    tags
  };
}

export function buildMaterialsFromRegistry(repoRoot) {
  const materials = [];

  for (const rootConfig of MATERIALS_REGISTRY.roots) {
    const absoluteRoot = resolve(repoRoot, rootConfig.root);
    const files = collectFiles(absoluteRoot);

    for (const absolutePath of files) {
      const relativePath = normalizeRelativePath(relative(repoRoot, absolutePath));
      if (MATERIALS_REGISTRY.exclude.has(relativePath)) {
        continue;
      }

      const extension = extname(absolutePath).toLowerCase();
      if (rootConfig.sourceKind === "repo_markdown" && extension !== ".md") {
        continue;
      }
      if (rootConfig.sourceKind === "repo_pdf" && extension !== ".pdf") {
        continue;
      }

      materials.push(buildMaterialRecord(repoRoot, relativePath, rootConfig));
    }
  }

  return materials.sort((left, right) => left.title.localeCompare(right.title, "ru"));
}

export function syncMaterialsFromRegistry(database, repoRoot) {
  const materials = buildMaterialsFromRegistry(repoRoot);
  const now = new Date().toISOString();
  const activePaths = new Set(materials.map((material) => material.sourcePath));

  // Registry is the curated source of truth for v1; missing rows are deactivated
  // so stale material records do not silently leak into the cabinet.
  database.prepare("UPDATE materials SET is_active = 0, updated_at = ?").run(now);

  const existingByPath = new Map(
    database
      .prepare("SELECT id, source_path, created_at FROM materials")
      .all()
      .map((row) => [row.source_path, row])
  );

  for (const material of materials) {
    const existing = existingByPath.get(material.sourcePath);
    const id = existing?.id ?? material.id;
    const createdAt = existing?.created_at ?? now;

    database
      .prepare(
        `INSERT INTO materials (
          id,
          slug,
          title,
          summary,
          material_status,
          material_type,
          category,
          theme,
          audience,
          language,
          source_updated_at,
          curation_reviewed_at,
          source_kind,
          source_path,
          recommended_for_lecture_prep,
          tags_json,
          is_active,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
        ON CONFLICT(source_path) DO UPDATE SET
          slug = excluded.slug,
          title = excluded.title,
          summary = excluded.summary,
          material_status = excluded.material_status,
          material_type = excluded.material_type,
          category = excluded.category,
          theme = excluded.theme,
          audience = excluded.audience,
          language = excluded.language,
          source_updated_at = excluded.source_updated_at,
          curation_reviewed_at = excluded.curation_reviewed_at,
          source_kind = excluded.source_kind,
          recommended_for_lecture_prep = excluded.recommended_for_lecture_prep,
          tags_json = excluded.tags_json,
          is_active = 1,
          updated_at = excluded.updated_at`
      )
      .run(
        id,
        material.slug,
        material.title,
        material.summary,
        material.materialStatus,
        material.materialType,
        material.category,
        material.theme,
        material.audience,
        material.language,
        material.sourceUpdatedAt,
        material.curationReviewedAt,
        material.sourceKind,
        material.sourcePath,
        material.recommendedForLecturePrep ? 1 : 0,
        JSON.stringify(material.tags),
        createdAt,
        now
      );
  }

  return {
    totalCount: materials.length,
    activePaths
  };
}

function extractFrontmatter(text) {
  const normalizedText = typeof text === "string" ? text.replace(/^\uFEFF/, "") : "";
  const match = normalizedText.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) {
    return {};
  }

  const frontmatter = {};
  const lines = match[1].split(/\r?\n/);
  let currentListKey = null;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    if (trimmed.startsWith("- ") && currentListKey) {
      const list = Array.isArray(frontmatter[currentListKey]) ? frontmatter[currentListKey] : [];
      list.push(trimmed.slice(2).trim());
      frontmatter[currentListKey] = list;
      continue;
    }

    const keyMatch = rawLine.match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/);
    if (!keyMatch) {
      currentListKey = null;
      continue;
    }

    const [, key, value] = keyMatch;
    if (value.trim().length === 0) {
      frontmatter[key] = [];
      currentListKey = key;
      continue;
    }

    frontmatter[key] = value.trim();
    currentListKey = null;
  }

  return frontmatter;
}

function extractFrontmatterTagList(rawTags) {
  if (!Array.isArray(rawTags)) {
    return [];
  }

  return rawTags
    .map((tag) => readSimpleString(tag))
    .filter((tag) => tag !== null);
}

function sanitizeMaterialStatus(value) {
  const normalized = readSimpleString(value)?.toLowerCase();
  return normalized && MATERIAL_STATUSES.has(normalized) ? normalized : null;
}

function inferTheme(tags, category) {
  for (const tag of tags) {
    if (THEME_LABELS_BY_TAG[tag]) {
      return THEME_LABELS_BY_TAG[tag];
    }
  }

  if (category === "seminar-assets") {
    return "Материалы семинара";
  }

  return "Семинарные материалы";
}

function readSimpleString(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}
