import { SectionCard } from "@seminar/ui";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import type { AppMessages } from "../app/messages";
import { useAppContext } from "../app/useAppContext";
import { LeadForm } from "../components/LeadForm";
import { RoleTabs } from "../components/RoleTabs";
import { ROLE_CONTENT } from "../content/roles";

const heroVariants = ["aggressive", "rational", "partner"] as const;
type HeroVariant = (typeof heroVariants)[number];

type HeroVariantAssignment = {
  variant: HeroVariant;
  source: "existing" | "new" | "fallback";
};

type HeroVariantCopy = {
  headline: string;
  subheadline: string;
  fomo: string;
};

const HERO_VARIANT_STORAGE_KEY = "heroVariant";

function isHeroVariant(value: string | null): value is HeroVariant {
  return value === "aggressive" || value === "rational" || value === "partner";
}

function getOrAssignHeroVariant(): HeroVariantAssignment {
  if (typeof window === "undefined") {
    return { variant: "aggressive", source: "fallback" };
  }

  try {
    const existing = window.localStorage.getItem(HERO_VARIANT_STORAGE_KEY);
    if (isHeroVariant(existing)) {
      return { variant: existing, source: "existing" };
    }

    const randomIndex = Math.floor(Math.random() * heroVariants.length);
    const assignedVariant = heroVariants[randomIndex];
    window.localStorage.setItem(HERO_VARIANT_STORAGE_KEY, assignedVariant);
    return { variant: assignedVariant, source: "new" };
  } catch {
    return { variant: "aggressive", source: "fallback" };
  }
}

function resolveHeroVariantCopy(messages: AppMessages, variant: HeroVariant): HeroVariantCopy {
  const copy = messages.landing.hero.variant[variant];
  const isValidCopy =
    Boolean(copy) &&
    typeof copy.headline === "string" &&
    copy.headline.trim().length > 0 &&
    typeof copy.subheadline === "string" &&
    copy.subheadline.trim().length > 0 &&
    typeof copy.fomo === "string" &&
    copy.fomo.trim().length > 0;

  if (isValidCopy) {
    return copy;
  }

  const keyPrefix = `landing.hero.variant.${variant}`;
  if (import.meta.env.DEV) {
    return {
      headline: `[MISSING ${keyPrefix}.headline]`,
      subheadline: `[MISSING ${keyPrefix}.subheadline]`,
      fomo: `[MISSING ${keyPrefix}.fomo]`
    };
  }

  throw new Error(`Missing hero variant copy for "${keyPrefix}".`);
}

export function LandingPage() {
  const { locale, messages } = useAppContext();
  const [activeRoleId, setActiveRoleId] = useState<string | null>(() => ROLE_CONTENT[0]?.id ?? null);
  const [heroVariantAssignment] = useState<HeroVariantAssignment>(() => getOrAssignHeroVariant());
  const rolesSectionRef = useRef<HTMLElement | null>(null);
  const heroText = resolveHeroVariantCopy(messages, heroVariantAssignment.variant);

  useEffect(() => {
    if (!ROLE_CONTENT.length) {
      setActiveRoleId(null);
      return;
    }

    if (!activeRoleId || !ROLE_CONTENT.some((role) => role.id === activeRoleId)) {
      setActiveRoleId(ROLE_CONTENT[0].id);
    }
  }, [activeRoleId]);

  useEffect(() => {
    console.log("hero_variant_assigned", {
      variant: heroVariantAssignment.variant,
      source: heroVariantAssignment.source
    });
  }, [heroVariantAssignment.source, heroVariantAssignment.variant]);

  const onHeroRoleClick = (event: MouseEvent<HTMLAnchorElement>, roleId: string) => {
    event.preventDefault();
    setActiveRoleId(roleId);
    console.log("role_clicked", { roleId, heroVariant: heroVariantAssignment.variant });
    rolesSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const onLeadSubmitCapture = () => {
    console.log("lead_submitted", { source: "landing", heroVariant: heroVariantAssignment.variant });
  };

  return (
    <div className="space-y-6">
      <section
        id="hero"
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex min-h-[680px] flex-col justify-between gap-6 md:min-h-[620px]">
          <div className="space-y-4">
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 md:text-3xl">
              {heroText.headline}
            </h1>
            <p className="max-w-3xl text-base text-slate-700 dark:text-slate-200">
              {heroText.subheadline}
            </p>
            <p className="max-w-3xl text-sm font-medium text-slate-800 dark:text-slate-100">
              {heroText.fomo}
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              {messages.landing.tabsLabel}
            </p>
            <div className="flex flex-wrap gap-2">
              {ROLE_CONTENT.map((role) => (
                <a
                  key={role.id}
                  href="#roles"
                  onClick={(event) => onHeroRoleClick(event, role.id)}
                  className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white"
                >
                  {role.title[locale]}
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="roles" ref={rolesSectionRef}>
        <SectionCard title={messages.landing.tabsLabel}>
          <RoleTabs activeRoleId={activeRoleId} onRoleChange={setActiveRoleId} />
        </SectionCard>
      </section>

      <SectionCard title={messages.landing.leadForm.title}>
        <div onSubmitCapture={onLeadSubmitCapture}>
          <LeadForm />
        </div>
      </SectionCard>
    </div>
  );
}
