import { SectionCard } from "@seminar/ui";
import { useAppContext } from "../app/useAppContext";
import { LeadForm } from "../components/LeadForm";
import { RoleTabs } from "../components/RoleTabs";

export function LandingPage() {
  const { messages } = useAppContext();

  return (
    <div className="space-y-6">
      <SectionCard title={messages.landing.heading} description={messages.landing.summary}>
        <RoleTabs />
      </SectionCard>

      <SectionCard title={messages.landing.leadForm.title}>
        <LeadForm />
      </SectionCard>
    </div>
  );
}
