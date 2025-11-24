/**
 * Battle Bets V3 - Multi-Battle Arena
 * Displays 4 live battles with real-time data from API
 */

import { useEffect, useState } from 'react';
import { useMultiGameStore } from './store/multiGameStore';
import { GameErrorBoundary } from './components/ErrorBoundary';
import { BattleCanvas } from './components/game/BattleCanvas';
import { GameInfoBar } from './components/game/GameInfoBar';
import { InventoryBar } from './components/game/InventoryBar';
import { CopyDebugButton } from './components/debug/CopyDebugButton';
import { QuarterDebugControls } from './components/debug/QuarterDebugControls';
import { debugLogger } from './game/debug/DebugLogger';
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
  left_hp?: number;
  right_hp?: number;
  spread: number;
  status: string;
  created_at: string;
  game_start_time?: string;
  q1_end_time?: string;
  q2_end_time?: string;
  halftime_end_time?: string;
  q3_end_time?: string;
  q4_end_time?: string;
  winner?: 'left' | 'right' | null;
  game?: {
    home_team?: { name: string; abbreviation: string };
    away_team?: { name: string; abbreviation: string };
    game_date?: string;
  };
  left_capper?: {
    id: string;
    name: string;
    displayName: string;
    colorTheme?: string;
    teamPerformance?: {
      team: string;
      netUnits: number;
      wins: number;
      losses: number;
      pushes: number;
      totalPicks: number;
      winRate: number;
      defenseDots: {
        pts: number;
        reb: number;
        ast: number;
        blk: number;
        '3pt': number;
      };
    };
    overallPerformance?: {
      wins: number;
      losses: number;
      pushes: number;
      totalPicks: number;
      netUnits: number;
      winRate: number;
    };
  };
  right_capper?: {
    id: string;
    name: string;
    displayName: string;
    colorTheme?: string;
    teamPerformance?: {
      team: string;
      netUnits: number;
      wins: number;
      losses: number;
      pushes: number;
      totalPicks: number;
      winRate: number;
      defenseDots: {
        pts: number;
        reb: number;
        ast: number;
        blk: number;
        '3pt': number;
      };
    };
    overallPerformance?: {
      wins: number;
      losses: number;
      pushes: number;
      totalPicks: number;
      netUnits: number;
      winRate: number;
    };
  };
}

