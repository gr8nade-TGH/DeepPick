/**
 * Battle Arena V2 - Tabbed Interface Test Page
 * NEW: Tab filtering (ALL, LIVE, UPCOMING, FINAL)
 * NEW: Pick-based battle selection with chips
 * Reuses all existing battle components without modification
 */

import { useEffect, useState, useMemo } from 'react';
import { useMultiGameStore } from './store/multiGameStore';
import { GameErrorBoundary } from './components/ErrorBoundary';
import { BattleCanvas } from './components/game/BattleCanvas';
import { GameInfoBar } from './components/game/GameInfoBar';
import { InventoryBar } from './components/game/InventoryBar';
import { DebugBottomBar } from './components/debug/DebugBottomBar';
import { PreGameItemSelector } from './components/debug/PreGameItemSelector';
import { InventoryModal } from './components/inventory';
import { debugLogger } from './game/debug/DebugLogger';
import { addTestItemsToInventory } from './utils/testInventory';
import { useInventoryStore } from './store/inventoryStore';
import { PickSelectorBar } from './components/picks';
import { useUserPicks, usePickBattles } from './hooks';
import { usePickBattleStore, usePickTabCounts } from './store/pickBattleStore';
import type { Game, GameStatus } from './types/game';
import type { PickStatus } from './types/picks';
import './App.css';

// Map battle status from API to GameStatus format
function mapBattleStatusToGameStatus(status: string): GameStatus {
  switch (status) {
    case 'SCHEDULED':
      return 'SCHEDULED';
    case 'Q1_IN_PROGRESS':
    case 'Q1_BATTLE':
      return '1Q';
    case 'Q2_IN_PROGRESS':
    case 'Q2_BATTLE':
    case 'HALFTIME':
      return '2Q';
    case 'Q3_IN_PROGRESS':
    case 'Q3_BATTLE':
      return '3Q';
    case 'Q4_IN_PROGRESS':
    case 'Q4_BATTLE':
      return '4Q';
    case 'OT1_IN_PROGRESS':
    case 'OT1_BATTLE':
      return 'OT';
    case 'OT2_IN_PROGRESS':
    case 'OT2_BATTLE':
      return 'OT2';
    case 'OT3_IN_PROGRESS':
    case 'OT3_BATTLE':
      return 'OT3';
    case 'OT4_IN_PROGRESS':
    case 'OT4_BATTLE':
      return 'OT4';
    case 'GAME_OVER':
      return 'FINAL';
    default:
      return 'SCHEDULED';
  }
}

// API Battle response type (same as original)
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
  left_capper?: any;
  right_capper?: any;
}

// Tab types
type TabType = 'ALL' | 'LIVE' | 'UPCOMING' | 'FINAL' | 'TRAINING_GROUNDS';

// Battle status categories
function getBattleCategory(status: string): TabType {
  if (status === 'SCHEDULED') return 'UPCOMING';
  if (status === 'GAME_OVER') return 'FINAL';
  // All IN_PROGRESS, BATTLE, HALFTIME states are LIVE
  return 'LIVE';
}

// Helper function to generate test battles
function generateTestBattles(): ApiBattle[] {
  return [
    {
      id: 'test-battle-1',
      game_id: 'test-game-1',
      left_capper_id: 'test-capper-1',
      right_capper_id: 'test-capper-2',
      left_team: 'LAL',
      right_team: 'MEM',
      left_hp: 100,
      right_hp: 100,
      spread: -4.5,
      status: 'SCHEDULED', // Start as UPCOMING so items can be equipped
      created_at: new Date().toISOString(),
      game_start_time: new Date(Date.now() + 3600000).toISOString(), // 1 hour in future
      left_capper: {
        id: 'test-capper-1',
        name: 'Test Capper 1',
        displayName: 'TEST CAPPER 1',
        colorTheme: '#552583',
        // 15 units = 5 extra defense dots (3:1 ratio)
        units: 15
      },
      right_capper: {
        id: 'test-capper-2',
        name: 'Test Capper 2',
        displayName: 'TEST CAPPER 2',
        colorTheme: '#5D76A9',
        // 9 units = 3 extra defense dots (3:1 ratio)
        units: 9
      }
    },
    {
      id: 'test-battle-2',
      game_id: 'test-game-2',
      left_capper_id: 'test-capper-3',
      right_capper_id: 'test-capper-4',
      left_team: 'BOS',
      right_team: 'GSW',
      left_hp: 100,
      right_hp: 100,
      spread: -2.5,
      status: 'SCHEDULED', // Start as UPCOMING so items can be equipped
      created_at: new Date().toISOString(),
      game_start_time: new Date(Date.now() + 7200000).toISOString(), // 2 hours in future
      left_capper: {
        id: 'test-capper-3',
        name: 'Test Capper 3',
        displayName: 'TEST CAPPER 3',
        colorTheme: '#007A33',
        // 21 units = 7 extra defense dots (3:1 ratio)
        units: 21
      },
      right_capper: {
        id: 'test-capper-4',
        name: 'Test Capper 4',
        displayName: 'TEST CAPPER 4',
        colorTheme: '#1D428A',
        // 6 units = 2 extra defense dots (3:1 ratio)
        units: 6
      }
    }
  ];
}

