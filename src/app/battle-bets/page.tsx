import Link from 'next/link'

export const metadata = {
  title: 'Battle Bets | DeepPick',
  description: 'Watch NBA betting battles come to life with castle defense gameplay',
}

export default function BattleBetsPage() {
  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-4 text-center">⚔️ Battle Bets Arena ⚔️</h1>
        <p className="text-xl text-center mb-8 text-gray-300">
          Castle Defense Betting Battles - Coming Soon!
        </p>
        
        <div className="bg-gray-800 rounded-lg p-8 border-2 border-yellow-500">
          <h2 className="text-2xl font-bold mb-4">🏰 What is Battle Bets?</h2>
          <p className="mb-4">
            Battle Bets transforms NBA betting into an epic castle defense game where:
          </p>
          <ul className="list-disc list-inside space-y-2 mb-6">
            <li>Each capper owns a persistent castle that evolves based on daily betting performance</li>
            <li>NBA stats (PTS, REB, AST, BLK, 3PT) become projectile attacks</li>
            <li>Defense dots protect your castle from incoming projectiles</li>
            <li>Special items like Fire Orb trigger bonus attacks</li>
            <li>Watch real NBA games play out as medieval siege battles</li>
          </ul>
          
          <div className="bg-gray-700 rounded p-4 mb-6">
            <h3 className="font-bold mb-2">🔥 Fire Orb Item System</h3>
            <p className="text-sm text-gray-300">
              When you lose all defense dots in a stat row, the Fire Orb activates and fires 5 bonus projectiles as a desperation attack!
            </p>
          </div>
          
          <div className="text-center">
            <p className="text-yellow-400 font-bold text-lg mb-4">
              🚧 Under Construction 🚧
            </p>
            <p className="text-gray-400 mb-6">
              The Battle Bets arena is currently being integrated into DeepPick. Check back soon!
            </p>

            {/* Test Game Button */}
            <Link
              href="/battle-bets-test"
              className="inline-block bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold py-3 px-8 rounded-lg text-lg transition-all duration-200 shadow-lg hover:shadow-xl border-2 border-purple-400"
            >
              🎮 Test Game Map
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

