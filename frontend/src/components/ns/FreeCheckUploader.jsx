import { useRef, useState } from 'react'
import api from '../../lib/api'
import FindingsReport from './FindingsReport'

/**
 * Wires the "Run a free check" flow to the real backend: POST a CSV to
 * /bill-audit/check (multipart field "file") and render the findings inline.
 * No signup, no persistence -- the backend discards the file after the scan.
 */
export default function FreeCheckUploader({ id }) {
  const inputRef = useRef(null)
  const [status, setStatus] = useState('idle') // idle | scanning | done | error
  const [fileName, setFileName] = useState('')
  const [report, setReport] = useState(null)
  const [error, setError] = useState('')

  const openPicker = () => inputRef.current?.click()

  const onFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setStatus('scanning')
    setError('')
    setReport(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await api.post('/bill-audit/check', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setReport(res.data)
      setStatus('done')
    } catch (err) {
      const detail = err.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Could not scan that file. Try exporting a fresh billing CSV and upload again.')
      setStatus('error')
    } finally {
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const reset = () => {
    setStatus('idle')
    setReport(null)
    setError('')
    setFileName('')
  }

  return (
    <div id={id} className="flex flex-col gap-5">
      <input ref={inputRef} type="file" accept=".csv" onChange={onFileChange} className="hidden" />

      {status === 'idle' && (
        <div
          onClick={openPicker}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openPicker() }}
          className="cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors"
          style={{ borderColor: 'var(--cbm-border-strong)' }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--cbm-fg-3)" strokeWidth="1.5" className="mx-auto mb-2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          <p className="text-[13.5px] font-semibold" style={{ color: 'var(--cbm-fg)' }}>Drop your billing CSV or click to browse</p>
          <p className="mt-1.5 text-[12px]" style={{ color: 'var(--cbm-fg-4)' }}>AWS Cost and Usage Report or billing export. No signup, file deleted after scan.</p>
        </div>
      )}

      {status === 'scanning' && (
        <div className="rounded-xl border p-8 text-center" style={{ borderColor: 'var(--cbm-border)', background: 'var(--cbm-surface)' }}>
          <div
            className="mx-auto mb-3.5 h-8 w-8 rounded-full border-[3px]"
            style={{ borderColor: 'var(--cbm-border)', borderTopColor: 'var(--cbm-primary)', animation: 'cbm-spin 0.8s linear infinite' }}
          />
          <p className="text-[13.5px]" style={{ color: 'var(--cbm-fg-2)' }}>
            Scanning <span className="font-mono">{fileName}</span>&hellip;
          </p>
        </div>
      )}

      {status === 'error' && (
        <div className="rounded-xl border p-6 text-center" style={{ borderColor: 'var(--cbm-waste-border, var(--cbm-waste))', background: 'var(--cbm-waste-tint)' }}>
          <p className="text-[13.5px] font-semibold" style={{ color: 'var(--cbm-waste)' }}>{error}</p>
          <button
            onClick={reset}
            className="mt-4 rounded-[10px] border px-4 py-2 text-[13px] font-semibold"
            style={{ borderColor: 'var(--cbm-border-strong)', color: 'var(--cbm-fg)' }}
          >
            Try another file
          </button>
        </div>
      )}

      {status === 'done' && report && (
        <div className="flex flex-col gap-4">
          <FindingsReport report={report} />
          <button
            onClick={reset}
            className="self-start rounded-[10px] border px-4 py-2 text-[13px] font-semibold"
            style={{ borderColor: 'var(--cbm-border-strong)', color: 'var(--cbm-fg)' }}
          >
            Scan another file
          </button>
        </div>
      )}
    </div>
  )
}
