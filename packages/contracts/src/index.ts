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
export const cabinetUnauthorizedErrorCode = "cabinet_unauthorized" as const;
export const cabinetInvalidCredentialsErrorCode = "cabinet_invalid_credentials" as const;
export const cabinetRateLimitedErrorCode = "cabinet_rate_limited" as const;

export const apiErrorCodeSchema = z.enum([
  adminUnauthorizedErrorCode,
  cabinetInvalidCredentialsErrorCode,
  cabinetRateLimitedErrorCode,
  cabinetUnauthorizedErrorCode,
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

export const cabinetRoleSchema = z.enum(["admin", "viewer"]);
export type CabinetRole = z.infer<typeof cabinetRoleSchema>;

export const cabinetMaterialStatusSchema = z.enum(["draft", "working", "final"]);
export type CabinetMaterialStatus = z.infer<typeof cabinetMaterialStatusSchema>;

export const cabinetUserSchema = z.object({
  id: z.string().min(1),
  username: z.string().min(1),
  email: z.string().email().nullable(),
  role: cabinetRoleSchema
});
export type CabinetUser = z.infer<typeof cabinetUserSchema>;

export const cabinetLoginRequestSchema = z.object({
  login: z.string().trim().min(1).max(120),
  password: z.string().min(1).max(256)
});
export type CabinetLoginRequest = z.infer<typeof cabinetLoginRequestSchema>;

export const cabinetSessionResponseSchema = z.object({
  ok: z.literal(true),
  user: cabinetUserSchema
});
export type CabinetSessionResponse = z.infer<typeof cabinetSessionResponseSchema>;

export const cabinetLogoutResponseSchema = z.object({
  ok: z.literal(true)
});
export type CabinetLogoutResponse = z.infer<typeof cabinetLogoutResponseSchema>;

export const cabinetMaterialSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1).nullable(),
  material_status: cabinetMaterialStatusSchema,
  material_type: z.string().min(1),
  category: z.string().min(1),
  theme: z.string().min(1).nullable(),
  audience: z.string().min(1),
  language: z.string().min(1),
  source_updated_at: z.string().min(1).nullable(),
  curation_reviewed_at: z.string().min(1).nullable(),
  source_kind: z.string().min(1),
  source_path: z.string().min(1),
  recommended_for_lecture_prep: z.boolean(),
  tags: z.array(z.string().min(1)),
  reading_mode: z.enum(["in_app", "external"]),
  read_url: z.string().min(1).nullable(),
  open_url: z.string().min(1)
});
export type CabinetMaterial = z.infer<typeof cabinetMaterialSchema>;

export const cabinetMaterialDetailContentSchema = z.object({
  format: z.literal("markdown"),
  markdown: z.string().min(1)
});
export type CabinetMaterialDetailContent = z.infer<typeof cabinetMaterialDetailContentSchema>;

export const cabinetMaterialReferenceSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  material_type: z.string().min(1),
  read_url: z.string().min(1).nullable(),
  open_url: z.string().min(1)
});
export type CabinetMaterialReference = z.infer<typeof cabinetMaterialReferenceSchema>;

export const cabinetMaterialsResponseSchema = z.object({
  ok: z.literal(true),
  items: z.array(cabinetMaterialSchema),
  viewer_role: cabinetRoleSchema,
  stats: z
    .object({
      total_materials: z.number().int().nonnegative(),
      categories: z.array(z.string().min(1))
    })
    .nullable()
});
export type CabinetMaterialsResponse = z.infer<typeof cabinetMaterialsResponseSchema>;

export const cabinetMaterialDetailResponseSchema = z.object({
  ok: z.literal(true),
  item: cabinetMaterialSchema.extend({
    content: cabinetMaterialDetailContentSchema.nullable(),
    related_items: z.array(cabinetMaterialReferenceSchema)
  })
});
export type CabinetMaterialDetailResponse = z.infer<typeof cabinetMaterialDetailResponseSchema>;

export * from "./landing-content.js";
