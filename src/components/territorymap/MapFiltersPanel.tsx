'use client'

import { MapFilters, TimePeriod, TerritoryData } from './types'

interface MapFiltersPanelProps {
  filters: MapFilters
  onFiltersChange: (filters: MapFilters) => void
  territories: TerritoryData[]
}

export function MapFiltersPanel({ filters, onFiltersChange, territories }: MapFiltersPanelProps) {
  const timePeriods: { value: TimePeriod; label: string }[] = [
    { value: 'all-time', label: 'All-Time' },
    { value: 'current-season', label: 'Current Season' },
    { value: 'last-30-days', label: 'Last 30 Days' },
    { value: 'last-7-days', label: 'Last 7 Days' },
  ]

  // Get unique cappers from territories
  const uniqueCappers = Array.from(
    new Set(
      territories
        .filter(t => t.state === 'claimed' && t.capperUsername)
        .map(t => t.capperUsername!)
    )
  ).sort()

  const cappers = ['All Cappers', ...uniqueCappers]

  return (
    <div className="absolute top-4 left-4 bg-gradient-to-br from-slate-900 to-slate-800 border-2 border-amber-500 rounded-lg p-4 shadow-2xl min-w-[250px]">
      <h3 className="text-sm font-bold text-amber-400 mb-3 border-b border-amber-500/30 pb-2 flex items-center gap-2">
        <span>🎯</span>
        <span>Filters</span>
      </h3>

      <div className="space-y-4">
        {/* Time Period Filter */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Time Period
          </label>
          <select
            value={filters.timePeriod}
            onChange={(e) => onFiltersChange({ ...filters, timePeriod: e.target.value as TimePeriod })}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
          >
            {timePeriods.map((period) => (
              <option key={period.value} value={period.value} className="bg-slate-700">
                {period.label}
              </option>
            ))}
          </select>
        </div>

        {/* Capper Filter */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Capper
          </label>
          <select
            value={filters.capper || 'All Cappers'}
            onChange={(e) => onFiltersChange({
              ...filters,
              capper: e.target.value === 'All Cappers' ? null : e.target.value
            })}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
          >
            {cappers.map((capper) => (
              <option key={capper} value={capper} className="bg-slate-700">
                {capper}
              </option>
            ))}
          </select>
        </div>

        {/* Active Picks Only Toggle */}
        <div className="flex items-center gap-2 p-2 rounded-md hover:bg-slate-700/50 transition-colors">
          <input
            type="checkbox"
            id="active-picks-only"
            checked={filters.activePicksOnly}
            onChange={(e) => onFiltersChange({ ...filters, activePicksOnly: e.target.checked })}
            className="w-4 h-4 text-amber-500 bg-slate-700 border-slate-600 rounded focus:ring-amber-500 focus:ring-2"
          />
          <label htmlFor="active-picks-only" className="text-xs font-semibold text-slate-300 cursor-pointer flex-1">
            Active Picks Only
          </label>
        </div>

        {/* Reset Button */}
        <button
          onClick={() => onFiltersChange({
            timePeriod: 'all-time',
            capper: null,
            activePicksOnly: false
          })}
          className="w-full px-3 py-2.5 bg-gradient-to-r from-slate-700 to-slate-600 hover:from-slate-600 hover:to-slate-500 text-amber-400 text-sm font-semibold rounded-md transition-all duration-200 border border-slate-600 hover:border-amber-500/50 shadow-md hover:shadow-lg"
        >
          Reset Filters
        </button>
      </div>
    </div>
  )
}

