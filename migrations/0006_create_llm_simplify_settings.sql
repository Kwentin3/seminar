CREATE TABLE IF NOT EXISTS llm_simplify_settings (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  feature_enabled INTEGER NOT NULL DEFAULT 1 CHECK (feature_enabled IN (0, 1)),
  model TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  temperature REAL,
  max_output_tokens INTEGER,
  updated_at TEXT NOT NULL,
  updated_by_user_id TEXT,
  FOREIGN KEY (updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO llm_simplify_settings (
  id,
  provider,
  feature_enabled,
  model,
  system_prompt,
  prompt_version,
  temperature,
  max_output_tokens,
  updated_at,
  updated_by_user_id
) VALUES (
  'default',
  'deepseek',
  1,
  'deepseek-chat',
  'Ты помогаешь преподавателю быстро понять документ. Перескажи исходный материал простым и точным русским языком. Не придумывай новые факты, не меняй смысл, явно помечай неопределённость. Сохраняй полезную markdown-структуру: короткие заголовки, списки и акценты, если это помогает читать текст. Не упоминай, что ты модель. Не добавляй внешние знания.',
  'v1',
  NULL,
  NULL,
  CURRENT_TIMESTAMP,
  NULL
)
ON CONFLICT(id) DO NOTHING;
