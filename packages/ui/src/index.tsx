import type { PropsWithChildren } from "react";
import { classNames } from "@seminar/utils";

interface SectionCardProps extends PropsWithChildren {
  title: string;
  description?: string;
  className?: string;
}

export function SectionCard({
  title,
  description,
  className,
  children
}: SectionCardProps) {
  return (
    <section
      className={classNames(
        "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900",
        className
      )}
    >
      <header className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{description}</p>
        ) : null}
      </header>
      {children}
    </section>
  );
}