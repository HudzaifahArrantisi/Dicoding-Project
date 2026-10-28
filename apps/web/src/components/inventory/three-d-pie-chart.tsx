import { useMemo, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'

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

// Preset modern 3D colors matching the reference 3D pie visual
const PALETTE_3D = [
  { top: '#3b82f6', side: '#1d4ed8', wall: '#1e40af' }, // Blue
  { top: '#ef4444', side: '#b91c1c', wall: '#991b1b' }, // Red
  { top: '#f97316', side: '#c2410c', wall: '#9a3412' }, // Orange
  { top: '#10b981', side: '#047857', wall: '#065f46' }, // Emerald
  { top: '#eab308', side: '#a16207', wall: '#854d0e' }, // Amber
  { top: '#8b5cf6', side: '#6d28d9', wall: '#5b21b6' }, // Purple
  { top: '#ec4899', side: '#be185d', wall: '#9d174d' }, // Pink
  { top: '#06b6d4', side: '#0e7490', wall: '#155e75' }, // Cyan
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

  const activeId = hoveredId || selectedId

  // Calculate sum of values
  const totalValue = useMemo(() => {
    return slices.reduce((acc, s) => acc + Math.max(0, s.value), 0)
  }, [slices])

  // Geometry configuration
  const cx = 240
  const cy = 135
  const rx = 175
  const ry = 95
  const depth = pieDepth

  // Process all slices with colors and percentages
  const allProcessedSlices = useMemo(() => {
    return slices.map((slice, index) => {
      const sliceVal = Math.max(0, slice.value)
      const percentage = totalValue > 0 ? (sliceVal / totalValue) * 100 : 0
      const colors = PALETTE_3D[index % PALETTE_3D.length]

      return {
        ...slice,
        index,
        percentage,
        topColor: slice.color || colors.top,
        sideColor: slice.colorSide || colors.side,
        wallColor: slice.colorWall || colors.wall,
      }
    })
  }, [slices, totalValue])

  // Filter only slices with non-zero values for rendering on 3D pie
  const nonZeroSlices = useMemo(() => {
    return allProcessedSlices.filter((s) => s.value > 0)
  }, [allProcessedSlices])

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

    // Normal Multi-Slice Case: Compute start and end angles
    let currentAngle = -Math.PI / 2 + 0.35 // Start at top with slight forward clockwise tilt

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

  if (slices.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center rounded-xl border border-line bg-ink-50/40 text-center p-4">
        <p className="text-sm text-muted">Belum ada data visualisasi untuk ditampilkan.</p>
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Title & Subtitle */}
      {title ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="font-display text-sm font-bold text-ink-900 sm:text-base">
              {title}
            </h4>
            {subtitle ? <p className="text-xs text-muted mt-0.5">{subtitle}</p> : null}
          </div>
          <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-[11px] font-semibold text-ink-700">
            Total: {totalValue.toLocaleString('id-ID')} {unitLabel}
          </span>
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] items-center gap-6 rounded-xl border border-line bg-gradient-to-b from-ink-50/50 via-white to-ink-50/30 p-4 sm:p-5 shadow-xs">
        {/* Left: 3D SVG Pie Chart Canvas */}
        <div className="relative flex items-center justify-center overflow-hidden min-h-[260px]">
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
          ) : (
            <svg
              viewBox="0 0 480 300"
              className="w-full max-w-[460px] h-auto select-none"
              style={{ filter: 'drop-shadow(0 14px 20px rgba(0, 0, 0, 0.12))' }}
            >
              <defs>
                {/* Radial gradient shadow underneath 3D pie */}
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

                // Explode offset along midAngle
                const explodeDist = isElevated && !slice.isFullCircle ? 16 : 0
                const ox = Math.cos(slice.midAngle) * explodeDist
                const oy = Math.sin(slice.midAngle) * explodeDist * 0.58

                const scx = cx + ox
                const scy = cy + oy

                // ========================================================
                // SPECIAL CASE: FULL 360-DEGREE PIE (100% SINGLE SLICE)
                // ========================================================
                if (slice.isFullCircle) {
                  // Front cylinder wall: from angle 0 (right) to PI (left)
                  const frontCylinderPath = `M ${scx + rx} ${scy} A ${rx} ${ry} 0 0 1 ${scx - rx} ${scy} L ${scx - rx} ${scy + depth} A ${rx} ${ry} 0 0 0 ${scx + rx} ${scy + depth} Z`

                  return (
                    <g
                      key={slice.id}
                      className="transition-all duration-300 cursor-pointer"
                      onMouseEnter={() => setHoveredId(slice.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      onClick={() => onSelectSlice?.(slice.id)}
                      role="button"
                      tabIndex={0}
                      aria-label={`${slice.label}: 100%`}
                    >
                      {/* Front 3D Cylinder Wall */}
                      <path d={frontCylinderPath} fill={slice.sideColor} />

                      {/* Top Full Ellipse */}
                      <ellipse
                        cx={scx}
                        cy={scy}
                        rx={rx}
                        ry={ry}
                        fill={slice.topColor}
                        stroke="rgba(255, 255, 255, 0.4)"
                        strokeWidth={1.5}
                      />

                      {/* Centered White Percentage Label */}
                      <text
                        x={scx}
                        y={scy + ry * 0.32}
                        fill="#ffffff"
                        textAnchor="middle"
                        className="font-display font-extrabold select-none pointer-events-none"
                        style={{
                          fontSize: '22px',
                          filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.6))',
                          fontWeight: 800,
                        }}
                      >
                        100%
                      </text>
                    </g>
                  )
                }

                // ========================================================
                // MULTI-SLICE WEDGE CASE
                // ========================================================
                const x1 = scx + rx * Math.cos(slice.startAngle)
                const y1 = scy + ry * Math.sin(slice.startAngle)
                const x2 = scx + rx * Math.cos(slice.endAngle)
                const y2 = scy + ry * Math.sin(slice.endAngle)

                const isLargeArc = slice.angleSweep > Math.PI ? 1 : 0

                // Top face wedge path
                const topPath = `M ${scx} ${scy} L ${x1} ${y1} A ${rx} ${ry} 0 ${isLargeArc} 1 ${x2} ${y2} Z`

                // Start radial cut wall quad
                const startWallPath = `M ${scx} ${scy} L ${x1} ${y1} L ${x1} ${y1 + depth} L ${scx} ${scy + depth} Z`

                // End radial cut wall quad
                const endWallPath = `M ${scx} ${scy} L ${x2} ${y2} L ${x2} ${y2 + depth} L ${scx} ${scy + depth} Z`

                // Outer curved cylinder rim:
                // Generate steps along the visible front-facing portion of the arc
                const steps = 20
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

                // Text label coordinates on top face
                const labelRadius = 0.62
                const lx = scx + rx * labelRadius * Math.cos(slice.midAngle)
                const ly = scy + ry * labelRadius * Math.sin(slice.midAngle)

                return (
                  <g
                    key={slice.id}
                    className="transition-all duration-300 cursor-pointer"
                    onMouseEnter={() => setHoveredId(slice.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={() => onSelectSlice?.(slice.id)}
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
                      stroke="rgba(255, 255, 255, 0.4)"
                      strokeWidth={isElevated ? 2 : 1}
                      className="transition-transform duration-300"
                    />

                    {/* Bold White Percentage Label on Top Face */}
                    {slice.percentage >= 4 ? (
                      <text
                        x={lx}
                        y={ly + 4}
                        fill="#ffffff"
                        textAnchor="middle"
                        className="font-display font-extrabold select-none pointer-events-none"
                        style={{
                          fontSize: slice.percentage >= 15 ? '16px' : '13px',
                          filter: 'drop-shadow(0 2px 3px rgba(0, 0, 0, 0.55))',
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
          )}

          {/* Floating Hover Badge */}
          {activeId && totalValue > 0 ? (
            <div className="absolute top-2 left-2 rounded-lg bg-ink-900/90 backdrop-blur-xs text-white px-3 py-1.5 text-xs shadow-md pointer-events-none">
              {(() => {
                const target = allProcessedSlices.find((s) => s.id === activeId)
                if (!target) return null
                const pct = totalValue > 0 ? ((target.value / totalValue) * 100).toFixed(1) : '0'
                return (
                  <div>
                    <span className="font-bold">{target.label}</span>
                    <span className="ml-1.5 text-amber-300 font-extrabold">
                      {target.value.toLocaleString('id-ID')} {unitLabel} ({pct}%)
                    </span>
                  </div>
                )
              })()}
            </div>
          ) : null}
        </div>

        {/* Right: Interactive Legend & Slice Breakdown */}
        <div className="space-y-2.5">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">
            Rincian & Filter Berdasarkan Daerah:
          </p>
          <div className="divide-y divide-line/70 max-h-64 overflow-y-auto pr-1">
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
                  className={`group flex w-full items-center justify-between gap-3 py-2.5 px-2 rounded-lg text-left transition ${
                    isSelected
                      ? 'bg-ink-100 text-ink-900 font-bold'
                      : isHovered
                        ? 'bg-ink-50 text-ink-900'
                        : 'hover:bg-ink-50/60 text-ink-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="size-3.5 rounded-sm shrink-0 shadow-xs"
                      style={{ backgroundColor: slice.topColor }}
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate group-hover:text-ume transition">
                        {slice.label}
                      </p>
                      {slice.sublabel ? (
                        <p className="text-[11px] text-muted truncate">{slice.sublabel}</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="num font-display font-bold text-sm tabular-nums text-ink-900">
                      {Math.round(slice.percentage)}%
                    </span>
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
