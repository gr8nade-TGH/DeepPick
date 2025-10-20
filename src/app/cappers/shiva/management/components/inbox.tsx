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
        <div className="font-semibold">Game Inbox</div>
        <div className="text-xs text-gray-500">NBA • SHIVA</div>
      </div>
      <ul className="divide-y">
        {games.map((g) => (
          <li key={g.id} className="py-2 flex items-center justify-between">
            <span>{g.label}</span>
            <span className="text-xs bg-gray-100 px-2 py-1 rounded">{g.state}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}


