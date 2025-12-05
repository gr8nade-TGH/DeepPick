'use client'

import { getRarityStyleFromTier, type RarityTier } from '@/lib/tier-grading'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export interface TierSquareProps {
    tier: RarityTier
    size?: 'xs' | 'sm' | 'md' | 'lg'
    onClick?: () => void
    // Optional tooltip content
    capperName?: string
    selection?: string
    units?: number
    isSystemPick?: boolean
    capperRecord?: { wins: number; losses: number; netUnits: number }
    // For status display (won/lost/pending)
    status?: 'won' | 'lost' | 'pending' | 'push'
    // For live game indicator
    isLive?: boolean
    showTooltip?: boolean
}

const SIZE_CLASSES = {
    xs: 'w-4 h-4',
    sm: 'w-5 h-5',
    md: 'w-6 h-6',
    lg: 'w-7 h-7'
}

export function TierSquare({
    tier,
    size = 'md',
    onClick,
    capperName,
    selection,
    units,
    isSystemPick,
    capperRecord,
    status,
    isLive = false,
    showTooltip = true
}: TierSquareProps) {
    const rarity = getRarityStyleFromTier(tier)
    const sizeClass = SIZE_CLASSES[size]

    // Adjust styling based on status
    const getStyle = () => {
        const baseStyle = {
            background: `linear-gradient(135deg, ${rarity.borderColor}40, ${rarity.borderColor}20)`,
            border: `2px solid ${rarity.borderColor}`,
            boxShadow: `0 0 8px ${rarity.glowColor}`
        }

        if (status === 'won') {
            return { ...baseStyle, boxShadow: `0 0 8px rgba(16, 185, 129, 0.5)` }
        }
        if (status === 'lost') {
            return { ...baseStyle, opacity: 0.6, boxShadow: 'none' }
        }
        return baseStyle
    }

    const square = (
        <button
            onClick={onClick}
            className={`${sizeClass} rounded cursor-pointer transition-all hover:scale-125 flex items-center justify-center relative ${isLive ? 'animate-pulse' : ''}`}
            style={getStyle()}
        >
            {/* Status indicator for resolved picks */}
            {status === 'won' && (
                <span className="text-emerald-400 text-[8px] font-bold">✓</span>
            )}
            {status === 'lost' && (
                <span className="text-red-400 text-[8px] font-bold">✗</span>
            )}
            {/* Source indicator dot */}
            {isSystemPick !== undefined && (
                <span
                    className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${isSystemPick ? 'bg-cyan-400' : 'bg-purple-400'}`}
                    style={{ boxShadow: isSystemPick ? '0 0 3px rgba(34,211,238,0.8)' : '0 0 3px rgba(192,132,252,0.8)' }}
                />
            )}
        </button>
    )

    if (!showTooltip || (!capperName && !selection)) {
        return square
    }

    return (
        <Tooltip>
            <TooltipTrigger asChild>{square}</TooltipTrigger>
            <TooltipContent side="top" className="p-0 border-0 bg-transparent z-[100]">
                <div
                    className="rounded-lg p-2.5 max-w-xs"
                    style={{
                        background: `linear-gradient(135deg, rgba(15,15,25,0.98), rgba(25,25,40,0.98))`,
                        border: `2px solid ${rarity.borderColor}`,
                        boxShadow: `0 0 15px ${rarity.glowColor}`
                    }}
                >
                    <div className="space-y-1.5">
                        {/* Tier badge + Source */}
                        <div className="flex items-center gap-2">
                            <span
                                className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                                style={{
                                    background: `linear-gradient(135deg, ${rarity.borderColor}40, ${rarity.borderColor}20)`,
                                    color: rarity.borderColor,
                                    border: `1px solid ${rarity.borderColor}60`
                                }}
                            >
                                {rarity.icon} {tier.toUpperCase()}
                            </span>
                            {isSystemPick !== undefined && (
                                <span className={`text-[9px] px-1.5 py-0.5 rounded ${isSystemPick
                                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                                    : 'bg-purple-500/20 text-purple-400 border border-purple-500/40'}`}>
                                    {isSystemPick ? '🤖 AI' : '👤 Manual'}
                                </span>
                            )}
                        </div>

                        {/* Capper name + units */}
                        {capperName && (
                            <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-semibold text-amber-400 uppercase">{capperName}</span>
                                {units !== undefined && <span className="text-[10px] text-slate-400">{units}u</span>}
                            </div>
                        )}

                        {/* Selection */}
                        {selection && <div className="text-xs font-bold text-white">{selection}</div>}

                        {/* Capper record */}
                        {capperRecord && (
                            <div className="flex items-center gap-2 pt-1 border-t border-slate-700">
                                <span className="text-[9px] text-slate-400">Record:</span>
                                <span className="text-[10px] text-white font-semibold">
                                    {capperRecord.wins}-{capperRecord.losses}
                                </span>
                                <span className={`text-[10px] font-semibold ${capperRecord.netUnits >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {capperRecord.netUnits >= 0 ? '+' : ''}{capperRecord.netUnits.toFixed(1)}u
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </TooltipContent>
        </Tooltip>
    )
}

