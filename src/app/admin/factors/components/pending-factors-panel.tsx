'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    Clock, CheckCircle2, XCircle, Code, ChevronDown, ChevronUp,
    Loader2, RefreshCw, TrendingUp, Target
} from 'lucide-react'

interface PendingFactor {
    id: string
    name: string
    key: string
    description: string
    bet_type: 'TOTALS' | 'SPREAD'
    stats_used: string[]
    formula: string
    direction: string
    betting_thesis: string
    edge_explanation: string
    confidence: string
    status: 'pending' | 'approved' | 'rejected' | 'implemented'
    ai_model: string
    proposed_at: string
}

export function PendingFactorsPanel() {
    const [factors, setFactors] = useState<PendingFactor[]>([])
    const [loading, setLoading] = useState(true)
    const [expandedFactors, setExpandedFactors] = useState<Set<string>>(new Set())
    const [statusFilter, setStatusFilter] = useState<string>('pending')
    const [updating, setUpdating] = useState<string | null>(null)

    const fetchFactors = async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/admin/factors/pending?status=${statusFilter}`)
            const data = await res.json()
            if (data.success) setFactors(data.factors)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { fetchFactors() }, [statusFilter])

    const updateStatus = async (id: string, status: string) => {
        setUpdating(id)
        try {
            await fetch('/api/admin/factors/pending', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, status })
            })
            fetchFactors()
        } finally {
            setUpdating(null)
        }
    }

    const toggleExpanded = (id: string) => {
        const next = new Set(expandedFactors)
        next.has(id) ? next.delete(id) : next.add(id)
        setExpandedFactors(next)
    }

    const statusBadge = (s: string) => {
        const colors: Record<string, string> = {
            pending: 'bg-yellow-500/20 text-yellow-400',
            approved: 'bg-blue-500/20 text-blue-400',
            rejected: 'bg-red-500/20 text-red-400',
            implemented: 'bg-green-500/20 text-green-400'
        }
        return <Badge className={colors[s] || ''}>{s}</Badge>
    }

    return (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Clock className="w-5 h-5 text-yellow-400" />
                        Pending Factors
                    </h2>
                    <p className="text-sm text-slate-400">AI-proposed factors awaiting implementation</p>
                </div>
                <div className="flex gap-2">
                    {['pending', 'approved', 'implemented', 'all'].map(s => (
                        <Button key={s} size="sm" variant={statusFilter === s ? 'default' : 'outline'}
                            onClick={() => setStatusFilter(s)} className={statusFilter === s ? 'bg-purple-600' : ''}>
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                        </Button>
                    ))}
                    <Button size="sm" variant="ghost" onClick={fetchFactors}>
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </div>

            {loading && !factors.length ? (
                <div className="text-center py-8"><Loader2 className="w-8 h-8 animate-spin mx-auto text-purple-400" /></div>
            ) : !factors.length ? (
                <div className="text-center py-8 text-slate-500">No {statusFilter === 'all' ? '' : statusFilter} factors</div>
            ) : (
                <div className="space-y-3">
                    {factors.map(f => {
                        const exp = expandedFactors.has(f.id)
                        return (
                            <div key={f.id} className="bg-slate-900/50 border border-slate-700 rounded-lg overflow-hidden">
                                <div className="p-4 cursor-pointer hover:bg-slate-800/50" onClick={() => toggleExpanded(f.id)}>
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                {f.bet_type === 'TOTALS' ? <TrendingUp className="w-4 h-4 text-green-400" /> : <Target className="w-4 h-4 text-amber-400" />}
                                                <span className="font-semibold text-white">{f.name}</span>
                                                <Badge variant="outline" className="text-xs text-slate-400">{f.key}</Badge>
                                                {statusBadge(f.status)}
                                            </div>
                                            <p className="text-sm text-slate-400 mt-1">{f.description}</p>
                                            <div className="flex gap-2 mt-2 flex-wrap">
                                                {f.stats_used.map(s => <Badge key={s} variant="outline" className="text-xs text-cyan-400 border-cyan-500/30">{s}</Badge>)}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-slate-500">{new Date(f.proposed_at).toLocaleDateString()}</span>
                                            {exp ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                                        </div>
                                    </div>
                                </div>
                                {exp && <FactorDetails f={f} updating={updating} updateStatus={updateStatus} />}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

function FactorDetails({ f, updating, updateStatus }: { f: PendingFactor, updating: string | null, updateStatus: (id: string, status: string) => void }) {
    return (
        <div className="px-4 pb-4 border-t border-slate-700/50 pt-4 space-y-3">
            <div><h4 className="text-xs font-semibold text-slate-500 uppercase mb-1">Formula</h4>
                <code className="text-sm text-cyan-400 bg-slate-900 px-2 py-1 rounded block">{f.formula}</code></div>
            <div><h4 className="text-xs font-semibold text-slate-500 uppercase mb-1">Betting Thesis</h4>
                <p className="text-sm text-slate-300">{f.betting_thesis}</p></div>
            <div><h4 className="text-xs font-semibold text-slate-500 uppercase mb-1">Market Edge</h4>
                <p className="text-sm text-slate-300">{f.edge_explanation}</p></div>
            <div className="text-xs text-slate-500">Direction: <span className="text-slate-300">{f.direction}</span> | Confidence: <span className="text-slate-300">{f.confidence}</span></div>
            {f.status === 'pending' && (
                <div className="flex gap-2 pt-2 border-t border-slate-700/50">
                    <Button size="sm" onClick={() => updateStatus(f.id, 'approved')} disabled={updating === f.id} className="bg-blue-600"><CheckCircle2 className="w-4 h-4 mr-1" />Approve</Button>
                    <Button size="sm" variant="outline" onClick={() => updateStatus(f.id, 'rejected')} disabled={updating === f.id} className="border-red-500/50 text-red-400"><XCircle className="w-4 h-4 mr-1" />Reject</Button>
                </div>
            )}
            {f.status === 'approved' && (
                <div className="flex gap-2 pt-2 border-t border-slate-700/50">
                    <Button size="sm" onClick={() => updateStatus(f.id, 'implemented')} disabled={updating === f.id} className="bg-green-600"><Code className="w-4 h-4 mr-1" />Mark Implemented</Button>
                </div>
            )}
        </div>
    )
}