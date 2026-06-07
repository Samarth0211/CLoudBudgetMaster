import MarketingShell from '../components/shared/MarketingShell'

function Section({ title, children }) {
  return (
    <div className="mt-7">
      <h2 className="text-[18px] font-semibold text-white">{title}</h2>
      <div className="mt-2 text-[14px] leading-relaxed text-[var(--fg-3)]">{children}</div>
    </div>
  )
}

export default function Privacy() {
  return (
    <MarketingShell eyebrow="Legal" title="Privacy Policy" subtitle="Last updated June 2026. Plain-language summary of how we handle your data.">
      <div className="rounded-xl border border-[var(--warning-tint)] bg-[var(--warning-tint)] px-4 py-3 text-[13px] text-[var(--fg-2)]">
        This is a starting-point policy written in good faith, not legal advice. We recommend a lawyer review before relying on it commercially.
      </div>

      <Section title="What we collect">
        Account details you provide (name, email), the cloud connections you add, and the resource and cost data
        we read from your cloud accounts to power your dashboard. We also keep basic, privacy-respecting analytics
        about site usage.
      </Section>
      <Section title="How cloud credentials are handled">
        Cloud credentials are encrypted with AES-256 before storage, used only to perform read-only scans, and are
        never logged or shared. See our <a href="/security" className="text-[var(--orange-bright)] hover:underline">Security page</a> for details.
      </Section>
      <Section title="How we use your data">
        Solely to operate the product for you — to display costs, detect waste, and send the alerts you configure.
        We do not sell your data, and we do not share it with third parties except the infrastructure providers
        required to run the service (e.g. our database and email provider).
      </Section>
      <Section title="Data retention & deletion">
        You can delete your connections or your entire account at any time from Settings. Deleting your account
        removes your profile, connections, scanned resources, and alerts.
      </Section>
      <Section title="Contact">
        Questions about privacy? Reach us through the <a href="/contact" className="text-[var(--orange-bright)] hover:underline">contact page</a>.
      </Section>
    </MarketingShell>
  )
}
