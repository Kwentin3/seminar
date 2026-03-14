const DEFAULT_SYSTEM_PROMPT_LINES = [
  "Ты помогаешь преподавателю быстро понять документ.",
  "Перескажи исходный материал простым и точным русским языком.",
  "Не придумывай новые факты, не меняй смысл, явно помечай неопределённость.",
  "Сохраняй полезную markdown-структуру: короткие заголовки, списки и акценты, если это помогает читать текст.",
  "Не упоминай, что ты модель.",
  "Не добавляй внешние знания."
];

const DEFAULT_USER_PROMPT_TEMPLATE_LINES = [
  "Ниже исходный документ в markdown.",
  "Сделай упрощённый пересказ на русском языке для лектора.",
  "Сохраняй смысл, не придумывай новых фактов, не превращай текст в чат.",
  "Если структура документа помогает понять материал, сохрани её в markdown.",
  "",
  "Название документа: {{material_title}}",
  "Slug документа: {{material_slug}}",
  "Путь к источнику: {{material_source_path}}",
  "",
  "Исходный документ:",
  "{{source_markdown}}"
];

export const DEFAULT_SIMPLIFY_SYSTEM_PROMPT = DEFAULT_SYSTEM_PROMPT_LINES.join(" ");
export const DEFAULT_SIMPLIFY_USER_PROMPT_TEMPLATE = DEFAULT_USER_PROMPT_TEMPLATE_LINES.join("\n");
export const SIMPLIFY_PROMPT_TEMPLATE_TOKENS = [
  "{{material_title}}",
  "{{material_slug}}",
  "{{material_source_path}}",
  "{{source_markdown}}"
];

export function getDefaultSimplifyPromptConfig() {
  return {
    system_prompt: DEFAULT_SIMPLIFY_SYSTEM_PROMPT,
    user_prompt_template: DEFAULT_SIMPLIFY_USER_PROMPT_TEMPLATE
  };
}

export function renderSimplifyUserPrompt(template, material, markdown) {
  const normalizedTemplate = typeof template === "string" && template.trim().length > 0
    ? template
    : DEFAULT_SIMPLIFY_USER_PROMPT_TEMPLATE;

  const replacements = {
    "{{material_title}}": material.title,
    "{{material_slug}}": material.slug,
    "{{material_source_path}}": material.source_path ?? "",
    "{{source_markdown}}": markdown
  };

  return Object.entries(replacements).reduce((result, [token, value]) => {
    return result.split(token).join(value);
  }, normalizedTemplate);
}
