/**
 * Battle Bets V3 - Multi-Battle Arena
 * Displays 4 live battles with real-time data from API
 */

import { useEffect, useState } from 'react';
import { useMultiGameStore } from './store/multiGameStore';
import { GameErrorBoundary } from './components/ErrorBoundary';
import type { Game } from './types/game';
import './App.css';

// API Battle response type
interface ApiBattle {
  id: string;
  game_id: string;
  left_capper_id: string;
  right_capper_id: string;
  left_team: string;
  right_team: string;
  spread: number;
  status: string;
  created_at: string;
  game?: {
    home_team?: { name: string; abbreviation: string };
    away_team?: { name: string; abbreviation: string };
    game_date?: string;
  };
  left_capper?: {
    display_name: string;
    colorTheme?: string;
  };
  right_capper?: {
    display_name: string;
    colorTheme?: string;
  };
}

function App() {
  const [battles, setBattles] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalBattles, setTotalBattles] = useState(0);
  const battlesPerPage = 4;

  // Fetch battles from API
  const fetchBattles = async () => {
    try {
      const response = await fetch(`/api/battle-bets?limit=${battlesPerPage}&offset=${(page - 1) * battlesPerPage}&status=active`);
      if (!response.ok) throw new Error('Failed to fetch battles');

      const data = await response.json();

      // Convert API battles to Game format
      const games: Game[] = data.battles.map((battle: ApiBattle) => ({
        id: battle.id,
        leftTeam: {
          id: battle.left_team.toLowerCase(),
          name: battle.game?.away_team?.name || battle.left_team,
          abbreviation: battle.left_team,
          color: parseInt((battle.left_capper?.colorTheme || '#3b82f6').replace('#', ''), 16),
          colorHex: battle.left_capper?.colorTheme || '#3b82f6'
        },
        rightTeam: {
          id: battle.right_team.toLowerCase(),
          name: battle.game?.home_team?.name || battle.right_team,
          abbreviation: battle.right_team,
          color: parseInt((battle.right_capper?.colorTheme || '#ef4444').replace('#', ''), 16),
          colorHex: battle.right_capper?.colorTheme || '#ef4444'
        },
        leftCapper: {
          id: battle.left_capper_id,
          name: battle.left_capper?.display_name || 'Unknown',
          rank: 'KNIGHT',
          level: 1
        },
        rightCapper: {
          id: battle.right_capper_id,
          name: battle.right_capper?.display_name || 'Unknown',
          rank: 'KNIGHT',
          level: 1
        },
        spread: battle.spread,
        status: battle.status as any,
        leftScore: 0,
        rightScore: 0
      }));

      setBattles(games);
      setTotalBattles(data.total || 0);
      setError(null);
    } catch (err) {
      console.error('Error fetching battles:', err);
      setError(err instanceof Error ? err.message : 'Failed to load battles');
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchBattles();
  }, [page]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchBattles();
    }, 30000);

    return () => clearInterval(interval);
  }, [page]);

  const totalPages = Math.ceil(totalBattles / battlesPerPage);

  if (loading && battles.length === 0) {
    return (
      <div className="app">
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          color: 'white',
          fontSize: '24px'
        }}>
          Loading battles...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app">
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          color: 'white',
          gap: '20px'
        }}>
          <div style={{ fontSize: '24px', color: '#ef4444' }}>Error loading battles</div>
          <div style={{ fontSize: '16px' }}>{error}</div>
          <button
            onClick={() => fetchBattles()}
            style={{
              padding: '10px 20px',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }



  return (
    <div className="app" style={{ background: '#0a0e1a', minHeight: '100vh', padding: '20px' }}>
      <header style={{
        textAlign: 'center',
        marginBottom: '30px',
        color: 'white'
      }}>
        <h1 style={{ fontSize: '36px', marginBottom: '10px' }}>⚔️ Battle Arena</h1>
        <p style={{ fontSize: '14px', color: '#94a3b8' }}>
          {totalBattles} Active Battle{totalBattles !== 1 ? 's' : ''} • Page {page} of {totalPages}
        </p>
        <p style={{ fontSize: '12px', color: '#64748b', marginTop: '5px' }}>
          Battles update automatically every 30 seconds<br />
          Quarter stats sync every 10 minutes via MySportsFeeds
        </p>
      </header>

      <main style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Battles Grid - Vertical Stack */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          {battles.map((game) => (
            <div
              key={game.id}
              style={{
                background: 'rgba(15, 23, 42, 0.9)',
                border: '2px solid rgba(139, 92, 246, 0.3)',
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
              }}
            >
              {/* Battle Info Header */}
              <div style={{
                padding: '15px 20px',
                background: 'rgba(139, 92, 246, 0.1)',
                borderBottom: '1px solid rgba(139, 92, 246, 0.2)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ color: 'white', fontSize: '16px', fontWeight: 'bold' }}>
                  {game.leftCapper.name} vs {game.rightCapper.name}
                </div>
                <div style={{ color: '#94a3b8', fontSize: '14px' }}>
                  {game.leftTeam.abbreviation} vs {game.rightTeam.abbreviation} • Spread: {game.spread > 0 ? '+' : ''}{game.spread}
                </div>
              </div>

              {/* Battle Canvas - This will be the PixiJS game */}
              <div style={{
                width: '100%',
                height: '400px',
                background: '#0a0e1a',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                color: 'white',
                fontSize: '18px'
              }}>
                Battle Canvas for {game.id} - Coming Next
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '10px',
            marginTop: '30px'
          }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{
                padding: '10px 20px',
                background: page === 1 ? '#374151' : '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: page === 1 ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              ← Previous
            </button>
            <div style={{
              padding: '10px 20px',
              background: '#1e293b',
              color: 'white',
              borderRadius: '8px',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center'
            }}>
              Page {page} of {totalPages}
            </div>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              style={{
                padding: '10px 20px',
                background: page === totalPages ? '#374151' : '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: page === totalPages ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              Next →
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

function AppWithErrorBoundary() {
  return (
    <GameErrorBoundary>
      <App />
    </GameErrorBoundary>
  );
}

export default AppWithErrorBoundary;
