import { useMemo, useState } from 'react'
import { CheckCircle2, PieChart as PieIcon, Layers } from 'lucide-react'

export interface ThreeDPieSlice {
  id: string
  label: string
  sublabel?: string
  value: number
  color?: string
  colorSide?: string
  colorWall?: string
  badge?: string
  badgeClass?: string
  metadata?: Record<string, any>
}

interface ThreeDPieChartProps {
  slices: ThreeDPieSlice[]
  title?: string
  subtitle?: string
  unitLabel?: string
  selectedId?: string | null
  onSelectSlice?: (sliceId: string) => void
  pieDepth?: number // 3D extrusion depth, default 34
  className?: string
}

// Preset modern colors: Emerald is #1 (highest contributor), followed by Blue, Orange, Purple, Red, Cyan, Amber, Pink
const PALETTE_3D = [
  { top: '#10b981', side: '#047857', wall: '#065f46' }, // #1 Emerald/Green (Dominan)
  { top: '#3b82f6', side: '#1d4ed8', wall: '#1e40af' }, // #2 Blue
  { top: '#f97316', side: '#c2410c', wall: '#9a3412' }, // #3 Orange
  { top: '#8b5cf6', side: '#6d28d9', wall: '#5b21b6' }, // #4 Purple
  { top: '#ef4444', side: '#b91c1c', wall: '#991b1b' }, // #5 Red
  { top: '#06b6d4', side: '#0e7490', wall: '#155e75' }, // #6 Cyan
  { top: '#eab308', side: '#a16207', wall: '#854d0e' }, // #7 Amber
  { top: '#ec4899', side: '#be185d', wall: '#9d174d' }, // #8 Pink
]