// Helper function to transform API battle to Game format
function transformApiBattleToGame(battle: ApiBattle): Game {
  return {
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
      // Use units from API to create teamRecords for defense dot calculation
      teamRecords: battle.left_capper?.units ? [
        { teamId: battle.left_team.toLowerCase(), units: battle.left_capper.units, wins: 0, losses: 0, pushes: 0 }
      ] : [],
      equippedItems: { slot1: null, slot2: null, slot3: null }
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
      // Use units from API to create teamRecords for defense dot calculation
      teamRecords: battle.right_capper?.units ? [
        { teamId: battle.right_team.toLowerCase(), units: battle.right_capper.units, wins: 0, losses: 0, pushes: 0 }
      ] : [],
      equippedItems: { slot1: null, slot2: null, slot3: null }
    },
    currentQuarter: 0,
    spread: battle.spread,
    gameDate: battle.game?.game_date || '',
    gameTime: '',
    leftScore: 0,
    rightScore: 0,
    status: mapBattleStatusToGameStatus(battle.status),
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
  };
}

function AppV2() {
  const [battles, setBattles] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ battleId: string; side: 'left' | 'right'; slot: number } | null>(null);
  const [selectedCastleSlot, setSelectedCastleSlot] = useState<{ battleId: string; side: 'left' | 'right' } | null>(null);
  const [showDebugControls, setShowDebugControls] = useState(false);
  const [showInventory, setShowInventory] = useState(false);
  const [usePickMode, setUsePickMode] = useState(false); // Toggle between old/new mode

  // Tab state - now synced with pick store
  const [activeTab, setActiveTab] = useState<TabType>('ALL');

  // Inventory store
  const inventoryItems = useInventoryStore((state) => state.items);

  // Pick-based battle selection (NEW)
  const { setActiveFilter } = usePickBattleStore();
  const pickTabCounts = usePickTabCounts();
  const { battle1Game, battle2Game, hasBattles } = usePickBattles();

  // Initialize user picks fetching
  useUserPicks({ autoRefresh: true, refreshInterval: 30000 });

  // Sync tab changes with pick store
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    // Map TabType to PickStatus for the store
    if (tab === 'ALL') {
      setActiveFilter('all');
    } else if (tab === 'LIVE') {
      setActiveFilter('live');
    } else if (tab === 'UPCOMING') {
      setActiveFilter('upcoming');
    } else if (tab === 'FINAL') {
      setActiveFilter('final');
    }
    // TRAINING_GROUNDS doesn't affect pick filter
  };

  // Check URL params for debug, testMode, and pickMode
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const debug = params.get('debug') === '1';
    const testMode = params.get('testMode') === '1';
    const pickMode = params.get('pickMode') === '1';

    setShowDebugControls(debug);
    setUsePickMode(pickMode);

    if (testMode) {
      console.log('🧪 [AppV2] Test mode enabled - using fake battles');
      debugLogger.log('Test mode enabled');

      // Add test items to inventory if empty
      if (inventoryItems.length === 0) {
        console.log('📦 [AppV2] Adding test items to inventory');
        addTestItemsToInventory();
      }
    }

    if (pickMode) {
      console.log('🎯 [AppV2] Pick mode enabled - using pick-based battle selection');
    }
  }, []);

  // Fetch battles from API
  const fetchBattles = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams(window.location.search);
      const testMode = params.get('testMode') === '1';

      let apiBattles: ApiBattle[] = [];

      if (testMode) {
        // Use fake test battles
        apiBattles = generateTestBattles();
      } else {
        // Fetch real battles from API (use correct endpoint)
        const response = await fetch('/api/battle-bets/active?limit=20');
        if (!response.ok) {
          throw new Error(`Failed to fetch battles: ${response.statusText}`);
        }
        const data = await response.json();
        apiBattles = data.battles || [];
      }

      // Transform API battles to Game format (same as original App.tsx)
      const transformedBattles: Game[] = apiBattles.map((battle) => transformApiBattleToGame(battle));

      setBattles(transformedBattles);
      setLoading(false);
    } catch (err) {
      console.error('[AppV2] Error fetching battles:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBattles();
  }, []);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchBattles();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Sync battle status from store to battles array
  // This ensures tab filtering works when Force Q1 updates the store
  useEffect(() => {
    const interval = setInterval(() => {
      setBattles(prevBattles => {
        return prevBattles.map(battle => {
          const storeBattle = useMultiGameStore.getState().getBattle(battle.id);
          if (!storeBattle) return battle;

          // Use battleStatus from store (SCHEDULED, Q1_IN_PROGRESS, Q1_BATTLE, etc.)
          const storeBattleStatus = storeBattle.battleStatus || 'SCHEDULED';
          const currentStatus = (battle as any)._battleData?.status;

          // Update battle data if status changed
          if (storeBattleStatus !== currentStatus) {
            return {
              ...battle,
              status: storeBattle.game.status,
              _battleData: {
                ...(battle as any)._battleData,
                status: storeBattleStatus
              }
            };
          }

          return battle;
        });
      });

    }, 500); // Check every 500ms

    return () => clearInterval(interval);
  }, []);

  // Filter battles by active tab
  // TRAINING_GROUNDS shows the same battles (test battles) - no separate array needed
  // This avoids PixiJS destroy/recreate issues when switching tabs
  const filteredBattles = useMemo(() => {
    if (activeTab === 'TRAINING_GROUNDS') return battles; // Same battles, just a different tab view
    if (activeTab === 'ALL') return battles;

    return battles.filter(battle => {
      const battleData = (battle as any)._battleData;
      const status = battleData?.status || 'scheduled';
      const category = getBattleCategory(status);
      return category === activeTab;
    });
  }, [battles, activeTab]);

  // Calculate tab counts
  const tabCounts = useMemo(() => {
    const counts: Record<TabType, number> = {
      ALL: battles.length,
      LIVE: 0,
      UPCOMING: 0,
      FINAL: 0,
      TRAINING_GROUNDS: battles.length // Same count as ALL for now
    };

    battles.forEach(battle => {
      const battleData = (battle as any)._battleData;
      const status = battleData?.status || 'scheduled';
      const category = getBattleCategory(status);
      if (category !== 'TRAINING_GROUNDS') {
        counts[category]++;
      }
    });

    return counts;
  }, [battles]);

  // NEW: Auto-switch to LIVE tab when battles start
  useEffect(() => {
    if (tabCounts.LIVE > 0 && activeTab === 'UPCOMING') {
      setActiveTab('LIVE');
      console.log('🔴 [AppV2] Auto-switched to LIVE tab - battle started!');
    }
  }, [tabCounts.LIVE]);

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
        {/* NEW: Tab Navigation with Inventory Button */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '30px',
          borderBottom: '2px solid rgba(139, 92, 246, 0.2)',
          paddingBottom: '10px'
        }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: '10px' }}>
            {(['ALL', 'LIVE', 'UPCOMING', 'FINAL'] as TabType[]).map(tab => {
              const isActive = activeTab === tab;
              // Use pick counts when in pick mode, otherwise use battle counts
              const count = usePickMode
                ? (tab === 'ALL' ? pickTabCounts.all :
                  tab === 'LIVE' ? pickTabCounts.live :
                    tab === 'UPCOMING' ? pickTabCounts.upcoming :
                      tab === 'FINAL' ? pickTabCounts.final : 0)
                : tabCounts[tab];
              const isLive = tab === 'LIVE' && count > 0;

              return (
                <button
                  key={tab}
                  onClick={() => handleTabChange(tab)}
                  style={{
                    padding: '12px 24px',
                    background: isActive ? 'rgba(139, 92, 246, 0.3)' : 'rgba(15, 23, 42, 0.6)',
                    border: isActive ? '2px solid rgba(139, 92, 246, 0.8)' : '2px solid rgba(139, 92, 246, 0.2)',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '16px',
                    fontWeight: isActive ? 'bold' : 'normal',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  {/* Live indicator dot */}
                  {isLive && (
                    <span style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: '#ef4444',
                      animation: 'pulse 2s infinite',
                      boxShadow: '0 0 8px #ef4444'
                    }} />
                  )}

                  {tab}

                  {/* Count badge */}
                  <span style={{
                    background: isActive ? 'rgba(139, 92, 246, 0.8)' : 'rgba(139, 92, 246, 0.4)',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '14px',
                    fontWeight: 'bold'
                  }}>
                    {count}
                  </span>
                </button>
              );
            })}

            {/* Training Grounds Tab - Special styling (muted/outline) */}
            <button
              onClick={() => setActiveTab('TRAINING_GROUNDS')}
              style={{
                padding: '12px 24px',
                background: activeTab === 'TRAINING_GROUNDS' ? 'rgba(75, 85, 99, 0.3)' : 'transparent',
                border: activeTab === 'TRAINING_GROUNDS' ? '2px solid rgba(156, 163, 175, 0.8)' : '2px solid rgba(107, 114, 128, 0.4)',
                borderRadius: '8px',
                color: activeTab === 'TRAINING_GROUNDS' ? 'white' : 'rgba(156, 163, 175, 0.9)',
                fontSize: '14px',
                fontWeight: activeTab === 'TRAINING_GROUNDS' ? 'bold' : 'normal',
                cursor: 'pointer',
                transition: 'all 0.2s',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}
            >
              TRAINING GROUNDS
            </button>
          </div>

          {/* Inventory Button */}
          <button
            onClick={() => setShowInventory(true)}
            style={{
              padding: '12px 24px',
              background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
              border: '2px solid #f59e0b',
              borderRadius: '8px',
              color: 'white',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 0 15px rgba(245, 158, 11, 0.3)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 0 25px rgba(245, 158, 11, 0.5)';
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 0 15px rgba(245, 158, 11, 0.3)';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            📦 Inventory
            <span style={{
              background: 'rgba(0, 0, 0, 0.3)',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '14px',
            }}>
              {inventoryItems.length}
            </span>
          </button>
        </div>

        {/* Pick Selector Bar (NEW - only in pick mode) */}
        {usePickMode && activeTab !== 'TRAINING_GROUNDS' && (
          <PickSelectorBar />
        )}

        {/* Empty state */}
        {((usePickMode && !hasBattles) || (!usePickMode && filteredBattles.length === 0)) && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '60px 20px',
            color: 'rgba(255, 255, 255, 0.6)',
            fontSize: '18px'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>⚔️</div>
            <div>No {activeTab.toLowerCase()} {usePickMode ? 'picks' : 'battles'}</div>
          </div>
        )}

        {/* Battles Grid - Vertical Stack */}
        {/* In pick mode: show selected picks as battles (max 2) */}
        {/* In normal mode: show all filtered battles */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          {(usePickMode ? [battle1Game, battle2Game].filter(Boolean) as Game[] : filteredBattles).map((game, index) => (
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
              {/* Game Info Bar */}
              <div style={{ display: 'flex', justifyContent: 'center', background: '#020617' }}>
                <GameInfoBar
                  game={game}
                  battleStatus={(game as any)._battleData?.status || 'SCHEDULED'}
                  gameStartTime={(game as any)._battleData?.gameStartTime}
                  q1EndTime={(game as any)._battleData?.q1EndTime}
                  q2EndTime={(game as any)._battleData?.q2EndTime}
                  q3EndTime={(game as any)._battleData?.q3EndTime}
                  q4EndTime={(game as any)._battleData?.q4EndTime}
                />
              </div>

              {/* Battle Game Layout */}
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '10px 0 20px',
                background: '#020617'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', width: '1300px', maxWidth: '100%' }}>
                  {/* Left Inventory Bar */}
                  <InventoryBar
                    battleId={game.id}
                    side="left"
                    onSlotClick={(side, slot) => {
                      setSelectedSlot({ battleId: game.id, side, slot });
                    }}
                    onCastleSlotClick={(side) => {
                      setSelectedCastleSlot({ battleId: game.id, side });
                    }}
                  />

                  {/* Battle Canvas */}
                  <div style={{ width: '1170px', height: '200px', background: '#0a0e1a', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
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
                      autoStart={false}
                    />
                  </div>

                  {/* Right Inventory Bar */}
                  <InventoryBar
                    battleId={game.id}
                    side="right"
                    onSlotClick={(side, slot) => {
                      setSelectedSlot({ battleId: game.id, side, slot });
                    }}
                    onCastleSlotClick={(side) => {
                      setSelectedCastleSlot({ battleId: game.id, side });
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Debug Bottom Bar - unified control bar for current battles */}
        {showDebugControls && (
          <DebugBottomBar battleIds={filteredBattles.map(b => b.id)} />
        )}

        {/* Pre-Game Item Selector Modal (same as original) */}
        {selectedSlot && (
          <PreGameItemSelector
            battleId={selectedSlot.battleId}
            initialSlot={{ side: selectedSlot.side, slot: selectedSlot.slot as 1 | 2 | 3 }}
            onItemsChanged={() => {
              // Items changed - keep popup open
            }}
            onClose={() => setSelectedSlot(null)}
          />
        )}

        {/* Castle Slot Selector Modal */}
        {selectedCastleSlot && (
          <PreGameItemSelector
            battleId={selectedCastleSlot.battleId}
            initialCastleSide={selectedCastleSlot.side}
            onItemsChanged={() => {
              // Castle changed - keep popup open
            }}
            onClose={() => setSelectedCastleSlot(null)}
          />
        )}

        {/* Inventory Modal */}
        <InventoryModal
          isOpen={showInventory}
          onClose={() => setShowInventory(false)}
        />
      </main>

      {/* Pulse animation for LIVE indicator */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

export default AppV2;
