import MarketingShell from '../components/shared/MarketingShell'

function Section({ title, children }) {
  return (
    <div className="mt-7">
      <h2 className="text-[18px] font-semibold text-white">{title}</h2>
      <div className="mt-2 text-[14px] leading-relaxed text-[var(--fg-3)]">{children}</div>
    </div>
  )
}

export default function Terms() {
  return (
    <MarketingShell eyebrow="Legal" title="Terms of Service" subtitle="Last updated June 2026. The basics of using CloudBudgetMaster.">
      <div className="rounded-xl border border-[var(--warning-tint)] bg-[var(--warning-tint)] px-4 py-3 text-[13px] text-[var(--fg-2)]">
        This is a starting-point agreement written in good faith, not legal advice. We recommend a lawyer review before relying on it commercially.
      </div>

      <Section title="Using the service">
        You may use CloudBudgetMaster to monitor cloud accounts you own or are authorized to manage. You're
        responsible for the credentials you connect and for keeping your account secure.
      </Section>
      <Section title="Read-only access">
        CloudBudgetMaster operates with read-only access and does not modify your infrastructure. Any fix
        commands we suggest are for you to review and run yourself — we never execute them.
      </Section>
      <Section title="Estimates & no warranty">
        Cost figures, waste detection, and savings estimates are provided on a best-effort basis and may lag or
        differ from your provider's official billing. The service is provided “as is,” without warranties, and we
        aren't liable for decisions made based on its output. Always confirm against your cloud provider.
      </Section>
      <Section title="Plans & billing">
        Paid plans are billed as described on the <a href="/pricing" className="text-[var(--orange-bright)] hover:underline">Pricing page</a>. You can cancel anytime; your plan
        remains active through the current period.
      </Section>
      <Section title="Changes">
        We may update these terms as the product evolves. Material changes will be reflected here with an updated date.
      </Section>
      <Section title="Contact">
        Questions? Reach us through the <a href="/contact" className="text-[var(--orange-bright)] hover:underline">contact page</a>.
      </Section>
    </MarketingShell>
  )
}
