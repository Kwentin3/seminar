export const STORAGE_KEYS = {
  locale: "seminar.locale",
  theme: "seminar.theme"
} as const;

export function classNames(
  ...values: Array<string | null | undefined | false>
): string {
  return values.filter(Boolean).join(" ");
}