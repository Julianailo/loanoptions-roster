import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { addDays, format, getDay, parseISO } from 'date-fns'
import type { Broker, ExcludedDate, Shift } from '../types'
import { fullName } from '../data/brokers'

const BRAND = {
  primary: [86, 20, 187] as [number, number, number], // #5614BB
  ink: [33, 37, 41] as [number, number, number],
  muted: [108, 117, 125] as [number, number, number],
  surface: [249, 244, 255] as [number, number, number], // brand-50
}

export interface WeekendPDFArgs {
  saturday: Date
  shifts: Shift[]
  brokers: Broker[]
  exclusions: Map<string, ExcludedDate>
  blackouts: { brokerId: string; date: string; reason?: string }[]
}

function brokerName(id: string | null, brokers: Broker[]): string {
  if (!id) return '— Unassigned —'
  const b = brokers.find(x => x.id === id)
  return b ? fullName(b) : id
}

/**
 * Generates a single PDF covering a Saturday + the following Sunday.
 * Filename: loanoptions-weekend-<sat-date>.pdf
 */
export function generateWeekendPDF(args: WeekendPDFArgs): jsPDF {
  const { saturday, shifts, brokers, exclusions, blackouts } = args
  const sunday = addDays(saturday, 1)

  const satKey = format(saturday, 'yyyy-MM-dd')
  const sunKey = format(sunday, 'yyyy-MM-dd')
  const satShifts = shifts.filter(s => s.date === satKey).sort((a, b) => a.slotIndex - b.slotIndex)
  const sunShifts = shifts.filter(s => s.date === sunKey).sort((a, b) => a.slotIndex - b.slotIndex)

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const M = 48 // page margin

  // Header band
  doc.setFillColor(...BRAND.primary)
  doc.rect(0, 0, pageW, 90, 'F')

  // Logo block (L on white tile)
  doc.setFillColor(255, 255, 255)
  doc.roundedRect(M, 24, 42, 42, 8, 8, 'F')
  doc.setTextColor(...BRAND.primary)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(26)
  doc.text('L', M + 21, 54, { align: 'center', baseline: 'middle' })

  // Brand text
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('LoanOptions.ai', M + 60, 44)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(217, 205, 248)
  doc.text('Weekend Roster', M + 60, 62)

  // Range right-aligned in header
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  const rangeLabel = `${format(saturday, 'EEEE d MMMM yyyy')} – ${format(sunday, 'EEEE d MMMM yyyy')}`
  doc.text(rangeLabel, pageW - M, 56, { align: 'right' })

  // Subtitle below header
  let y = 120
  doc.setTextColor(...BRAND.ink)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text(`Weekend of ${format(saturday, 'd MMMM yyyy')}`, M, y)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...BRAND.muted)
  doc.text(
    `Generated ${format(new Date(), 'd MMM yyyy, h:mm a')} · Sydney NSW`,
    M,
    y + 16
  )
  y += 40

  const renderDay = (label: string, dateStr: string, dayShifts: Shift[]) => {
    const date = parseISO(dateStr)
    const excluded = exclusions.get(dateStr)
    doc.setTextColor(...BRAND.primary)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.text(`${label} · ${format(date, 'EEEE d MMM yyyy')}`, M, y)
    y += 6

    if (excluded) {
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(11)
      doc.setTextColor(...BRAND.muted)
      autoTable(doc, {
        startY: y + 8,
        head: [['Status', 'Reason']],
        body: [['No shift — excluded', excluded.reason]],
        theme: 'grid',
        styles: { fontSize: 10, cellPadding: 8 },
        headStyles: { fillColor: BRAND.surface, textColor: BRAND.primary, fontStyle: 'bold' },
        margin: { left: M, right: M },
      })
    } else {
      const rows = dayShifts.length
        ? dayShifts.map(s => [
            String(s.slotIndex + 1),
            brokerName(s.brokerId, brokers),
            s.manualOverride ? 'Manual' : s.locked ? 'Locked' : 'Auto',
          ])
        : [['—', '— Unassigned —', '']]
      autoTable(doc, {
        startY: y + 8,
        head: [['Slot', 'Broker', 'Source']],
        body: rows,
        theme: 'grid',
        styles: { fontSize: 11, cellPadding: 9, textColor: BRAND.ink },
        headStyles: {
          fillColor: BRAND.surface,
          textColor: BRAND.primary,
          fontStyle: 'bold',
        },
        columnStyles: {
          0: { cellWidth: 60, halign: 'center' },
          2: { cellWidth: 80, halign: 'center', textColor: BRAND.muted },
        },
        margin: { left: M, right: M },
      })
    }
    const lastY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY
    y = (lastY ?? y) + 28
  }

  renderDay('Saturday', satKey, satShifts)
  renderDay('Sunday', sunKey, sunShifts)

  // Blackouts list (everyone visible per spec)
  const weekendBlackouts = blackouts.filter(b => b.date === satKey || b.date === sunKey)
  if (weekendBlackouts.length > 0) {
    doc.setTextColor(...BRAND.primary)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('Blackouts this weekend', M, y)
    y += 4
    autoTable(doc, {
      startY: y + 8,
      head: [['Date', 'Broker', 'Reason']],
      body: weekendBlackouts.map(b => {
        const broker = brokers.find(x => x.id === b.brokerId)
        return [
          format(parseISO(b.date), 'EEE d MMM'),
          broker ? fullName(broker) : b.brokerId,
          b.reason ?? '',
        ]
      }),
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 7 },
      headStyles: { fillColor: BRAND.surface, textColor: BRAND.primary, fontStyle: 'bold' },
      margin: { left: M, right: M },
    })
  }

  // Footer
  const pageH = doc.internal.pageSize.getHeight()
  doc.setDrawColor(222, 226, 230)
  doc.setLineWidth(0.5)
  doc.line(M, pageH - 48, pageW - M, pageH - 48)
  doc.setTextColor(...BRAND.muted)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('LoanOptions.ai · Weekend Roster · Generated automatically — verify before publishing.', M, pageH - 30)

  return doc
}

