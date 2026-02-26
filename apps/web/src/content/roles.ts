import { rolesContentSchema, type RoleContent } from "@seminar/contracts";
import rolesJson from "@content/roles.json";

function parseRolesContent(raw: unknown): RoleContent[] {
  const parsed = rolesContentSchema.safeParse(raw);
  if (parsed.success) {
    return parsed.data;
  }

  const details = parsed.error.issues
    .map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
    .join("; ");
  const message = `Invalid content/roles.json: ${details}`;

  if (import.meta.env.DEV) {
    throw new Error(message);
  }

  console.error(message);
  return [];
}

export const ROLE_CONTENT: RoleContent[] = parseRolesContent(rolesJson);