function App() {
  const [battles, setBattles] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalBattles, setTotalBattles] = useState(0);
  const [showDebugControls, setShowDebugControls] = useState(false);
  const battlesPerPage = 4;

  // Check URL parameters for specific battle ID and debug mode
  const urlParams = new URLSearchParams(window.location.search);
  const battleIdParam = urlParams.get('battleId');
  const debugMode = urlParams.get('debug') === '1';

  // Enable debug logger when debug mode is on
  useEffect(() => {
    if (debugMode) {
      debugLogger.enable();
      console.log('🔍 Debug Logger enabled - all logs will be captured');
    }
  }, [debugMode]);
  const showAllBattles = !battleIdParam; // If no battleId, show all battles

  // Fetch battles from API
  const fetchBattles = async () => {
    try {
      // If battleId is specified, fetch only that battle
      const url = battleIdParam
        ? `/api/battle-bets/${battleIdParam}`
        : `/api/battle-bets/active?page=${page}&limit=${battlesPerPage}`;

      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch battles');

      const data = await response.json();

      // Handle single battle vs multiple battles response
      const battlesArray = battleIdParam
        ? (data.battle ? [data.battle] : []) // Single battle endpoint returns { battle: {...} }
        : (data.battles || []); // Multiple battles endpoint returns { battles: [...] }

      // Convert API battles to Game format with full data
      const games: Game[] = battlesArray.map((battle: ApiBattle) => ({
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
          name: battle.left_capper?.displayName || battle.left_capper?.name || 'Unknown',
          favoriteTeam: {
            id: battle.left_team.toLowerCase(),
            name: battle.game?.away_team?.name || battle.left_team,
            abbreviation: battle.left_team,
            color: parseInt((battle.left_capper?.colorTheme || '#3b82f6').replace('#', ''), 16),
            colorHex: battle.left_capper?.colorTheme || '#3b82f6'
          },
          health: battle.left_hp || 100,
          maxHealth: 100,
          level: 1,
          experience: 0,
          leaderboardRank: 1,
          teamRecords: [
            {
              teamId: battle.left_team.toLowerCase(),
              units: battle.left_capper?.teamPerformance?.netUnits || 0,
              wins: battle.left_capper?.teamPerformance?.wins || 0,
              losses: battle.left_capper?.teamPerformance?.losses || 0,
              pushes: battle.left_capper?.teamPerformance?.pushes || 0
            }
          ],
          equippedItems: {
            slot1: null,
            slot2: null,
            slot3: null
          }
        },
        rightCapper: {
          id: battle.right_capper_id,
          name: battle.right_capper?.displayName || battle.right_capper?.name || 'Unknown',
          favoriteTeam: {
            id: battle.right_team.toLowerCase(),
            name: battle.game?.home_team?.name || battle.right_team,
            abbreviation: battle.right_team,
            color: parseInt((battle.right_capper?.colorTheme || '#ef4444').replace('#', ''), 16),
            colorHex: battle.right_capper?.colorTheme || '#ef4444'
          },
          health: battle.right_hp || 100,
          maxHealth: 100,
          level: 1,
          experience: 0,
          leaderboardRank: 2,
          teamRecords: [
            {
              teamId: battle.right_team.toLowerCase(),
              units: battle.right_capper?.teamPerformance?.netUnits || 0,
              wins: battle.right_capper?.teamPerformance?.wins || 0,
              losses: battle.right_capper?.teamPerformance?.losses || 0,
              pushes: battle.right_capper?.teamPerformance?.pushes || 0
            }
          ],
          equippedItems: {
            slot1: null,
            slot2: null,
            slot3: null
          }
        },
        currentQuarter: 0,
        spread: battle.spread,
        gameDate: battle.game?.game_date || '',
        gameTime: '',
        leftScore: 0,
        rightScore: 0,
        status: 'SCHEDULED',
        // Store battle timing data for overlay
        _battleData: {
          status: battle.status,
          gameStartTime: battle.game_start_time,
          q1EndTime: battle.q1_end_time,
          q2EndTime: battle.q2_end_time,
          halftimeEndTime: battle.halftime_end_time,
          q3EndTime: battle.q3_end_time,
          q4EndTime: battle.q4_end_time,
          winner: battle.winner
        }
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
      <main style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Battles Grid - Vertical Stack */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          {battles.map((game, index) => (
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
              {/* Game Info Bar - Horizontal bar with capper info, team names, spread, score */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  background: '#020617'
                }}
              >
                <GameInfoBar game={game} />
              </div>

              {/* Battle Game Layout - Inventory bars + PixiJS canvas, centered under info bar */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  padding: '10px 0 20px',
                  background: '#020617'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    width: '1300px',
                    maxWidth: '100%'
                  }}
                >
                  {/* Left Inventory Bar */}
                  <InventoryBar battleId={game.id} side="left" />

                  {/* Battle Canvas - PixiJS Game with Countdown Timers */}
                  <div
                    style={{
                      width: '1170px',
                      height: '200px',
                      background: '#0a0e1a',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center'
                    }}
                  >
                    <BattleCanvas
                      battleId={game.id}
                      game={game}
                      status={(game as any)._battleData?.status}
                      gameStartTime={(game as any)._battleData?.gameStartTime}
                      q1EndTime={(game as any)._battleData?.q1EndTime}
                      q2EndTime={(game as any)._battleData?.q2EndTime}
                      halftimeEndTime={(game as any)._battleData?.halftimeEndTime}
                      q3EndTime={(game as any)._battleData?.q3EndTime}
                      q4EndTime={(game as any)._battleData?.q4EndTime}
                      winner={(game as any)._battleData?.winner}
                      autoStart={index === 0 && showDebugControls}
                    />
                  </div>

                  {/* Right Inventory Bar */}
                  <InventoryBar battleId={game.id} side="right" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination - Only show when viewing all battles */}
        {showAllBattles && totalPages > 1 && (
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

      {/* Debug Toggle Button - Always visible */}
      <button
        onClick={() => setShowDebugControls(!showDebugControls)}
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          background: showDebugControls ? 'linear-gradient(135deg, #4ecdc4 0%, #44a8a0 100%)' : 'linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%)',
          color: '#fff',
          border: '2px solid #fff',
          borderRadius: '8px',
          padding: '10px 20px',
          fontSize: '14px',
          fontWeight: '700',
          cursor: 'pointer',
          zIndex: 10000,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
          transition: 'all 0.2s ease',
          textTransform: 'uppercase',
          letterSpacing: '1px',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.5)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.4)';
        }}
      >
        {showDebugControls ? '🐛 DEBUG ON' : '🐛 DEBUG'}
      </button>

      {/* Quarter Debug Controls - Show when debug is enabled, control first battle */}
      {showDebugControls && battles.length > 0 && (
        <QuarterDebugControls battleId={battles[0].id} />
      )}

      {/* Copy Debug Button - Only show when ?debug=1 */}
      {debugMode && battles.length > 0 && (
        <CopyDebugButton battleId={battles[0].id} />
      )}
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
