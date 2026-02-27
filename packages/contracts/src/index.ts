import { z } from "zod";

export const localeSchema = z.enum(["ru", "en"]);
export type Locale = z.infer<typeof localeSchema>;

export const themeNameSchema = z.enum(["light", "dark"]);
export type ThemeName = z.infer<typeof themeNameSchema>;

export const roleIdSchema = z.string().min(1);
export type RoleId = z.infer<typeof roleIdSchema>;

export const localizedTextSchema = z.object({
  ru: z.string().min(1),
  en: z.string().min(1)
});
export type LocalizedText = z.infer<typeof localizedTextSchema>;

export const roleStoryContentSchema = z.object({
  id: z.string().min(1),
  problem: localizedTextSchema,
  solution: localizedTextSchema,
  result: localizedTextSchema
});
export type RoleStoryContent = z.infer<typeof roleStoryContentSchema>;

export const roleContentSchema = z.object({
  id: roleIdSchema,
  title: localizedTextSchema,
  stories: z.array(roleStoryContentSchema)
});
export type RoleContent = z.infer<typeof roleContentSchema>;

export const rolesContentSchema = z.array(roleContentSchema);

export const countryRequiredErrorCode = "country_required" as const;
export const adminUnauthorizedErrorCode = "admin_unauthorized" as const;

export const apiErrorCodeSchema = z.enum([
  adminUnauthorizedErrorCode,
  countryRequiredErrorCode,
  "config_missing",
  "duplicate_lead",
  "invalid_input",
  "invalid_phone",
  "rate_limited",
  "turnstile_failed",
  "internal_error"
]);
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;

export const apiErrorSchema = z.object({
  code: apiErrorCodeSchema,
  message: z.string().min(1)
});
export type ApiError = z.infer<typeof apiErrorSchema>;

export const createLeadRequestSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(4).max(40),
  country: z.string().trim().regex(/^[A-Za-z]{2}$/).optional(),
  locale: localeSchema,
  source: z.string().trim().min(1).max(64).default("landing"),
  turnstile_token: z.string().trim().min(1)
});
export type CreateLeadRequest = z.infer<typeof createLeadRequestSchema>;

export const createLeadResponseSchema = z.object({
  ok: z.literal(true),
  lead_id: z.string().min(1)
});
export type CreateLeadResponse = z.infer<typeof createLeadResponseSchema>;

export const leadRowSchema = z.object({
  id: z.string().min(1),
  created_at: z.string().min(1),
  name: z.string().min(1),
  phone_e164: z.string().min(1),
  country: z.string().min(1).nullable(),
  locale: localeSchema,
  source: z.string().min(1)
});
export type LeadRow = z.infer<typeof leadRowSchema>;

export const adminListLeadsResponseSchema = z.object({
  ok: z.literal(true),
  items: z.array(leadRowSchema),
  next_cursor: z.string().min(1).optional()
});
export type AdminListLeadsResponse = z.infer<typeof adminListLeadsResponseSchema>;

export * from "./landing-content.js";
