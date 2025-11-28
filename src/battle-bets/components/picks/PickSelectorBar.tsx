/**
 * PickSelectorBar Component
 * 
 * Container component that displays all user picks as selectable chips.
 * Includes horizontal scrolling with arrow navigation.
 */

import React, { useRef, useCallback, useMemo } from 'react';
import { PickChip } from './PickChip';
import { usePickBattleStore } from '../../store/pickBattleStore';
import { pickToChipData } from '../../utils/pickUtils';
import type { PickChipData } from '../../types/picks';
import './styles/PickSelector.css';

// SVG Arrow Icons
const ChevronLeft = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

const ChevronRight = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 18l6-6-6-6" />
  </svg>
);

interface PickSelectorBarProps {
  /** Optional class name for styling */
  className?: string;
}

export const PickSelectorBar: React.FC<PickSelectorBarProps> = ({ className }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Get state from store
  const {
    filteredPicks,
    battle1PickId,
    battle2PickId,
    selectPick,
  } = usePickBattleStore();

  // Transform picks to chip data (with null safety)
  const chipData: PickChipData[] = useMemo(() => {
    const picks = filteredPicks || [];
    return picks.map((pick) =>
      pickToChipData(pick, battle1PickId, battle2PickId)
    );
  }, [filteredPicks, battle1PickId, battle2PickId]);

  // Scroll handlers
  const scrollLeft = useCallback(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -160, behavior: 'smooth' });
    }
  }, []);

  const scrollRight = useCallback(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 160, behavior: 'smooth' });
    }
  }, []);

  // Handle chip click
  const handleChipClick = useCallback((pickId: string) => {
    selectPick(pickId);
  }, [selectPick]);

  // Empty state
  if (chipData.length === 0) {
    return (
      <div className={`pick-selector-bar ${className || ''}`}>
        <div className="pick-selector-empty">
          No picks available for this filter
        </div>
      </div>
    );
  }

  return (
    <div className={`pick-selector-bar ${className || ''}`}>
      {/* Left scroll arrow */}
      <button
        className="pick-selector-arrow"
        onClick={scrollLeft}
        aria-label="Scroll left"
      >
        <ChevronLeft />
      </button>

      {/* Scrollable chips container */}
      <div className="pick-selector-scroll-container">
        <div
          className="pick-selector-chips"
          ref={scrollContainerRef}
        >
          {chipData.map((chip) => (
            <PickChip
              key={chip.pickId}
              data={chip}
              onClick={handleChipClick}
            />
          ))}
        </div>
      </div>

      {/* Right scroll arrow */}
      <button
        className="pick-selector-arrow"
        onClick={scrollRight}
        aria-label="Scroll right"
      >
        <ChevronRight />
      </button>
    </div>
  );
};

export default PickSelectorBar;

