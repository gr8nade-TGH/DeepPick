/**
 * Pick Battle Store
 * 
 * Zustand store for managing pick-based battle selection.
 * Handles filtering, selection state, and synchronization with battles.
 */

import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import type {
  UserPick,
  PickStatus,
  PickBattleStore,
} from '../types/picks';
import {
  filterPicksByStatus,
  sortPicksByUnitRecord,
  getDefaultSelection,
  calculateNewSelection,
} from '../utils/pickUtils';

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState = {
  activeFilter: 'all' as PickStatus | 'all',
  battle1PickId: null as string | null,
  battle2PickId: null as string | null,
  picks: [] as UserPick[],
  filteredPicks: [] as UserPick[],
  isLoading: false,
  error: null as string | null,
};

// ============================================================================
// STORE CREATION
// ============================================================================

export const usePickBattleStore = create<PickBattleStore>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      // State
      ...initialState,

      // ========================================
      // ACTIONS
      // ========================================

      /**
       * Set the active filter and update selection
       */
      setActiveFilter: (filter: PickStatus | 'all') => {
        const { picks } = get();
        const filtered = filterPicksByStatus(picks, filter);
        const sorted = sortPicksByUnitRecord(filtered);
        const [battle1Id, battle2Id] = getDefaultSelection(sorted);

        set({
          activeFilter: filter,
          filteredPicks: sorted,
          battle1PickId: battle1Id,
          battle2PickId: battle2Id,
        });
      },

      /**
       * Select a pick (handles all selection logic)
       */
      selectPick: (pickId: string) => {
        const { battle1PickId, battle2PickId } = get();
        const [newBattle1Id, newBattle2Id] = calculateNewSelection(
          pickId,
          battle1PickId,
          battle2PickId
        );

        set({
          battle1PickId: newBattle1Id,
          battle2PickId: newBattle2Id,
        });
      },

      /**
       * Deselect a specific pick
       */
      deselectPick: (pickId: string) => {
        const { battle1PickId, battle2PickId } = get();

        if (pickId === battle1PickId) {
          // Promote Battle 2 to Battle 1
          set({
            battle1PickId: battle2PickId,
            battle2PickId: null,
          });
        } else if (pickId === battle2PickId) {
          set({ battle2PickId: null });
        }
      },

      /**
       * Set picks from API response
       */
      setPicks: (picks: UserPick[]) => {
        const { activeFilter } = get();
        const filtered = filterPicksByStatus(picks, activeFilter);
        const sorted = sortPicksByUnitRecord(filtered);
        const [battle1Id, battle2Id] = getDefaultSelection(sorted);

        set({
          picks,
          filteredPicks: sorted,
          battle1PickId: battle1Id,
          battle2PickId: battle2Id,
          isLoading: false,
          error: null,
        });
      },

      /**
       * Update a single pick (e.g., live score update)
       */
      updatePick: (pickId: string, updates: Partial<UserPick>) => {
        const { picks, activeFilter } = get();
        const updatedPicks = picks.map((pick) =>
          pick.id === pickId ? { ...pick, ...updates } : pick
        );
        const filtered = filterPicksByStatus(updatedPicks, activeFilter);
        const sorted = sortPicksByUnitRecord(filtered);

        set({
          picks: updatedPicks,
          filteredPicks: sorted,
        });
      },

      /**
       * Auto-select top 2 picks by unit record
       */
      autoSelectTopPicks: () => {
        const { filteredPicks } = get();
        const [battle1Id, battle2Id] = getDefaultSelection(filteredPicks);

        set({
          battle1PickId: battle1Id,
          battle2PickId: battle2Id,
        });
      },

      /**
       * Reset to initial state
       */
      reset: () => {
        set(initialState);
      },
    })),
    { name: 'PickBattleStore' }
  )
);

// ============================================================================
// SELECTORS
// ============================================================================

/**
 * Get the currently selected picks
 */
export const useSelectedPicks = () => {
  return usePickBattleStore((state) => {
    // Extra defensive - ensure picks is always an array
    const picks = Array.isArray(state?.picks) ? state.picks : [];
    const battle1PickId = state?.battle1PickId ?? null;
    const battle2PickId = state?.battle2PickId ?? null;
    return {
      battle1Pick: battle1PickId ? (picks.find((p) => p.id === battle1PickId) ?? null) : null,
      battle2Pick: battle2PickId ? (picks.find((p) => p.id === battle2PickId) ?? null) : null,
    };
  });
};

/**
 * Get tab counts
 */
export const usePickTabCounts = () => {
  return usePickBattleStore((state) => {
    const picks = Array.isArray(state?.picks) ? state.picks : [];
    return {
      all: picks.length,
      live: picks.filter((p) => p?.status === 'live').length,
      upcoming: picks.filter((p) => p?.status === 'upcoming').length,
      final: picks.filter((p) => p?.status === 'final').length,
    };
  });
};

/**
 * Check if a pick is currently selected
 */
export const useIsPickSelected = (pickId: string) => {
  return usePickBattleStore(
    (state) => state.battle1PickId === pickId || state.battle2PickId === pickId
  );
};

/**
 * Get the slot number for a pick (1, 2, or null)
 */
export const usePickSlotNumber = (pickId: string): 1 | 2 | null => {
  return usePickBattleStore((state) => {
    if (state.battle1PickId === pickId) return 1;
    if (state.battle2PickId === pickId) return 2;
    return null;
  });
};

