'use client'

export function MapLegend() {
  return (
    <div className="absolute bottom-4 right-4 bg-[#F4E8D0] border-2 border-[#3E2723] rounded-lg p-4 shadow-lg max-w-xs">
      <h3 className="text-sm font-bold text-[#3E2723] mb-3 border-b border-[#3E2723] pb-2">
        🗺️ Territory Legend
      </h3>

      {/* Territory States */}
      <div className="space-y-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-300 border-2 border-dashed border-gray-500 flex items-center justify-center">
            <span className="text-xs font-bold text-gray-500">NYK</span>
          </div>
          <div className="text-xs">
            <div className="font-semibold text-[#3E2723]">Unclaimed</div>
            <div className="text-gray-600">No positive units</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white border-2 border-[#3E2723] flex items-center justify-center">
            <span className="text-xs font-bold text-gray-900">LAL</span>
          </div>
          <div className="text-xs">
            <div className="font-semibold text-[#3E2723]">Claimed</div>
            <div className="text-gray-600">Capper has positive units</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-full bg-white border-2 border-[#D4AF37] flex items-center justify-center shadow-[0_0_20px_rgba(255,215,0,0.6)]">
            <span className="text-xs font-bold text-gray-900">GSW</span>
            <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
              <span className="px-1.5 py-0.5 bg-red-600 text-white text-[10px] font-bold rounded-full">
                LIVE
              </span>
            </div>
          </div>
          <div className="text-xs">
            <div className="font-semibold text-[#3E2723]">Active Pick</div>
            <div className="text-gray-600">Game today/upcoming</div>
          </div>
        </div>
      </div>

      {/* Territory Tiers */}
      <div className="border-t border-[#3E2723] pt-3 space-y-2">
        <div className="text-xs font-semibold text-[#3E2723] mb-2">Territory Strength</div>
        
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-white border-4 border-[#3E2723] flex items-center justify-center relative">
            <span className="text-[10px] font-bold">BOS</span>
            <div className="absolute -top-1 -right-1 text-sm">👑</div>
          </div>
          <div className="text-xs text-gray-700">
            <span className="font-semibold">Dominant:</span> +20u or more
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-white border-3 border-[#3E2723] flex items-center justify-center">
            <span className="text-[10px] font-bold">MIA</span>
          </div>
          <div className="text-xs text-gray-700">
            <span className="font-semibold">Strong:</span> +10 to +19.9u
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-white border-2 border-[#3E2723] flex items-center justify-center">
            <span className="text-[10px] font-bold">DAL</span>
          </div>
          <div className="text-xs text-gray-700">
            <span className="font-semibold">Weak:</span> +0.1 to +9.9u
          </div>
        </div>
      </div>
    </div>
  )
}

