const PROVIDER_STYLES = {
  aws: 'bg-orange-100 text-orange-800',
  gcp: 'bg-blue-100 text-blue-800',
  azure: 'bg-cyan-100 text-cyan-800',
  snowflake: 'bg-sky-100 text-sky-800',
}

const PROVIDER_LABELS = {
  aws: 'AWS',
  gcp: 'GCP',
  azure: 'Azure',
  snowflake: 'Snowflake',
}

export default function CloudBadge({ provider }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${PROVIDER_STYLES[provider] || 'bg-gray-100 text-gray-800'}`}>
      {PROVIDER_LABELS[provider] || provider}
    </span>
  )
}
