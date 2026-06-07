import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const NAVY = [35, 47, 62]
const INK = [17, 24, 39]
const RED = [220, 38, 38]
const AMBER = [217, 119, 6]
const GREEN = [5, 150, 105]
const BLUE = [63, 169, 245]
const ORANGE = [255, 153, 0]
const GREY = [110, 118, 128]
const MARGIN = 40

const money = (n) => `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const money0 = (n) => `$${Math.round(Number(n || 0)).toLocaleString()}`

const TYPE_LABEL = {
  ec2_instance: 'EC2 Instance', rds_instance: 'RDS Database', ebs_volume: 'EBS Volume',
  elastic_ip: 'Elastic IP', s3_bucket: 'S3 Bucket', compute_instance: 'Compute VM', persistent_disk: 'Persistent Disk',
}
const typeLabel = (t) => TYPE_LABEL[t] || (t || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
const SVC = {
  'Amazon Elastic Compute Cloud - Compute': 'EC2', 'Amazon Relational Database Service': 'RDS',
  'Amazon Simple Storage Service': 'S3', 'AmazonCloudWatch': 'CloudWatch', 'AWS Key Management Service': 'KMS',
  'Amazon Virtual Private Cloud': 'VPC', 'Amazon Route 53': 'Route 53', 'Elastic Load Balancing': 'ELB',
  'Amazon ElastiCache': 'ElastiCache', 'Amazon Elastic Kubernetes Service': 'EKS', 'AWS Lambda': 'Lambda',
  'Amazon DynamoDB': 'DynamoDB', 'Amazon Elastic Block Store': 'EBS', 'AWS CloudTrail': 'CloudTrail',
  'Amazon Simple Notification Service': 'SNS', 'Amazon Simple Queue Service': 'SQS', 'AWS Config': 'Config',
}
const svcLabel = (n) => SVC[n] || (n || '').replace(/^Amazon /, '').replace(/^AWS /, '')
function modelLabel(m) {
  if (!m || m === 'rule-based') return ''
  const id = m.split('/').pop()
  if (/kimi/i.test(m)) return 'Kimi K2'
  if (/gpt-oss-120b/i.test(id)) return 'GPT-OSS 120B'
  if (/gpt-oss/i.test(id)) return 'GPT-OSS'
  if (/qwen3-32b/i.test(id)) return 'Qwen3 32B'
  if (/llama-3\.3/i.test(id)) return 'Llama 3.3 70B'
  return id
}

async function loadLogo() {
  try {
    const res = await fetch('/logo.png')
    const blob = await res.blob()
    return await new Promise((resolve) => {
      const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = () => resolve(null); r.readAsDataURL(blob)
    })
  } catch { return null }
}

function ensure(ctx, needed) {
  if (ctx.y + needed > ctx.H - 60) { ctx.doc.addPage(); ctx.y = 64 }
}

function sectionTitle(ctx, text, note, newPage) {
  const { doc, W } = ctx
  if (newPage && ctx.y > 72) { doc.addPage(); ctx.y = 64 }
  else ensure(ctx, 44)
  doc.setTextColor(...INK); doc.setFont('helvetica', 'bold'); doc.setFontSize(13)
  doc.text(text, MARGIN, ctx.y)
  if (note) { doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...GREY); doc.text(note, W - MARGIN, ctx.y, { align: 'right' }) }
  doc.setDrawColor(...ORANGE); doc.setLineWidth(2); doc.line(MARGIN, ctx.y + 5, MARGIN + 28, ctx.y + 5); doc.setLineWidth(0.5)
  ctx.y += 22
}

/** Horizontal ranked bars: [{label, value, percent?}] with a colour. */
function rankedBars(ctx, items, color) {
  const { doc, W } = ctx
  const max = Math.max(...items.map(i => i.value), 1)
  ensure(ctx, items.length * 18 + 8)
  items.forEach((it) => {
    const labelW = 120, barX = MARGIN + labelW, barW = W - 2 * MARGIN - labelW - 110
    doc.setFontSize(8.5); doc.setTextColor(60, 60, 60); doc.setFont('helvetica', 'normal')
    const lbl = it.label.length > 24 ? it.label.slice(0, 23) + '…' : it.label
    doc.text(lbl, MARGIN, ctx.y + 8)
    doc.setFillColor(238, 240, 243); doc.rect(barX, ctx.y, barW, 8, 'F')
    doc.setFillColor(...color); doc.rect(barX, ctx.y, Math.max((it.value / max) * barW, 1), 8, 'F')
    if (it.percent != null) { doc.setTextColor(...GREY); doc.text(`${it.percent}%`, barX + barW + 8, ctx.y + 7) }
    doc.setTextColor(...INK); doc.setFont('helvetica', 'bold')
    doc.text(money(it.value), MARGIN + (W - 2 * MARGIN), ctx.y + 7, { align: 'right' })
    ctx.y += 18
  })
  ctx.y += 6
}

function drawTrendChart(ctx, points) {
  const { doc, W } = ctx
  const h = 120, x0 = MARGIN, w = W - 2 * MARGIN
  ensure(ctx, h + 30)
  const top = ctx.y
  doc.setDrawColor(232, 232, 232); doc.setFillColor(250, 250, 251); doc.rect(x0, top, w, h, 'FD')
  const max = Math.max(...points.map(p => p.total_cost_usd || 0), 1)
  const n = points.length || 1, bw = w / n
  points.forEach((p, i) => {
    const bh = ((p.total_cost_usd || 0) / max) * (h - 22)
    doc.setFillColor(...ORANGE); doc.rect(x0 + i * bw + bw * 0.18, top + h - bh - 4, Math.max(bw * 0.64, 1), bh, 'F')
  })
  doc.setFontSize(7); doc.setTextColor(...GREY); doc.text(money0(max), x0 + 5, top + 11); doc.text('$0', x0 + 5, top + h - 5)
  ctx.y = top + h + 6
  doc.setFontSize(7.5)
  if (points[0]) doc.text(points[0].date, x0, ctx.y + 7)
  if (points[n - 1]) doc.text(points[n - 1].date, x0 + w, ctx.y + 7, { align: 'right' })
  ctx.y += 22
}

export async function generateCostReport({ summary, trend = [], connections = [], resources = [], services = [], forecast, tags, account, insights }) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight()
  const logo = await loadLogo()
  const today = new Date()
  const fmtDate = today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const ctx = { doc, W, H, y: 0 }

  const monthly = summary?.total_monthly_cost_usd || 0
  const waste = summary?.total_waste_cost_usd || 0
  const savingsPct = monthly > 0 ? (waste / monthly) * 100 : 0
  const annual = waste * 12
  const wow = summary?.cost_change_wow_percent || 0
  const totalRes = summary?.total_resources ?? resources.length
  const unused = summary?.unused_resources ?? resources.filter(r => r.waste_status && r.waste_status !== 'active').length
  const projected = forecast?.projected_monthly

  // ════════ COVER PAGE ════════
  doc.setFillColor(...NAVY); doc.rect(0, 0, W, H, 'F')
  if (logo) doc.addImage(logo, 'PNG', W / 2 - 30, 120, 60, 60)
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(15)
  doc.text('CloudBudgetMaster', W / 2, 205, { align: 'center' })
  doc.setFontSize(28); doc.text('Cloud Cost & Savings Report', W / 2, 270, { align: 'center' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(12); doc.setTextColor(255, 172, 49)
  doc.text(`Prepared for ${account || 'your organization'}`, W / 2, 298, { align: 'center' })
  doc.setTextColor(180, 188, 200); doc.setFontSize(10)
  doc.text(`Reporting period: last 30 days  ·  Generated ${fmtDate}`, W / 2, 318, { align: 'center' })
  doc.text(`${connections.length} connection${connections.length === 1 ? '' : 's'}  ·  ${totalRes} resources`, W / 2, 334, { align: 'center' })

  const heroCards = [
    ['Monthly Spend', money0(monthly)],
    ['Projected Month-end', projected != null ? money0(projected) : '—'],
    ['Recoverable Waste', money0(waste)],
    ['Savings Potential', `${savingsPct.toFixed(0)}%`],
  ]
  const hw = (W - 2 * MARGIN - 3 * 12) / 4
  heroCards.forEach((c, i) => {
    const x = MARGIN + i * (hw + 12), y = 420
    doc.setFillColor(255, 255, 255, 0); doc.setDrawColor(80, 92, 108); doc.roundedRect(x, y, hw, 70, 5, 5, 'D')
    doc.setTextColor(150, 160, 174); doc.setFontSize(7.5); doc.text(c[0].toUpperCase(), x + hw / 2, y + 24, { align: 'center' })
    doc.setTextColor(255, 172, 49); doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.text(c[1], x + hw / 2, y + 50, { align: 'center' })
    doc.setFont('helvetica', 'normal')
  })
  doc.setTextColor(120, 130, 144); doc.setFontSize(8.5)
  doc.text('Confidential — prepared by CloudBudgetMaster · cloudbudgetmaster.com', W / 2, H - 50, { align: 'center' })

  // ════════ CONTENT ════════
  doc.addPage(); ctx.y = 64

  // Executive summary
  sectionTitle(ctx, 'Executive Summary')
  const cards = [
    ['Monthly Spend', money(monthly), INK, wow !== 0 ? `${wow > 0 ? '+' : '-'}${Math.abs(wow)}% wk/wk` : ''],
    ['Projected Month-end', projected != null ? money0(projected) : '—', INK, forecast?.trend_direction || ''],
    ['Monthly Waste', money(waste), RED, ''],
    ['Recoverable', `${savingsPct.toFixed(1)}%`, AMBER, ''],
    ['Annual Savings', money0(annual), GREEN, ''],
  ]
  const cw = (W - 2 * MARGIN - 4 * 10) / 5
  cards.forEach((c, i) => {
    const x = MARGIN + i * (cw + 10)
    doc.setFillColor(247, 248, 250); doc.roundedRect(x, ctx.y, cw, 60, 4, 4, 'F')
    doc.setTextColor(...GREY); doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.text(c[0].toUpperCase(), x + 8, ctx.y + 16, { maxWidth: cw - 12 })
    doc.setTextColor(...c[2]); doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text(c[1], x + 8, ctx.y + 36)
    if (c[3]) { doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...GREY); doc.text(c[3], x + 8, ctx.y + 50) }
  })
  ctx.y += 60 + 16
  doc.setTextColor(70, 70, 70); doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5)
  const para = waste > 0
    ? `Across ${totalRes} scanned resources in ${connections.length} connection${connections.length === 1 ? '' : 's'}, ${unused} are idle or unused — wasting approximately ${money(waste)} per month (${money0(annual)} per year). Acting on the items in this report recovers about ${savingsPct.toFixed(1)}% of current cloud spend.`
    : `Across ${totalRes} scanned resources in ${connections.length} connection${connections.length === 1 ? '' : 's'}, no waste was detected. Current cloud spend appears healthy and well-optimized.`
  const lines = doc.splitTextToSize(para, W - 2 * MARGIN)
  doc.text(lines, MARGIN, ctx.y + 2); ctx.y += lines.length * 13 + 18

  // AI narrative (Kimi K2)
  if (insights?.executive_summary) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...INK)
    doc.text('AI Analysis', MARGIN, ctx.y)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...GREY)
    const ml = modelLabel(insights.model)
    doc.text(ml ? `Generated by ${ml}` : '', W - MARGIN, ctx.y, { align: 'right' })
    ctx.y += 16
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(70, 70, 70)
    insights.executive_summary.split(/\n{2,}/).forEach(p => {
      const pl = doc.splitTextToSize(p.trim(), W - 2 * MARGIN)
      ensure(ctx, pl.length * 13 + 8)
      doc.text(pl, MARGIN, ctx.y); ctx.y += pl.length * 13 + 8
    })
    ctx.y += 8
  }

  // Cost by service
  if (services.length) {
    sectionTitle(ctx, 'Cost by Service', '(last 30 days)', true)
    rankedBars(ctx, services.slice(0, 10).map(s => ({ label: svcLabel(s.service), value: s.cost, percent: s.percent })), ORANGE)
  }

  // Cost trend
  if (trend.length) { sectionTitle(ctx, '30-Day Cost Trend', null, true); drawTrendChart(ctx, trend) }

  // Cost allocation by tag
  const groups = tags?.groups || []
  if (groups.length) {
    const tagTotal = groups.reduce((s, g) => s + g.total_cost, 0)
    const untagged = groups.find(g => g.tag_value === 'Untagged')
    const taggedPct = tagTotal > 0 ? (((tagTotal - (untagged?.total_cost || 0)) / tagTotal) * 100).toFixed(0) : 0
    sectionTitle(ctx, 'Cost Allocation', `by ${tags.tag_key} · tagging coverage ${taggedPct}%`, true)
    rankedBars(ctx, groups.slice(0, 8).map(g => ({ label: g.tag_value, value: g.total_cost })), BLUE)
  }

  // Top resources by cost
  const topCost = resources.slice().sort((a, b) => (b.monthly_cost_usd || 0) - (a.monthly_cost_usd || 0)).slice(0, 10)
  if (topCost.length) {
    sectionTitle(ctx, 'Top Resources by Cost', null, true)
    autoTable(doc, {
      startY: ctx.y,
      head: [['#', 'Resource', 'Type', 'Region', 'Monthly']],
      body: topCost.map((r, i) => [i + 1, r.resource_name || r.resource_id || '—', typeLabel(r.resource_type), r.region || '', money(r.monthly_cost_usd)]),
      styles: { fontSize: 8.5, cellPadding: 5, textColor: [45, 45, 45], lineColor: [236, 236, 236], lineWidth: 0.5 },
      headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      columnStyles: { 0: { cellWidth: 22, halign: 'center' }, 4: { halign: 'right' } },
      margin: { left: MARGIN, right: MARGIN, bottom: 56 },
    })
    ctx.y = doc.lastAutoTable.finalY + 24
  }

  // Detailed suggestions (AI)
  if (insights?.suggestions?.length) {
    sectionTitle(ctx, 'Detailed Suggestions', null, true)
    insights.suggestions.forEach((s, i) => {
      ensure(ctx, 46)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...INK)
      const head = `${i + 1}. ${s.title}` + (s.monthly_savings > 0 ? `   (~${money(s.monthly_savings)}/mo)` : '')
      const hl = doc.splitTextToSize(head, W - 2 * MARGIN)
      doc.text(hl, MARGIN, ctx.y); ctx.y += hl.length * 13 + 2
      if (s.detail) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(70, 70, 70)
        const dl = doc.splitTextToSize(s.detail, W - 2 * MARGIN - 8)
        doc.text(dl, MARGIN + 8, ctx.y); ctx.y += dl.length * 11 + 10
      }
    })
  }

  // Common questions (AI FAQ)
  if (insights?.faq?.length) {
    sectionTitle(ctx, 'Common Questions', null, true)
    insights.faq.forEach((f) => {
      ensure(ctx, 44)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...INK)
      const ql = doc.splitTextToSize(`Q.  ${f.q}`, W - 2 * MARGIN)
      doc.text(ql, MARGIN, ctx.y); ctx.y += ql.length * 12 + 3
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(70, 70, 70)
      const al = doc.splitTextToSize(f.a, W - 2 * MARGIN - 8)
      doc.text(al, MARGIN + 8, ctx.y); ctx.y += al.length * 12 + 14
    })
  }

  // Per-connection sections
  const byConn = {}
  resources.forEach(r => { (byConn[r.connection_id] ||= []).push(r) })
  connections.forEach((conn) => {
    const rs = (byConn[conn.id] || []).slice().sort((a, b) => (b.waste_monthly_cost_usd || 0) - (a.waste_monthly_cost_usd || 0) || (b.monthly_cost_usd || 0) - (a.monthly_cost_usd || 0))
    const cost = rs.reduce((s, r) => s + (r.monthly_cost_usd || 0), 0)
    const w = rs.reduce((s, r) => s + (r.waste_monthly_cost_usd || 0), 0)
    const wasted = rs.filter(r => r.waste_status && r.waste_status !== 'active').length
    sectionTitle(ctx, `Connection — ${conn.display_name || conn.provider}`, null, true)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(90, 90, 90)
    doc.text([`Provider: ${(conn.provider || '').toUpperCase()}`, `Resources: ${rs.length}`, `Idle/unused: ${wasted}`, `Monthly: ${money(cost)}`, `Waste: ${money(w)}`].join('     '), MARGIN, ctx.y)
    ctx.y += 16
    if (rs.length) {
      autoTable(doc, {
        startY: ctx.y,
        head: [['#', 'Resource', 'Type', 'Region', 'State', 'Monthly', 'Waste']],
        body: rs.map((r, i) => [i + 1, r.resource_name || r.resource_id || '—', typeLabel(r.resource_type), r.region || '', r.status || '', money(r.monthly_cost_usd), r.waste_status && r.waste_status !== 'active' ? money(r.waste_monthly_cost_usd) : '—']),
        styles: { fontSize: 8, cellPadding: 4, textColor: [45, 45, 45], lineColor: [236, 236, 236], lineWidth: 0.5, overflow: 'ellipsize' },
        headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        alternateRowStyles: { fillColor: [249, 250, 251] },
        columnStyles: { 0: { cellWidth: 20, halign: 'center' }, 1: { cellWidth: 150 }, 5: { halign: 'right' }, 6: { halign: 'right' } },
        margin: { left: MARGIN, right: MARGIN, bottom: 56 },
        didParseCell: (d) => { if (d.section === 'body' && d.column.index === 6 && d.cell.raw !== '—') { d.cell.styles.textColor = RED; d.cell.styles.fontStyle = 'bold' } },
      })
      ctx.y = doc.lastAutoTable.finalY + 20
    }
  })

  // Remediation
  const wastedRes = resources.filter(r => r.waste_status && r.waste_status !== 'active' && r.fix_recommendation)
  if (wastedRes.length) {
    sectionTitle(ctx, 'Recommended Remediation', null, true)
    wastedRes.slice(0, 40).forEach((r, i) => {
      ensure(ctx, 40)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...INK)
      doc.text(doc.splitTextToSize(`${i + 1}. ${r.resource_name || r.resource_id}  (${typeLabel(r.resource_type)} · ${r.region})  —  ${money(r.waste_monthly_cost_usd)}/mo`, W - 2 * MARGIN), MARGIN, ctx.y); ctx.y += 14
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(70, 70, 70)
      const sum = doc.splitTextToSize(`Action: ${r.fix_recommendation.summary}`, W - 2 * MARGIN - 8)
      doc.text(sum, MARGIN + 8, ctx.y); ctx.y += sum.length * 11 + 8
    })
  }

  // ── Header (content pages) + footer (content pages) ──
  const pages = doc.getNumberOfPages()
  for (let p = 2; p <= pages; p++) {
    doc.setPage(p)
    if (logo) doc.addImage(logo, 'PNG', MARGIN, 22, 18, 18)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...NAVY)
    doc.text('CloudBudgetMaster — Cost Report', logo ? MARGIN + 26 : MARGIN, 35)
    doc.setDrawColor(235, 235, 235); doc.line(MARGIN, 46, W - MARGIN, 46)
    doc.line(MARGIN, H - 42, W - MARGIN, H - 42)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(150, 150, 150)
    doc.text('CloudBudgetMaster  ·  Confidential', MARGIN, H - 28)
    doc.text('cloudbudgetmaster.com', W / 2, H - 28, { align: 'center' })
    doc.text(`Page ${p - 1} of ${pages - 1}`, W - MARGIN, H - 28, { align: 'right' })
  }

  doc.save(`CloudBudgetMaster-Cost-Report-${today.toISOString().slice(0, 10)}.pdf`)
}