export function downloadWeekendPDF(args: WeekendPDFArgs) {
  const doc = generateWeekendPDF(args)
  // Find the Saturday date for filename. args.saturday may not be a Saturday if caller passed Sunday — find nearest Sat.
  let satDate = args.saturday
  if (getDay(satDate) !== 6) {
    // step back to Sat
    while (getDay(satDate) !== 6) satDate = addDays(satDate, -1)
  }
  doc.save(`loanoptions-weekend-${format(satDate, 'yyyy-MM-dd')}.pdf`)
}

export interface MonthsRosterPDFArgs {
  months: Date[] // start-of-month dates to cover
  shifts: Shift[]
  brokers: Broker[]
  exclusionsFor: (start: string, end: string) => Map<string, ExcludedDate>
  blackouts: { brokerId: string; date: string; reason?: string }[]
}

/**
 * Generates a single PDF covering all weekends across the given months.
 */
export function generateMonthsRosterPDF(args: MonthsRosterPDFArgs): jsPDF {
  const { months, shifts, brokers, exclusionsFor, blackouts } = args

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const M = 48

  const monthLabels = months.map(m => format(m, 'MMMM yyyy')).join(' & ')

  // Header band
  doc.setFillColor(...BRAND.primary)
  doc.rect(0, 0, pageW, 90, 'F')

  // Logo block
  doc.setFillColor(255, 255, 255)
  doc.roundedRect(M, 24, 42, 42, 8, 8, 'F')
  doc.setTextColor(...BRAND.primary)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(26)
  doc.text('L', M + 21, 54, { align: 'center', baseline: 'middle' })

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('LoanOptions.ai', M + 60, 44)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(217, 205, 248)
  doc.text('Weekend Roster', M + 60, 62)

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(monthLabels, pageW - M, 56, { align: 'right' })

  let y = 120
  doc.setTextColor(...BRAND.ink)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text(`Roster: ${monthLabels}`, M, y)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...BRAND.muted)
  doc.text(`Generated ${format(new Date(), 'd MMM yyyy, h:mm a')} · Sydney NSW`, M, y + 16)
  y += 44

  const drawFooter = () => {
    doc.setDrawColor(222, 226, 230)
    doc.setLineWidth(0.5)
    doc.line(M, pageH - 48, pageW - M, pageH - 48)
    doc.setTextColor(...BRAND.muted)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(
      'LoanOptions.ai · Weekend Roster · Generated automatically — verify before publishing.',
      M,
      pageH - 30
    )
  }

  for (const monthStart of months) {
    // Collect all Saturdays in this month
    const weekends: Date[] = []
    let d = monthStart
    while (format(d, 'yyyy-MM') === format(monthStart, 'yyyy-MM')) {
      if (getDay(d) === 6) weekends.push(new Date(d))
      d = addDays(d, 1)
    }

    // Month section header
    if (y > pageH - 120) {
      drawFooter()
      doc.addPage()
      y = M
    }

    doc.setFillColor(...BRAND.surface)
    doc.roundedRect(M, y, pageW - M * 2, 28, 4, 4, 'F')
    doc.setTextColor(...BRAND.primary)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.text(format(monthStart, 'MMMM yyyy'), M + 12, y + 18)
    y += 40

    for (const saturday of weekends) {
      const sunday = addDays(saturday, 1)
      const satKey = format(saturday, 'yyyy-MM-dd')
      const sunKey = format(sunday, 'yyyy-MM-dd')

      const exclusions = exclusionsFor(satKey, sunKey)
      const satShifts = shifts.filter(s => s.date === satKey).sort((a, b) => a.slotIndex - b.slotIndex)
      const sunShifts = shifts.filter(s => s.date === sunKey).sort((a, b) => a.slotIndex - b.slotIndex)

      // Weekend label
      if (y > pageH - 200) {
        drawFooter()
        doc.addPage()
        y = M
      }

      doc.setTextColor(...BRAND.ink)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.text(
        `Weekend of ${format(saturday, 'd MMM')} – ${format(sunday, 'd MMM yyyy')}`,
        M,
        y
      )
      y += 6

      const satExcluded = exclusions.get(satKey)
      const sunExcluded = exclusions.get(sunKey)

      const rows: string[][] = []

      if (satExcluded) {
        rows.push([format(saturday, 'EEE d MMM'), 'No shift — excluded', satExcluded.reason])
      } else {
        if (satShifts.length === 0) {
          rows.push([format(saturday, 'EEE d MMM'), '—', '— Unassigned —'])
        } else {
          satShifts.forEach((s, i) => {
            rows.push([
              i === 0 ? format(saturday, 'EEE d MMM') : '',
              `Slot ${s.slotIndex + 1}`,
              brokerName(s.brokerId, brokers),
            ])
          })
        }
      }

      if (sunExcluded) {
        rows.push([format(sunday, 'EEE d MMM'), 'No shift — excluded', sunExcluded.reason])
      } else {
        if (sunShifts.length === 0) {
          rows.push([format(sunday, 'EEE d MMM'), '—', '— Unassigned —'])
        } else {
          sunShifts.forEach((s, i) => {
            rows.push([
              i === 0 ? format(sunday, 'EEE d MMM') : '',
              `Slot ${s.slotIndex + 1}`,
              brokerName(s.brokerId, brokers),
            ])
          })
        }
      }

      autoTable(doc, {
        startY: y + 8,
        head: [['Day', 'Slot', 'Broker']],
        body: rows,
        theme: 'grid',
        styles: { fontSize: 10, cellPadding: 7, textColor: BRAND.ink },
        headStyles: { fillColor: BRAND.surface, textColor: BRAND.primary, fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 100, fontStyle: 'bold' },
          1: { cellWidth: 60, halign: 'center' },
        },
        margin: { left: M, right: M },
      })

      const lastY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY
      y = (lastY ?? y) + 24
    }

    y += 12
  }

  // Blackouts section for the covered period
  const allDates = months.flatMap(monthStart => {
    const dates: string[] = []
    let d = monthStart
    while (format(d, 'yyyy-MM') === format(monthStart, 'yyyy-MM')) {
      dates.push(format(d, 'yyyy-MM-dd'))
      d = addDays(d, 1)
    }
    return dates
  })
  const relevantBlackouts = blackouts.filter(b => allDates.includes(b.date))

  if (relevantBlackouts.length > 0) {
    if (y > pageH - 160) {
      drawFooter()
      doc.addPage()
      y = M
    }

    doc.setFillColor(...BRAND.surface)
    doc.roundedRect(M, y, pageW - M * 2, 28, 4, 4, 'F')
    doc.setTextColor(...BRAND.primary)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.text('Blackouts', M + 12, y + 18)
    y += 40

    autoTable(doc, {
      startY: y,
      head: [['Date', 'Broker', 'Reason']],
      body: relevantBlackouts.map(b => {
        const broker = brokers.find(x => x.id === b.brokerId)
        return [
          format(parseISO(b.date), 'EEE d MMM yyyy'),
          broker ? fullName(broker) : b.brokerId,
          b.reason ?? '',
        ]
      }),
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 7 },
      headStyles: { fillColor: BRAND.surface, textColor: BRAND.primary, fontStyle: 'bold' },
      margin: { left: M, right: M },
    })

    const lastY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY
    y = (lastY ?? y) + 24
  }

  drawFooter()
  return doc
}

export function downloadMonthsRosterPDF(args: MonthsRosterPDFArgs) {
  const doc = generateMonthsRosterPDF(args)
  const label = args.months.map(m => format(m, 'yyyy-MM')).join('_')
  doc.save(`loanoptions-roster-${label}.pdf`)
}
