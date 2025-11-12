'use client'

export function MapLegend() {
  return (
    <div className="absolute bottom-32 right-4 bg-gradient-to-br from-slate-900 to-slate-800 border-2 border-amber-500 rounded-lg p-4 shadow-2xl max-w-xs max-h-[calc(100vh-28rem)] overflow-y-auto">
      <h3 className="text-sm font-bold text-amber-400 mb-3 border-b border-amber-500/30 pb-2 flex items-center gap-2">
        <span>🗺️</span>
        <span>Territory Legend</span>
      </h3>

      {/* Territory States */}
      <div className="space-y-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-400 to-slate-500 border-2 border-dashed border-slate-600 flex items-center justify-center">
            <span className="text-xs font-black text-slate-700">NYK</span>
          </div>
          <div className="text-xs">
            <div className="font-semibold text-slate-200">Unclaimed</div>
            <div className="text-slate-400">No positive units</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-white to-slate-100 border-2 border-[#552583] flex items-center justify-center shadow-md">
            <span className="text-xs font-black text-gray-900">LAL</span>
          </div>
          <div className="text-xs">
            <div className="font-semibold text-slate-200">Claimed</div>
            <div className="text-slate-400">Capper has positive units</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-white to-slate-100 border-2 border-amber-500 flex items-center justify-center shadow-lg ring-2 ring-amber-400/70">
            <span className="text-xs font-black text-gray-900">GSW</span>
            <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
              <span className="px-1.5 py-0.5 bg-red-600 text-white text-[9px] font-bold rounded-full animate-pulse">
                LIVE
              </span>
            </div>
          </div>
          <div className="text-xs">
            <div className="font-semibold text-slate-200">Active Pick</div>
            <div className="text-slate-400">Game today/upcoming</div>
          </div>
        </div>
      </div>

      {/* Territory Tiers */}
      <div className="border-t border-amber-500/30 pt-3 space-y-2">
        <div className="text-xs font-semibold text-amber-400 mb-2">Territory Strength</div>

        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-white to-slate-100 border-4 border-[#007A33] flex items-center justify-center relative shadow-lg">
            <span className="text-[10px] font-black">BOS</span>
            <div className="absolute -top-1.5 -right-1.5 text-base">👑</div>
          </div>
          <div className="text-xs text-slate-300">
            <span className="font-semibold text-amber-400">Dominant:</span> +20u or more
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-white to-slate-100 border-3 border-[#98002E] flex items-center justify-center relative shadow-md">
            <span className="text-[10px] font-black">MIA</span>
            <div className="absolute -top-1 -right-1 text-xs">🛡️</div>
          </div>
          <div className="text-xs text-slate-300">
            <span className="font-semibold text-blue-400">Strong:</span> +10 to +19.9u
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-white to-slate-100 border-2 border-[#00538C] flex items-center justify-center shadow-sm">
            <span className="text-[10px] font-black">DAL</span>
          </div>
          <div className="text-xs text-slate-300">
            <span className="font-semibold text-emerald-400">Weak:</span> +0.1 to +9.9u
          </div>
        </div>
      </div>
    </div>
  )
}

