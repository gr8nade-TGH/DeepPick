"use client"
import { useEffect, useState } from 'react'

export function SHIVAManagementInbox() {
  const [games, setGames] = useState<Array<{ id: string; label: string; state: string }>>([])
  useEffect(() => {
    // TODO: Fetch from internal Odds dashboard API; placeholder items
    setGames([
      { id: 'nba_2025_10_21_okc_hou', label: 'Rockets @ Thunder', state: 'NEW' },
    ])
  }, [])
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="font-bold text-white">Game Inbox</div>
        <div className="text-xs text-gray-300 font-semibold">NBA • SHIVA</div>
      </div>
      <ul className="divide-y divide-gray-700">
        {games.map((g) => (
          <li key={g.id} className="py-2 flex items-center justify-between">
            <span className="text-white font-semibold">{g.label}</span>
            <span className="text-xs bg-gray-800 text-white px-2 py-1 rounded border border-gray-600">{g.state}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}


