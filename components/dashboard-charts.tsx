'use client'

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/primitives'
import { formatNumber } from '@/lib/utils'
import type { DashboardHistoryPoint, NamedCount } from '@/types'

/**
 * Graphiques du dashboard client.
 *
 * Choix de forme :
 *  - L'évolution est présentée en PETITS MULTIPLES, une série par graphique.
 *    Équipements (~1,3 M), locataires (~56 k) et utilisateurs (~260) n'ont pas
 *    d'ordre de grandeur commun : les superposer imposerait deux axes Y, ce
 *    qui rend les pentes incomparables. Chaque mesure garde donc son axe.
 *  - La répartition des équipements est un barres horizontales trié : les
 *    libellés de types sont longs et le classement est l'information.
 *
 * Couleurs : une seule série par graphique, donc l'identité est portée par le
 * titre et non par la couleur. Chaque graphique porte l'étiquette de sa
 * dernière valeur (lisibilité, et parade au contraste faible de l'aqua).
 */

const INK = {
  grid: '#e1e0d9',
  axis: '#898781',
  muted: '#898781',
  surface: '#ffffff',
}

const SERIES = {
  equipment: '#2a78d6', // slot 1 — bleu
  tenants: '#1baf7a', // slot 3 — aqua
  users: '#eb6834', // slot 2 — orange
}

function formatMonth(iso: string): string {
  const date = new Date(iso)
  return new Intl.DateTimeFormat('fr-FR', { month: 'short', year: '2-digit' }).format(
    date,
  )
}

function compact(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} M`
  if (Math.abs(value) >= 1_000) return `${Math.round(value / 1000)} k`
  return String(value)
}

export function DashboardCharts({
  history,
  equipmentByType,
}: {
  history: DashboardHistoryPoint[]
  equipmentByType: NamedCount[]
}) {
  const series = [
    { key: 'equipment' as const, label: 'Équipements', color: SERIES.equipment },
    { key: 'tenants' as const, label: 'Locataires', color: SERIES.tenants },
    { key: 'users' as const, label: 'Utilisateurs', color: SERIES.users },
  ].filter((s) => history.some((point) => point[s.key] !== null))

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {series.map((s) => (
          <TrendChart
            key={s.key}
            label={s.label}
            color={s.color}
            data={history.map((point) => ({
              date: point.date,
              value: point[s.key] ?? 0,
            }))}
          />
        ))}
      </div>

      {equipmentByType.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Équipements par type</CardTitle>
            <p className="text-xs text-muted-foreground">
              EQUIPEMENT ⋈ EQUIPEMENT_TYPE · actifs, hors système · 12 premiers
            </p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.max(240, equipmentByType.length * 30)}>
              <BarChart
                data={equipmentByType}
                layout="vertical"
                margin={{ top: 4, right: 56, bottom: 4, left: 4 }}
                barCategoryGap={2}
              >
                <CartesianGrid
                  horizontal={false}
                  stroke={INK.grid}
                  strokeDasharray="2 4"
                />
                <XAxis
                  type="number"
                  tickFormatter={compact}
                  tick={{ fill: INK.axis, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={190}
                  tick={{ fill: INK.axis, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(11,11,11,0.04)' }}
                  content={<ChartTooltip suffix="équipements" />}
                />
                <Bar
                  dataKey="value"
                  radius={[0, 4, 4, 0]}
                  isAnimationActive={false}
                  label={{
                    position: 'right',
                    formatter: (v: unknown) => formatNumber(Number(v)),
                    fill: INK.muted,
                    fontSize: 11,
                  }}
                >
                  {equipmentByType.map((entry) => (
                    <Cell key={entry.name} fill={SERIES.equipment} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

function TrendChart({
  label,
  color,
  data,
}: {
  label: string
  color: string
  data: { date: string; value: number }[]
}) {
  const last = data[data.length - 1]
  const first = data[0]
  const delta =
    first && last && first.value > 0
      ? ((last.value - first.value) / first.value) * 100
      : null

  const gradientId = `grad-${label.replace(/[^a-z]/gi, '')}`

  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-sm font-normal text-muted-foreground">
          {label}
        </CardTitle>
        <div className="flex items-baseline gap-2">
          {/* Étiquette directe de la dernière valeur : l'information ne
              dépend jamais de la seule couleur de la courbe. */}
          <span className="text-2xl font-semibold tracking-tight">
            {formatNumber(last?.value ?? 0)}
          </span>
          {delta !== null && Number.isFinite(delta) ? (
            <span className="text-xs text-muted-foreground">
              {delta >= 0 ? '+' : ''}
              {delta.toFixed(1)} % sur la période
            </span>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="pt-2">
        <ResponsiveContainer width="100%" height={140}>
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.18} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={INK.grid} strokeDasharray="2 4" />
            <XAxis
              dataKey="date"
              tickFormatter={formatMonth}
              tick={{ fill: INK.axis, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              minTickGap={24}
            />
            <YAxis
              tickFormatter={compact}
              tick={{ fill: INK.axis, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={40}
              domain={['dataMin', 'dataMax']}
            />
            <Tooltip content={<ChartTooltip suffix={label.toLowerCase()} />} />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: INK.surface }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

interface TooltipPayload {
  value?: number
  payload?: { date?: string; name?: string }
}

function ChartTooltip({
  active,
  payload,
  label,
  suffix,
}: {
  active?: boolean
  payload?: TooltipPayload[]
  label?: string | number
  suffix?: string
}) {
  if (!active || !payload?.length) return null

  const entry = payload[0]
  const heading = entry.payload?.date
    ? formatMonth(entry.payload.date)
    : (entry.payload?.name ?? String(label ?? ''))

  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-foreground">{heading}</p>
      <p className="mt-0.5 tabular-nums text-muted-foreground">
        {formatNumber(entry.value ?? 0)} {suffix}
      </p>
    </div>
  )
}
