ALTER TABLE llm_simplify_settings
ADD COLUMN user_prompt_template TEXT;

UPDATE llm_simplify_settings
SET user_prompt_template = 'Ниже исходный документ в markdown.
Сделай упрощённый пересказ на русском языке для лектора.
Сохраняй смысл, не придумывай новых фактов, не превращай текст в чат.
Если структура документа помогает понять материал, сохрани её в markdown.

Название документа: {{material_title}}
Slug документа: {{material_slug}}
Путь к источнику: {{material_source_path}}

Исходный документ:
{{source_markdown}}'
WHERE user_prompt_template IS NULL OR trim(user_prompt_template) = '';
