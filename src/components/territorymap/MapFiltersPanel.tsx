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
    <div className="absolute top-4 left-4 bg-[#F4E8D0] border-2 border-[#3E2723] rounded-lg p-4 shadow-lg min-w-[250px]">
      <h3 className="text-sm font-bold text-[#3E2723] mb-3 border-b border-[#3E2723] pb-2">
        🎯 Filters
      </h3>

      <div className="space-y-4">
        {/* Time Period Filter */}
        <div>
          <label className="block text-xs font-semibold text-[#3E2723] mb-1">
            Time Period
          </label>
          <select
            value={filters.timePeriod}
            onChange={(e) => onFiltersChange({ ...filters, timePeriod: e.target.value as TimePeriod })}
            className="w-full px-3 py-2 bg-white border border-[#3E2723] rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
          >
            {timePeriods.map((period) => (
              <option key={period.value} value={period.value}>
                {period.label}
              </option>
            ))}
          </select>
        </div>

        {/* Capper Filter */}
        <div>
          <label className="block text-xs font-semibold text-[#3E2723] mb-1">
            Capper
          </label>
          <select
            value={filters.capper || 'All Cappers'}
            onChange={(e) => onFiltersChange({
              ...filters,
              capper: e.target.value === 'All Cappers' ? null : e.target.value
            })}
            className="w-full px-3 py-2 bg-white border border-[#3E2723] rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
          >
            {cappers.map((capper) => (
              <option key={capper} value={capper}>
                {capper}
              </option>
            ))}
          </select>
        </div>

        {/* Active Picks Only Toggle */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="active-picks-only"
            checked={filters.activePicksOnly}
            onChange={(e) => onFiltersChange({ ...filters, activePicksOnly: e.target.checked })}
            className="w-4 h-4 text-[#D4AF37] border-[#3E2723] rounded focus:ring-[#D4AF37]"
          />
          <label htmlFor="active-picks-only" className="text-xs font-semibold text-[#3E2723] cursor-pointer">
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
          className="w-full px-3 py-2 bg-[#3E2723] text-[#F4E8D0] text-sm font-semibold rounded hover:bg-[#5D4037] transition-colors"
        >
          Reset Filters
        </button>
      </div>
    </div>
  )
}

