import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const NAVY = [35, 47, 62]
const INK = [17, 24, 39]
const RED = [220, 38, 38]
const AMBER = [217, 119, 6]
const GREEN = [5, 150, 105]
const ORANGE = [255, 153, 0]
const GREY = [110, 118, 128]
const MARGIN = 40

const money = (n) => `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const money0 = (n) => `$${Math.round(Number(n || 0)).toLocaleString()}`

const TYPE_LABEL = {
  ec2_instance: 'EC2 Instance', rds_instance: 'RDS Database', ebs_volume: 'EBS Volume',
  elastic_ip: 'Elastic IP', s3_bucket: 'S3 Bucket', compute_instance: 'Compute VM',
  persistent_disk: 'Persistent Disk',
}
const typeLabel = (t) => TYPE_LABEL[t] || (t || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

async function loadLogo() {
  try {
    const res = await fetch('/logo.png')
    const blob = await res.blob()
    return await new Promise((resolve) => {
      const r = new FileReader()
      r.onload = () => resolve(r.result)
      r.onerror = () => resolve(null)
      r.readAsDataURL(blob)
    })
  } catch { return null }
}

function ensure(ctx, needed) {
  if (ctx.y + needed > ctx.H - 60) { ctx.doc.addPage(); ctx.y = 64 }
}

function sectionTitle(ctx, text) {
  ensure(ctx, 40)
  const { doc, W } = ctx
  doc.setTextColor(...INK); doc.setFont('helvetica', 'bold'); doc.setFontSize(13)
  doc.text(text, MARGIN, ctx.y)
  doc.setDrawColor(...ORANGE); doc.setLineWidth(2)
  doc.line(MARGIN, ctx.y + 5, MARGIN + 28, ctx.y + 5)
  doc.setLineWidth(0.5)
  ctx.y += 20
}

/** Vertical bar chart for the daily cost trend. */
function drawTrendChart(ctx, points) {
  const { doc, W } = ctx
  const h = 130, x0 = MARGIN, w = W - 2 * MARGIN
  ensure(ctx, h + 30)
  const top = ctx.y
  doc.setDrawColor(232, 232, 232); doc.setFillColor(250, 250, 251)
  doc.rect(x0, top, w, h, 'FD')
  const vals = points.map(p => p.total_cost_usd || 0)
  const max = Math.max(...vals, 1)
  const n = points.length || 1
  const bw = w / n
  points.forEach((p, i) => {
    const v = p.total_cost_usd || 0
    const bh = (v / max) * (h - 22)
    doc.setFillColor(...ORANGE)
    doc.rect(x0 + i * bw + bw * 0.18, top + h - bh - 4, Math.max(bw * 0.64, 1), bh, 'F')
  })
  doc.setFontSize(7); doc.setTextColor(...GREY)
  doc.text(money0(max), x0 + 5, top + 11)
  doc.text('$0', x0 + 5, top + h - 5)
  ctx.y = top + h + 6
  doc.setFontSize(7.5); doc.setTextColor(...GREY)
  if (points[0]) doc.text(points[0].date, x0, ctx.y + 7)
  if (points[n - 1]) doc.text(points[n - 1].date, x0 + w, ctx.y + 7, { align: 'right' })
  ctx.y += 22
}

/** Horizontal bars: waste grouped by resource type. */
function drawWasteBars(ctx, items) {
  if (!items.length) return
  const { doc, W } = ctx
  const x0 = MARGIN, w = W - 2 * MARGIN
  const max = Math.max(...items.map(i => i.value), 1)
  const rowH = 18
  ensure(ctx, items.length * rowH + 10)
  items.forEach((it) => {
    const labelW = 150, barX = x0 + labelW, barW = w - labelW - 70
    doc.setFontSize(8.5); doc.setTextColor(60, 60, 60); doc.setFont('helvetica', 'normal')
    doc.text(it.label, x0, ctx.y + 9)
    doc.setFillColor(238, 240, 243); doc.rect(barX, ctx.y, barW, 9, 'F')
    doc.setFillColor(...RED); doc.rect(barX, ctx.y, Math.max((it.value / max) * barW, 1), 9, 'F')
    doc.setTextColor(...RED); doc.setFont('helvetica', 'bold')
    doc.text(money(it.value), x0 + w, ctx.y + 8, { align: 'right' })
    ctx.y += rowH
  })
  ctx.y += 6
}

function connSummary(conn, rs) {
  const cost = rs.reduce((s, r) => s + (r.monthly_cost_usd || 0), 0)
  const waste = rs.reduce((s, r) => s + (r.waste_monthly_cost_usd || 0), 0)
  const wasted = rs.filter(r => r.waste_status && r.waste_status !== 'active').length
  return { cost, waste, wasted, count: rs.length }
}

export async function generateCostReport({ summary, trend = [], connections = [], resources = [], account }) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const logo = await loadLogo()
  const today = new Date()
  const fmtDate = today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const ctx = { doc, W, H, y: 0 }

  const monthly = summary?.total_monthly_cost_usd || 0
  const waste = summary?.total_waste_cost_usd || 0
  const savingsPct = monthly > 0 ? (waste / monthly) * 100 : 0
  const annual = waste * 12
  const totalRes = summary?.total_resources ?? resources.length
  const unused = summary?.unused_resources ?? resources.filter(r => r.waste_status && r.waste_status !== 'active').length

  // ── Title band (page 1) ──
  doc.setFillColor(...NAVY); doc.rect(0, 0, W, 96, 'F')
  if (logo) doc.addImage(logo, 'PNG', MARGIN, 25, 46, 46)
  const tx = logo ? 100 : MARGIN
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(21)
  doc.text('CloudBudgetMaster', tx, 48)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(255, 172, 49)
  doc.text('Cloud Cost & Savings Report', tx, 68)
  doc.setTextColor(200, 206, 219); doc.setFontSize(9)
  doc.text(`Generated ${fmtDate}`, W - MARGIN, 38, { align: 'right' })
  if (account) doc.text(`Account: ${account}`, W - MARGIN, 52, { align: 'right' })
  doc.text(`${connections.length} connection${connections.length === 1 ? '' : 's'} · last 30 days`, W - MARGIN, 66, { align: 'right' })
  ctx.y = 128

  // ── Executive summary ──
  sectionTitle(ctx, 'Executive Summary')
  const cards = [
    ['Monthly Spend', money(monthly), INK],
    ['Monthly Waste', money(waste), RED],
    ['Recoverable', `${savingsPct.toFixed(1)}%`, AMBER],
    ['Annual Savings', money0(annual), GREEN],
  ]
  const cw = (W - 80 - 3 * 12) / 4
  cards.forEach((c, i) => {
    const x = MARGIN + i * (cw + 12)
    doc.setFillColor(247, 248, 250); doc.roundedRect(x, ctx.y, cw, 58, 4, 4, 'F')
    doc.setTextColor(...GREY); doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
    doc.text(c[0].toUpperCase(), x + 12, ctx.y + 20)
    doc.setTextColor(...c[2]); doc.setFont('helvetica', 'bold'); doc.setFontSize(16)
    doc.text(c[1], x + 12, ctx.y + 42)
  })
  ctx.y += 58 + 16
  doc.setTextColor(70, 70, 70); doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5)
  const para = waste > 0
    ? `Across ${totalRes} scanned resources in ${connections.length} connection${connections.length === 1 ? '' : 's'}, ${unused} are idle or unused — wasting approximately ${money(waste)} per month (${money0(annual)} per year). Acting on the items in this report recovers about ${savingsPct.toFixed(1)}% of current cloud spend.`
    : `Across ${totalRes} scanned resources in ${connections.length} connection${connections.length === 1 ? '' : 's'}, no waste was detected. Current cloud spend appears healthy and well-optimized.`
  const paraLines = doc.splitTextToSize(para, W - 80)
  doc.text(paraLines, MARGIN, ctx.y + 2)
  ctx.y += paraLines.length * 13 + 18

  // ── Cost trend ──
  if (trend.length) {
    sectionTitle(ctx, '30-Day Cost Trend')
    drawTrendChart(ctx, trend)
  }

  // ── Per-connection sections ──
  const byConn = {}
  resources.forEach(r => { (byConn[r.connection_id] ||= []).push(r) })

  connections.forEach((conn) => {
    const rs = (byConn[conn.id] || []).slice().sort((a, b) =>
      (b.waste_monthly_cost_usd || 0) - (a.waste_monthly_cost_usd || 0) || (b.monthly_cost_usd || 0) - (a.monthly_cost_usd || 0))
    const s = connSummary(conn, rs)

    ensure(ctx, 90)
    sectionTitle(ctx, `Connection — ${conn.display_name || conn.provider}`)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(90, 90, 90)
    const meta = [
      `Provider: ${(conn.provider || '').toUpperCase()}`,
      `Resources: ${s.count}`,
      `Idle/unused: ${s.wasted}`,
      `Monthly: ${money(s.cost)}`,
      `Waste: ${money(s.waste)}`,
      conn.last_scanned_at ? `Last scanned: ${new Date(conn.last_scanned_at).toLocaleDateString()}` : null,
    ].filter(Boolean).join('     ')
    doc.text(meta, MARGIN, ctx.y)
    ctx.y += 16

    // waste-by-type bars for this connection
    const wasteByType = {}
    rs.forEach(r => {
      if (r.waste_monthly_cost_usd > 0) {
        const k = typeLabel(r.resource_type)
        wasteByType[k] = (wasteByType[k] || 0) + r.waste_monthly_cost_usd
      }
    })
    const bars = Object.entries(wasteByType).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
    if (bars.length) { drawWasteBars(ctx, bars) }

    // full resource table
    if (rs.length) {
      autoTable(doc, {
        startY: ctx.y,
        head: [['#', 'Resource', 'Type', 'Region', 'State', 'Monthly', 'Waste']],
        body: rs.map((r, i) => [
          i + 1,
          r.resource_name || r.resource_id || '—',
          typeLabel(r.resource_type),
          r.region || '',
          r.status || '',
          money(r.monthly_cost_usd),
          r.waste_status && r.waste_status !== 'active' ? money(r.waste_monthly_cost_usd) : '—',
        ]),
        styles: { fontSize: 8, cellPadding: 4, textColor: [45, 45, 45], lineColor: [236, 236, 236], lineWidth: 0.5, overflow: 'ellipsize' },
        headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        alternateRowStyles: { fillColor: [249, 250, 251] },
        columnStyles: {
          0: { cellWidth: 20, halign: 'center' },
          1: { cellWidth: 150 },
          5: { halign: 'right' },
          6: { halign: 'right' },
        },
        margin: { left: MARGIN, right: MARGIN, bottom: 56 },
        didParseCell: (d) => {
          if (d.section === 'body' && d.column.index === 6 && d.cell.raw !== '—') {
            d.cell.styles.textColor = RED; d.cell.styles.fontStyle = 'bold'
          }
        },
      })
      ctx.y = doc.lastAutoTable.finalY + 20
    } else {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(120, 120, 120)
      doc.text('No resources found for this connection.', MARGIN, ctx.y + 4); ctx.y += 24
    }
  })

  // ── Remediation appendix (wasted resources with fix steps) ──
  const wasted = resources.filter(r => r.waste_status && r.waste_status !== 'active' && r.fix_recommendation)
  if (wasted.length) {
    ensure(ctx, 60)
    sectionTitle(ctx, 'Recommended Remediation')
    wasted.slice(0, 40).forEach((r, i) => {
      const fix = r.fix_recommendation
      ensure(ctx, 56)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...INK)
      const head = `${i + 1}. ${r.resource_name || r.resource_id}  (${typeLabel(r.resource_type)} · ${r.region})  —  ${money(r.waste_monthly_cost_usd)}/mo`
      doc.text(doc.splitTextToSize(head, W - 80), MARGIN, ctx.y); ctx.y += 14
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(70, 70, 70)
      const sum = doc.splitTextToSize(`Action: ${fix.summary}`, W - 90)
      doc.text(sum, MARGIN + 8, ctx.y); ctx.y += sum.length * 11 + 8
    })
  }

  // ── General recommendations ──
  ensure(ctx, 90)
  sectionTitle(ctx, 'General Recommendations')
  const recs = [
    waste > 0 && `Terminate or right-size the ${unused} idle/unused resources above to recover roughly ${money(waste)} per month.`,
    'Configure cost-spike alerts so unexpected increases are caught before they reach the invoice.',
    'Re-scan weekly, and after any infrastructure change, to keep this report current.',
    'Use Reserved Instances or Savings Plans for steady-state, always-on workloads.',
  ].filter(Boolean)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(55, 55, 55)
  recs.forEach((r, i) => {
    const t = doc.splitTextToSize(`${i + 1}.   ${r}`, W - 96)
    ensure(ctx, t.length * 13 + 8)
    doc.text(t, MARGIN + 8, ctx.y); ctx.y += t.length * 13 + 6
  })

  // ── Running header (pages 2+) + footer (all pages) ──
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    if (p > 1) {
      if (logo) doc.addImage(logo, 'PNG', MARGIN, 22, 18, 18)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...NAVY)
      doc.text('CloudBudgetMaster — Cost Report', logo ? MARGIN + 26 : MARGIN, 35)
      doc.setDrawColor(235, 235, 235); doc.line(MARGIN, 46, W - MARGIN, 46)
    }
    doc.setDrawColor(228, 228, 228); doc.line(MARGIN, H - 42, W - MARGIN, H - 42)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(150, 150, 150)
    doc.text('CloudBudgetMaster  ·  Confidential', MARGIN, H - 28)
    doc.text('cloudbudgetmaster.com', W / 2, H - 28, { align: 'center' })
    doc.text(`Page ${p} of ${pages}`, W - MARGIN, H - 28, { align: 'right' })
  }

  doc.save(`CloudBudgetMaster-Cost-Report-${today.toISOString().slice(0, 10)}.pdf`)
}