export function ThreeDPieChart({
  slices,
  title,
  subtitle,
  unitLabel = 'kejadian',
  selectedId,
  onSelectSlice,
  pieDepth = 34,
  className = '',
}: ThreeDPieChartProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [chartMode, setChartMode] = useState<'3d' | 'donut'>('3d')

  const activeId = hoveredId || selectedId

  // Sort slices strictly descending by value so the highest contributor is #1 at the top
  const sortedInputSlices = useMemo(() => {
    return [...slices].sort((a, b) => {
      const diff = Math.max(0, b.value) - Math.max(0, a.value)
      if (diff !== 0) return diff
      return a.label.localeCompare(b.label, 'id-ID')
    })
  }, [slices])

  // Calculate sum of values
  const totalValue = useMemo(() => {
    return sortedInputSlices.reduce((acc, s) => acc + Math.max(0, s.value), 0)
  }, [sortedInputSlices])

  // Process all slices with colors, rank, and percentages in descending order
  const allProcessedSlices = useMemo(() => {
    return sortedInputSlices.map((slice, index) => {
      const sliceVal = Math.max(0, slice.value)
      const percentage = totalValue > 0 ? (sliceVal / totalValue) * 100 : 0
      const colors = PALETTE_3D[index % PALETTE_3D.length]

      return {
        ...slice,
        rank: index + 1,
        index,
        percentage,
        topColor: slice.color || colors.top,
        sideColor: slice.colorSide || colors.side,
        wallColor: slice.colorWall || colors.wall,
      }
    })
  }, [sortedInputSlices, totalValue])

  // Filter only slices with non-zero values for rendering on chart
  const nonZeroSlices = useMemo(() => {
    return allProcessedSlices.filter((s) => s.value > 0)
  }, [allProcessedSlices])

  // Geometry configuration for 3D Pie
  const cx = 240
  const cy = 135
  const rx = 175
  const ry = 95
  const depth = pieDepth

  // Compute 3D geometry for active non-zero slices
  const geometrySlices = useMemo(() => {
    if (nonZeroSlices.length === 0) return []

    // Special Case: Exactly ONE slice has value > 0 (100% full circle)
    if (nonZeroSlices.length === 1) {
      const single = nonZeroSlices[0]
      return [
        {
          ...single,
          isFullCircle: true,
          percentage: 100,
          startAngle: 0,
          endAngle: 2 * Math.PI,
          midAngle: Math.PI / 2, // Front-facing
          angleSweep: 2 * Math.PI,
        },
      ]
    }

    // Normal Multi-Slice Case: Start at top (12 o'clock: -Math.PI / 2) and sweep clockwise
    let currentAngle = -Math.PI / 2

    return nonZeroSlices.map((slice) => {
      const fraction = slice.value / totalValue
      const angleSweep = fraction * 2 * Math.PI

      const startAngle = currentAngle
      const endAngle = currentAngle + angleSweep
      const midAngle = (startAngle + endAngle) / 2

      currentAngle = endAngle

      return {
        ...slice,
        isFullCircle: false,
        startAngle,
        endAngle,
        midAngle,
        angleSweep,
      }
    })
  }, [nonZeroSlices, totalValue])

  // Sort slices back-to-front (painters algorithm) based on mid-point y
  const depthSortedSlices = useMemo(() => {
    return [...geometrySlices].sort((a, b) => {
      return Math.sin(a.midAngle) - Math.sin(b.midAngle)
    })
  }, [geometrySlices])

  // 2D Donut Geometry Setup
  const donutCenter = { x: 240, y: 150 }
  const donutOuterRadius = 116
  const donutInnerRadius = 66

  const donutSlices = useMemo(() => {
    if (nonZeroSlices.length === 0) return []
    if (nonZeroSlices.length === 1) {
      return [
        {
          ...nonZeroSlices[0],
          isFullCircle: true,
          startAngle: -Math.PI / 2,
          endAngle: (3 * Math.PI) / 2,
          midAngle: Math.PI / 2,
        },
      ]
    }

    let curAngle = -Math.PI / 2
    return nonZeroSlices.map((slice) => {
      const fraction = slice.value / totalValue
      const sweep = fraction * 2 * Math.PI
      const startAngle = curAngle
      const endAngle = curAngle + sweep
      const midAngle = (startAngle + endAngle) / 2
      curAngle = endAngle

      return {
        ...slice,
        isFullCircle: false,
        startAngle,
        endAngle,
        midAngle,
        sweep,
      }
    })
  }, [nonZeroSlices, totalValue])

  if (slices.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center rounded-xl border border-line bg-ink-50/40 text-center p-4">
        <p className="text-sm text-muted">Belum ada data visualisasi untuk ditampilkan.</p>
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Title & View Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {title ? (
            <h4 className="font-display text-sm font-bold text-ink-900 sm:text-base">
              {title}
            </h4>
          ) : null}
          {subtitle ? <p className="text-xs text-muted mt-0.5">{subtitle}</p> : null}
        </div>

        <div className="flex items-center gap-2">
          {/* Mode Switcher: 3D Isometrik vs Donut 2D */}
          <div
            className="inline-flex items-center rounded-lg border border-line bg-ink-50/80 p-0.5 text-xs shadow-2xs"
            role="tablist"
            aria-label="Tampilan Diagram"
          >
            <button
              type="button"
              role="tab"
              aria-selected={chartMode === '3d'}
              onClick={() => setChartMode('3d')}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-semibold transition ${
                chartMode === '3d'
                  ? 'bg-white text-ink-900 shadow-xs font-bold'
                  : 'text-muted hover:text-ink-900'
              }`}
            >
              <Layers className="size-3.5" />
              <span>3D Isometrik</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={chartMode === 'donut'}
              onClick={() => setChartMode('donut')}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-semibold transition ${
                chartMode === 'donut'
                  ? 'bg-white text-ink-900 shadow-xs font-bold'
                  : 'text-muted hover:text-ink-900'
              }`}
            >
              <PieIcon className="size-3.5" />
              <span>Donut 2D</span>
            </button>
          </div>

          <span className="rounded-full bg-ink-100 px-2.5 py-1 text-[11px] font-semibold text-ink-700">
            Total: {totalValue.toLocaleString('id-ID')} {unitLabel}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1.1fr] items-center gap-6 rounded-xl border border-line bg-gradient-to-b from-ink-50/50 via-white to-ink-50/30 p-4 sm:p-5 shadow-xs">
        {/* Left: Interactive SVG Chart Canvas */}
        <div className="relative flex items-center justify-center overflow-hidden min-h-[280px]">
          {totalValue === 0 ? (
            <div className="flex flex-col items-center justify-center p-6 text-center">
              <CheckCircle2 className="h-10 w-10 text-ok-fg mb-2 opacity-80" />
              <p className="font-semibold text-ink-900 text-sm">
                Tidak Ada Kasus Tercatat (0 {unitLabel})
              </p>
              <p className="text-xs text-muted mt-1 max-w-xs">
                Seluruh data pada pilihan ini bernilai 0 atau berada dalam batas aman.
              </p>
            </div>
          ) : chartMode === '3d' ? (
            /* ========================================================
               3D ISOMETRIC PIE CHART
               ======================================================== */
            <svg
              viewBox="0 0 480 300"
              className="w-full max-w-[460px] h-auto select-none"
              style={{ filter: 'drop-shadow(0 14px 20px rgba(0, 0, 0, 0.12))' }}
            >
              <defs>
                <radialGradient id="pie-bottom-shadow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#0f172a" stopOpacity="0.35" />
                  <stop offset="60%" stopColor="#0f172a" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
                </radialGradient>
              </defs>

              {/* Elliptical Ground Shadow */}
              <ellipse
                cx={cx}
                cy={cy + depth + 22}
                rx={rx + 18}
                ry={ry - 12}
                fill="url(#pie-bottom-shadow)"
              />

              {/* 3D Slices rendered in depth order (back to front) */}
              {depthSortedSlices.map((slice) => {
                const isHovered = activeId === slice.id
                const isSelected = selectedId === slice.id
                const isElevated = isHovered || isSelected

                // Subtle explode offset along midAngle
                const explodeDist = isElevated && !slice.isFullCircle ? 14 : 0
                const ox = Math.cos(slice.midAngle) * explodeDist
                const oy = Math.sin(slice.midAngle) * explodeDist * 0.58

                const scx = cx + ox
                const scy = cy + oy

                // FULL 360-DEGREE PIE (100% SINGLE SLICE)
                if (slice.isFullCircle) {
                  const frontCylinderPath = `M ${scx + rx} ${scy} A ${rx} ${ry} 0 0 1 ${scx - rx} ${scy} L ${scx - rx} ${scy + depth} A ${rx} ${ry} 0 0 0 ${scx + rx} ${scy + depth} Z`

                  return (
                    <g
                      key={slice.id}
                      className="transition-all duration-300 cursor-pointer"
                      onMouseEnter={() => setHoveredId(slice.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      onClick={() => onSelectSlice?.(slice.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          onSelectSlice?.(slice.id)
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      aria-label={`${slice.label}: 100%`}
                    >
                      <path d={frontCylinderPath} fill={slice.sideColor} />
                      <ellipse
                        cx={scx}
                        cy={scy}
                        rx={rx}
                        ry={ry}
                        fill={slice.topColor}
                        stroke="rgba(255, 255, 255, 0.4)"
                        strokeWidth={1.5}
                      />
                      <text
                        x={scx}
                        y={scy + ry * 0.32}
                        fill="#ffffff"
                        textAnchor="middle"
                        className="font-display font-extrabold select-none pointer-events-none"
                        style={{
                          fontSize: '22px',
                          filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.7))',
                          fontWeight: 800,
                        }}
                      >
                        100%
                      </text>
                    </g>
                  )
                }

                // MULTI-SLICE WEDGE CASE
                const x1 = scx + rx * Math.cos(slice.startAngle)
                const y1 = scy + ry * Math.sin(slice.startAngle)
                const x2 = scx + rx * Math.cos(slice.endAngle)
                const y2 = scy + ry * Math.sin(slice.endAngle)

                const isLargeArc = slice.angleSweep > Math.PI ? 1 : 0
                const topPath = `M ${scx} ${scy} L ${x1} ${y1} A ${rx} ${ry} 0 ${isLargeArc} 1 ${x2} ${y2} Z`
                const startWallPath = `M ${scx} ${scy} L ${x1} ${y1} L ${x1} ${y1 + depth} L ${scx} ${scy + depth} Z`
                const endWallPath = `M ${scx} ${scy} L ${x2} ${y2} L ${x2} ${y2 + depth} L ${scx} ${scy + depth} Z`

                // Outer curved cylinder rim along visible front arc
                const steps = 24
                const points: Array<[number, number]> = []
                for (let i = 0; i <= steps; i++) {
                  const angle = slice.startAngle + (slice.angleSweep * i) / steps
                  const normalized = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
                  if (normalized >= 0 && normalized <= Math.PI) {
                    points.push([scx + rx * Math.cos(angle), scy + ry * Math.sin(angle)])
                  }
                }

                let outerRimPath = ''
                if (points.length >= 2) {
                  const topD = points.map((p, idx) => (idx === 0 ? `M ${p[0]} ${p[1]}` : `L ${p[0]} ${p[1]}`)).join(' ')
                  const bottomD = [...points]
                    .reverse()
                    .map((p) => `L ${p[0]} ${p[1] + depth}`)
                    .join(' ')
                  outerRimPath = `${topD} ${bottomD} Z`
                }

                // Adaptive label positioning: wide slices have their centroid closer to the center
                const rFactor = slice.percentage >= 50 ? 0.44 : slice.percentage >= 20 ? 0.58 : 0.68
                const lx = scx + rx * rFactor * Math.cos(slice.midAngle)
                const ly = scy + ry * rFactor * Math.sin(slice.midAngle)

                return (
                  <g
                    key={slice.id}
                    className="transition-all duration-300 cursor-pointer"
                    onMouseEnter={() => setHoveredId(slice.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={() => onSelectSlice?.(slice.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        onSelectSlice?.(slice.id)
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`${slice.label}: ${slice.percentage.toFixed(1)}%`}
                  >
                    {/* Radial Cut Walls */}
                    <path
                      d={startWallPath}
                      fill={slice.wallColor}
                      opacity={isElevated ? 0.98 : 0.88}
                    />
                    <path
                      d={endWallPath}
                      fill={slice.wallColor}
                      opacity={isElevated ? 0.98 : 0.88}
                    />

                    {/* Outer Cylinder Rim */}
                    {outerRimPath ? (
                      <path
                        d={outerRimPath}
                        fill={slice.sideColor}
                        opacity={isElevated ? 1 : 0.95}
                      />
                    ) : null}

                    {/* Top Face */}
                    <path
                      d={topPath}
                      fill={slice.topColor}
                      stroke="rgba(255, 255, 255, 0.45)"
                      strokeWidth={isElevated ? 2 : 1}
                      className="transition-transform duration-300"
                    />

                    {/* Percentage Label on Top Face (only if >= 5% to prevent cramped text) */}
                    {slice.percentage >= 5 ? (
                      <text
                        x={lx}
                        y={ly + 4}
                        fill="#ffffff"
                        textAnchor="middle"
                        className="font-display select-none pointer-events-none"
                        style={{
                          fontSize: slice.percentage >= 50 ? '19px' : slice.percentage >= 15 ? '15px' : '12px',
                          filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.75))',
                          fontWeight: 800,
                        }}
                      >
                        {Math.round(slice.percentage)}%
                      </text>
                    ) : null}
                  </g>
                )
              })}
            </svg>
          ) : (
            /* ========================================================
               MODERN 2D DONUT CHART
               ======================================================== */
            <svg
              viewBox="0 0 480 300"
              className="w-full max-w-[460px] h-auto select-none"
              style={{ filter: 'drop-shadow(0 8px 16px rgba(0, 0, 0, 0.08))' }}
            >
              {donutSlices.map((slice) => {
                const isHovered = activeId === slice.id
                const isSelected = selectedId === slice.id
                const isElevated = isHovered || isSelected

                const outerR = isElevated ? donutOuterRadius + 6 : donutOuterRadius
                const innerR = donutInnerRadius

                // Calculate arc path
                const x1 = donutCenter.x + outerR * Math.cos(slice.startAngle)
                const y1 = donutCenter.y + outerR * Math.sin(slice.startAngle)
                const x2 = donutCenter.x + outerR * Math.cos(slice.endAngle)
                const y2 = donutCenter.y + outerR * Math.sin(slice.endAngle)

                const ix1 = donutCenter.x + innerR * Math.cos(slice.endAngle)
                const iy1 = donutCenter.y + innerR * Math.sin(slice.endAngle)
                const ix2 = donutCenter.x + innerR * Math.cos(slice.startAngle)
                const iy2 = donutCenter.y + innerR * Math.sin(slice.startAngle)

                const isLarge = !slice.isFullCircle && slice.sweep > Math.PI ? 1 : 0

                const pathData = slice.isFullCircle
                  ? `M ${donutCenter.x - outerR} ${donutCenter.y} A ${outerR} ${outerR} 0 1 0 ${donutCenter.x + outerR} ${donutCenter.y} A ${outerR} ${outerR} 0 1 0 ${donutCenter.x - outerR} ${donutCenter.y} M ${donutCenter.x - innerR} ${donutCenter.y} A ${innerR} ${innerR} 0 1 1 ${donutCenter.x + innerR} ${donutCenter.y} A ${innerR} ${innerR} 0 1 1 ${donutCenter.x - innerR} ${donutCenter.y} Z`
                  : `M ${x1} ${y1} A ${outerR} ${outerR} 0 ${isLarge} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${innerR} ${innerR} 0 ${isLarge} 0 ${ix2} ${iy2} Z`

                // Label center in the middle of donut band
                const midR = (outerR + innerR) / 2
                const lx = donutCenter.x + midR * Math.cos(slice.midAngle)
                const ly = donutCenter.y + midR * Math.sin(slice.midAngle)

                return (
                  <g
                    key={slice.id}
                    className="transition-all duration-300 cursor-pointer"
                    onMouseEnter={() => setHoveredId(slice.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={() => onSelectSlice?.(slice.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        onSelectSlice?.(slice.id)
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`${slice.label}: ${slice.percentage.toFixed(1)}%`}
                  >
                    <path
                      d={pathData}
                      fill={slice.topColor}
                      stroke="#ffffff"
                      strokeWidth={2}
                      className="transition-transform duration-300"
                    />

                    {slice.percentage >= 6 ? (
                      <text
                        x={lx}
                        y={ly + 4}
                        fill="#ffffff"
                        textAnchor="middle"
                        className="font-display select-none pointer-events-none"
                        style={{
                          fontSize: slice.percentage >= 50 ? '16px' : slice.percentage >= 15 ? '13px' : '11px',
                          filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.7))',
                          fontWeight: 800,
                        }}
                      >
                        {Math.round(slice.percentage)}%
                      </text>
                    ) : null}
                  </g>
                )
              })}

              {/* Center Donut Label */}
              <text
                x={donutCenter.x}
                y={donutCenter.y - 4}
                textAnchor="middle"
                className="font-display font-extrabold fill-ink-900 select-none pointer-events-none text-2xl"
                style={{ fontSize: '26px', fontWeight: 800 }}
              >
                {totalValue.toLocaleString('id-ID')}
              </text>
              <text
                x={donutCenter.x}
                y={donutCenter.y + 16}
                textAnchor="middle"
                className="fill-muted select-none pointer-events-none text-[11px] font-semibold uppercase tracking-wider"
              >
                {unitLabel}
              </text>
            </svg>
          )}

          {/* Floating Hover Badge */}
          {activeId && totalValue > 0 ? (
            <div className="absolute top-2 left-2 rounded-lg bg-ink-900/90 backdrop-blur-xs text-white px-3 py-1.5 text-xs shadow-md pointer-events-none z-10">
              {(() => {
                const target = allProcessedSlices.find((s) => s.id === activeId)
                if (!target) return null
                const pct = totalValue > 0 ? ((target.value / totalValue) * 100).toFixed(1) : '0'
                return (
                  <div>
                    <span className="font-bold">{target.label}</span>
                    <span className="ml-1.5 text-emerald-300 font-extrabold">
                      {target.value.toLocaleString('id-ID')} {unitLabel} ({pct}%)
                    </span>
                  </div>
                )
              })()}
            </div>
          ) : null}
        </div>

        {/* Right: Interactive Legend & Ranked Slice Breakdown */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between pb-1.5 border-b border-line">
            <p className="text-xs font-bold uppercase tracking-wider text-muted">
              Urutan Wilayah ({allProcessedSlices.length})
            </p>
            <span className="text-[11px] text-muted font-medium">Diurutkan terbanyak</span>
          </div>

          <div className="divide-y divide-line/60 max-h-72 overflow-y-auto pr-1">
            {allProcessedSlices.map((slice) => {
              const isSelected = selectedId === slice.id
              const isHovered = hoveredId === slice.id

              return (
                <button
                  key={slice.id}
                  type="button"
                  onClick={() => onSelectSlice?.(slice.id)}
                  onMouseEnter={() => setHoveredId(slice.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className={`group relative flex w-full items-center justify-between gap-3 py-2.5 px-2.5 rounded-lg text-left transition min-h-11 ${
                    isSelected
                      ? 'bg-ink-100/90 text-ink-900 font-bold ring-1 ring-ink-300'
                      : isHovered
                        ? 'bg-ink-50 text-ink-900'
                        : 'hover:bg-ink-50/70 text-ink-800'
                  }`}
                >
                  {/* Left: Rank Badge + Color Dot + Details */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-extrabold ${
                        slice.rank === 1
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-ink-100 text-ink-600'
                      }`}
                    >
                      {slice.rank}
                    </span>

                    <span
                      className="size-3.5 rounded-sm shrink-0 shadow-xs"
                      style={{ backgroundColor: slice.topColor }}
                    />

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-semibold truncate group-hover:text-ume transition">
                          {slice.label}
                        </p>
                        {slice.rank === 1 ? (
                          <span className="inline-flex items-center rounded px-1.5 py-0.2 text-[9px] font-bold bg-emerald-100 text-emerald-800 shrink-0">
                            Terbanyak
                          </span>
                        ) : null}
                      </div>
                      {slice.sublabel ? (
                        <p className="text-[11px] text-muted truncate">{slice.sublabel}</p>
                      ) : null}
                    </div>
                  </div>

                  {/* Right: Percentage & Value */}
                  <div className="text-right shrink-0">
                    <div className="flex items-baseline justify-end gap-1">
                      <span className="num font-display font-extrabold text-sm tabular-nums text-ink-900">
                        {Math.round(slice.percentage)}%
                      </span>
                    </div>
                    <span className="block text-[11px] text-muted tabular-nums">
                      {slice.value.toLocaleString('id-ID')} {unitLabel}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
