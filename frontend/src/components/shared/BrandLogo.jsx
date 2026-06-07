/**
 * BrandLogo — the CloudBudgetMaster mark (navy squircle + orange cloud/arrow).
 * Single source for the logo across the app; the PNG is a self-contained tile,
 * so we just render it at the requested size. Size via className (e.g. "h-8 w-8").
 */
export default function BrandLogo({ className = 'h-8 w-8' }) {
  return (
    <img
      src="/logo.png"
      alt="CloudBudgetMaster"
      width="512"
      height="512"
      decoding="async"
      className={`shrink-0 object-contain ${className}`}
    />
  )
}
