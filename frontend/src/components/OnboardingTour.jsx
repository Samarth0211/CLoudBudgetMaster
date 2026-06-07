import { useState, useEffect } from 'react'

const STEPS = [
  {
    title: 'Welcome to CloudBudgetMaster!',
    description: 'Your cloud cost monitoring assistant. Let me show you around.',
    target: null, // center screen
  },
  {
    title: 'Connect Your Cloud',
    description: 'Start by connecting your AWS, GCP, or Azure account. We only use read-only access.',
    target: '/connections',
    highlight: 'sidebar-connections',
  },
  {
    title: 'Scan for Resources',
    description: 'After connecting, scan to discover all your cloud resources and their costs.',
    target: '/connections',
  },
  {
    title: 'Monitor Your Dashboard',
    description: 'See your spending trends, click chart spikes to drill into daily costs.',
    target: '/dashboard',
    highlight: 'sidebar-dashboard',
  },
  {
    title: 'Set Up Alerts',
    description: 'Get notified when costs spike or new unused resources appear.',
    target: '/alerts',
    highlight: 'sidebar-alerts',
  },
  {
    title: 'You\'re All Set!',
    description: 'Use the AI chat assistant anytime for help. Happy saving!',
    target: null,
  },
]

export default function OnboardingTour() {
  const [step, setStep] = useState(0)
  const [show, setShow] = useState(false)

  useEffect(() => {
    const completed = localStorage.getItem('onboarding_complete')
    if (!completed) {
      // Delay to let page load
      const timer = setTimeout(() => setShow(true), 1500)
      return () => clearTimeout(timer)
    }
  }, [])

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1)
    } else {
      handleDismiss()
    }
  }

  const handleBack = () => {
    if (step > 0) setStep(step - 1)
  }

  const handleDismiss = () => {
    localStorage.setItem('onboarding_complete', 'true')
    setShow(false)
  }

  if (!show) return null

  const current = STEPS[step]
  const isFirst = step === 0
  const isLast = step === STEPS.length - 1

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleDismiss} />

      {/* Tour Card */}
      <div className="relative z-10 w-full max-w-md mx-4 animate-scale-in">
        <div className="rounded-2xl border border-white/10 bg-[#232F3E] shadow-2xl overflow-hidden">
          {/* Progress Bar */}
          <div className="h-1 bg-white/5">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>

          <div className="p-6">
            {/* Step indicator */}
            <div className="flex items-center gap-2 mb-4">
              {STEPS.map((_, i) => (
                <div key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i === step ? 'w-6 bg-indigo-500' : i < step ? 'w-1.5 bg-indigo-500/40' : 'w-1.5 bg-white/10'
                  }`}
                />
              ))}
            </div>

            {/* Content */}
            <div className="mb-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-indigo-500/20 mb-4">
                <svg className="h-6 w-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  {step === 0 && <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />}
                  {step === 1 && <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />}
                  {step === 2 && <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />}
                  {step === 3 && <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />}
                  {step === 4 && <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />}
                  {step === 5 && <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />}
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white">{current.title}</h3>
              <p className="text-sm text-slate-400 mt-2">{current.description}</p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between">
              <button onClick={handleDismiss}
                className="text-xs text-slate-600 hover:text-slate-400 transition-colors">
                Skip tour
              </button>
              <div className="flex gap-2">
                {!isFirst && (
                  <button onClick={handleBack}
                    className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-400 hover:bg-white/5 transition-colors">
                    Back
                  </button>
                )}
                <button onClick={handleNext}
                  className="rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all">
                  {isLast ? 'Get Started' : 'Next'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
