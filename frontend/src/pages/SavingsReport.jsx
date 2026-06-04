import { useState, useEffect } from 'react'
import api from '../lib/api'

export default function SavingsReport() {
  const [summary, setSummary] = useState(null)
  const [wasters, setWasters] = useState([])
  const [trend, setTrend] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/dashboard/summary').then(r => setSummary(r.data)),
      api.get('/dashboard/top-waste?limit=20').then(r => setWasters(r.data.resources || [])),
      api.get('/dashboard/trend?days=30').then(r => setTrend(r.data.data_points || [])),
    ]).finally(() => setLoading(false))
  }, [])

  const handlePrint = () => window.print()

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-indigo-500" />
      </div>
    )
  }

  const monthlyCost = summary?.total_monthly_cost_usd || 0
  const wasteCost = summary?.total_waste_cost_usd || 0
  const savingsPercent = monthlyCost > 0 ? ((wasteCost / monthlyCost) * 100).toFixed(1) : 0
  const annualSavings = wasteCost * 12

  return (
    <div className="animate-fade-up">
      {/* Screen Header (hidden in print) */}
      <div className="flex items-center justify-between mb-6 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-white">Savings Report</h1>
          <p className="mt-1 text-sm text-slate-400">Your cloud cost optimization summary</p>
        </div>
        <button onClick={handlePrint}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Download PDF
        </button>
      </div>

      {/* Report Content */}
      <div className="space-y-6 print:space-y-4">
        {/* Print Header */}
        <div className="hidden print:block mb-4">
          <h1 className="text-2xl font-bold text-black">CloudBudgetMaster Savings Report</h1>
          <p className="text-sm text-gray-500">Generated on {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>

        {/* Executive Summary */}
        <div className="rounded-2xl border border-white/10 bg-[#111827] p-6 print:border-gray-200 print:bg-white">
          <h2 className="text-lg font-bold text-white mb-4 print:text-black">Executive Summary</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryCard label="Monthly Spend" value={`$${monthlyCost.toFixed(2)}`} color="text-white print:text-black" />
            <SummaryCard label="Monthly Waste" value={`$${wasteCost.toFixed(2)}`} color="text-red-400 print:text-red-600" />
            <SummaryCard label="Savings Potential" value={`${savingsPercent}%`} color="text-amber-400 print:text-amber-600" />
            <SummaryCard label="Annual Savings" value={`$${annualSavings.toFixed(0)}`} color="text-emerald-400 print:text-emerald-600" />
          </div>
        </div>

        {/* Waste Breakdown */}
        <div className="rounded-2xl border border-white/10 bg-[#111827] p-6 print:border-gray-200 print:bg-white">
          <h2 className="text-lg font-bold text-white mb-4 print:text-black">Top Wasted Resources</h2>
          {wasters.length === 0 ? (
            <p className="text-sm text-slate-400 print:text-gray-500">No waste detected. Great job!</p>
          ) : (
            <div className="space-y-3">
              {wasters.map((w, i) => (
                <div key={w.id} className="flex items-center gap-3">
                  <span className="font-mono flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/5 text-xs font-bold text-slate-400 print:bg-gray-100 print:text-gray-600">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate print:text-black">{w.resource_name}</p>
                    <p className="text-xs text-slate-500 print:text-gray-500">
                      {w.resource_type} &middot; {w.region} &middot; {w.waste_status}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono text-sm font-bold text-red-400 print:text-red-600">${(w.waste_monthly_cost_usd || 0).toFixed(2)}/mo</p>
                  </div>
                  {/* Visual bar */}
                  <div className="w-24 shrink-0 hidden md:block">
                    <div className="h-2 rounded-full bg-white/5 print:bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-red-500 to-orange-500 print:bg-red-500"
                        style={{ width: `${wasteCost > 0 ? ((w.waste_monthly_cost_usd || 0) / wasteCost * 100) : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cost Trend */}
        <div className="rounded-2xl border border-white/10 bg-[#111827] p-6 print:border-gray-200 print:bg-white">
          <h2 className="text-lg font-bold text-white mb-4 print:text-black">30-Day Cost Trend</h2>
          {trend.length === 0 ? (
            <p className="text-sm text-slate-400 print:text-gray-500">No cost data available yet.</p>
          ) : (
            <div className="space-y-1">
              {trend.slice(-14).map(d => (
                <div key={d.date} className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 w-20 shrink-0 font-mono print:text-gray-500">{d.date.slice(5)}</span>
                  <div className="flex-1 h-4 rounded-full bg-white/5 print:bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 print:bg-indigo-500"
                      style={{ width: `${_barWidth(d.total_cost_usd, trend)}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-400 w-16 text-right font-mono print:text-gray-600">${d.total_cost_usd}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recommendations */}
        <div className="rounded-2xl border border-white/10 bg-[#111827] p-6 print:border-gray-200 print:bg-white">
          <h2 className="text-lg font-bold text-white mb-4 print:text-black">Recommendations</h2>
          <ul className="space-y-2 text-sm text-slate-300 print:text-gray-700">
            {wasteCost > 0 && (
              <li className="flex items-start gap-2">
                <span className="text-red-400 mt-0.5 print:text-red-600">1.</span>
                <span>Terminate or downsize {wasters.length} unused/idle resources to save <strong className="text-white print:text-black">${wasteCost.toFixed(2)}/month</strong></span>
              </li>
            )}
            <li className="flex items-start gap-2">
              <span className="text-amber-400 mt-0.5 print:text-amber-600">2.</span>
              <span>Set up cost alerts to catch spending spikes before they grow</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 mt-0.5 print:text-emerald-600">3.</span>
              <span>Review resources weekly and run scans after any infrastructure changes</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400 mt-0.5 print:text-blue-600">4.</span>
              <span>Consider Reserved Instances or Savings Plans for consistently running workloads</span>
            </li>
          </ul>
        </div>

        {/* Footer */}
        <p className="text-xs text-slate-600 text-center print:text-gray-400">
          Report generated by CloudBudgetMaster &middot; {new Date().toLocaleDateString()}
        </p>
      </div>
    </div>
  )
}

function SummaryCard({ label, value, color }) {
  return (
    <div className="rounded-xl bg-white/5 p-4 print:bg-gray-50 print:border print:border-gray-200">
      <p className="text-xs text-slate-500 mb-1 print:text-gray-500">{label}</p>
      <p className={`font-mono text-xl font-bold ${color}`}>{value}</p>
    </div>
  )
}

function _barWidth(value, data) {
  const max = Math.max(...data.map(d => d.total_cost_usd), 1)
  return Math.max((value / max) * 100, 2)
}
