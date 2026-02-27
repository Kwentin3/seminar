import { SectionCard } from "@seminar/ui";
import type { HeroVariantKey, RoleKey, Step1HeroModule } from "@seminar/contracts";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { useAppContext } from "../app/useAppContext";
import { LeadForm } from "../components/LeadForm";
import { RoleTabs } from "../components/RoleTabs";
import { LANDING_CONTENT } from "../content/landing";

type HeroVariantAssignment = {
  variant: HeroVariantKey;
  source: "existing" | "new_persisted" | "new_memory";
};

const HERO_VARIANT_STORAGE_KEY = "heroVariant";
let inMemoryHeroVariant: HeroVariantKey | null = null;

function isHeroVariant(value: string | null): value is HeroVariantKey {
  return value === "aggressive" || value === "rational" || value === "partner";
}

function getAvailableVariants(hero: Step1HeroModule): HeroVariantKey[] {
  return hero.experiment.variants.filter((variant): variant is HeroVariantKey => Boolean(hero.variants[variant]));
}

function readPersistedVariant(available: Set<HeroVariantKey>): HeroVariantKey | null {
  if (inMemoryHeroVariant && available.has(inMemoryHeroVariant)) {
    return inMemoryHeroVariant;
  }

  if (typeof window === "undefined") {
    return null;
  }

  try {
    const existing = window.localStorage.getItem(HERO_VARIANT_STORAGE_KEY);
    if (isHeroVariant(existing) && available.has(existing)) {
      inMemoryHeroVariant = existing;
      return existing;
    }
  } catch {
    return inMemoryHeroVariant && available.has(inMemoryHeroVariant) ? inMemoryHeroVariant : null;
  }

  return null;
}

function selectVariantByDistribution(hero: Step1HeroModule, available: HeroVariantKey[]): HeroVariantKey | null {
  if (!available.length) {
    return null;
  }

  const availableSet = new Set(available);
  const ordered = hero.experiment.variants.filter((variant) => availableSet.has(variant));
  if (!ordered.length) {
    return available[0] ?? null;
  }

  const sum = ordered.reduce((acc, variant) => acc + hero.experiment.distribution[variant], 0);
  if (sum <= 0) {
    return ordered[0] ?? null;
  }

  const r = Math.random() * sum;
  let cumulative = 0;
  for (const variant of ordered) {
    cumulative += hero.experiment.distribution[variant];
    if (r < cumulative) {
      return variant;
    }
  }

  return ordered[ordered.length - 1] ?? null;
}

function persistVariantBestEffort(variant: HeroVariantKey): "persisted" | "memory" {
  inMemoryHeroVariant = variant;

  if (typeof window === "undefined") {
    return "memory";
  }

  try {
    window.localStorage.setItem(HERO_VARIANT_STORAGE_KEY, variant);
    return "persisted";
  } catch {
    console.warn("hero_variant_persist_fallback", {
      persist_key: HERO_VARIANT_STORAGE_KEY,
      fallback: "memory"
    });
    return "memory";
  }
}

function getOrAssignHeroVariant(hero: Step1HeroModule): HeroVariantAssignment | null {
  const available = getAvailableVariants(hero);
  if (!available.length) {
    return null;
  }

  const availableSet = new Set(available);
  const existing = readPersistedVariant(availableSet);
  if (existing) {
    return { variant: existing, source: "existing" };
  }

  const selected = selectVariantByDistribution(hero, available);
  if (!selected) {
    return null;
  }

  const persistSource = persistVariantBestEffort(selected);
  return {
    variant: selected,
    source: persistSource === "persisted" ? "new_persisted" : "new_memory"
  };
}

export function LandingPage() {
  const { locale, messages } = useAppContext();
  const heroModule = LANDING_CONTENT.step1;
  const rolesModule = LANDING_CONTENT.step2;
  const [activeRoleId, setActiveRoleId] = useState<RoleKey | null>(() => rolesModule?.roles_order[0] ?? null);
  const [heroVariantAssignment] = useState<HeroVariantAssignment | null>(() =>
    heroModule ? getOrAssignHeroVariant(heroModule) : null
  );
  const rolesSectionRef = useRef<HTMLElement | null>(null);
  const heroVariantContent =
    heroModule && heroVariantAssignment ? heroModule.variants[heroVariantAssignment.variant] ?? null : null;

  const heroCtas =
    heroVariantContent?.cta.filter((cta) => !(cta.link.target === "#roles" && !rolesModule)) ?? [];

  useEffect(() => {
    if (!rolesModule) {
      setActiveRoleId(null);
      return;
    }

    if (!activeRoleId || !rolesModule.roles_order.includes(activeRoleId)) {
      setActiveRoleId(rolesModule.roles_order[0]);
    }
  }, [activeRoleId, rolesModule]);

  useEffect(() => {
    if (!heroVariantAssignment) {
      return;
    }
    console.log("hero_variant_assigned", {
      variant: heroVariantAssignment.variant,
      source: heroVariantAssignment.source
    });
  }, [heroVariantAssignment]);

  const onHeroCtaClick = (event: MouseEvent<HTMLAnchorElement>, target: string) => {
    if (target !== "#roles") {
      return;
    }

    event.preventDefault();
    if (!rolesModule) {
      return;
    }
    rolesSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const onRoleChange = (roleId: RoleKey) => {
    setActiveRoleId(roleId);
    console.log("role_clicked", { roleId, heroVariant: heroVariantAssignment?.variant ?? null });
  };

  const onLeadSubmitCapture = () => {
    console.log("lead_submitted", { source: "landing", heroVariant: heroVariantAssignment?.variant ?? null });
  };

  if (!heroVariantContent && !rolesModule) {
    return null;
  }

  return (
    <div className="space-y-6">
      {heroVariantContent ? (
        <section
          id="hero"
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="space-y-6">
            <header className="space-y-3">
              <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 md:text-3xl">
                {heroVariantContent.headline.i18n[locale]}
              </h1>
              <p className="max-w-3xl text-base text-slate-700 dark:text-slate-200">
                {heroVariantContent.subheadline.i18n[locale]}
              </p>
            </header>

            <div className="space-y-3">
              {heroVariantContent.body.map((item) => (
                <p key={item.id} className="max-w-4xl text-sm leading-6 text-slate-700 dark:text-slate-200">
                  {item.text.i18n[locale]}
                </p>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              {heroVariantContent.badges.map((badge) => (
                <span
                  key={badge.id}
                  className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
                >
                  {badge.text.i18n[locale]}
                </span>
              ))}
            </div>

            {heroCtas.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {heroCtas.map((cta) => (
                  <a
                    key={cta.id}
                    href={cta.link.target}
                    onClick={(event) => onHeroCtaClick(event, cta.link.target)}
                    className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white"
                  >
                    {cta.text.i18n[locale]}
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {rolesModule ? (
        <section id="roles" ref={rolesSectionRef}>
          <SectionCard title={messages.landing.tabsLabel}>
            <RoleTabs content={rolesModule} activeRoleId={activeRoleId} onRoleChange={onRoleChange} />
          </SectionCard>
        </section>
      ) : null}

      <section id="lead-form">
        <SectionCard title={messages.landing.leadForm.title}>
          <div onSubmitCapture={onLeadSubmitCapture}>
            <LeadForm />
          </div>
        </SectionCard>
      </section>
    </div>
  );
}
