---
alwaysApply: true
---

# Factor Formula Documentation Rule

**RULE**: Any time we change a factor formula or weighting in the code, we must update both the Logic & Examples chart and the displayed formula in the factor configuration modal to keep documentation in sync with implementation.

## What Must Be Updated:

1. **Formula String**: Update the `formula` field in `getFactorLogic()` function
2. **Examples Table**: Recalculate all signal values and over/under scores in the examples table
3. **Features Section**: Update any formula references in the `features` array
4. **Formula Explanation**: Update the detailed formula breakdown sections

## Location:
- File: `src/app/cappers/shiva/management/components/factor-config-modal.tsx`
- Function: `getFactorLogic(key: string)`
- Object: `logicMap[key].formula` and `logicMap[key].examples`

## Example:
When Edge vs Market scaling changed from `/10` to `/3`:
- **Old**: `signal = clamp(edgePts/10, -1, +1)`
- **New**: `signal = clamp(edgePts/3, -2, +2)`
- **Result**: All examples recalculated with new signal values and scores

This ensures the UI accurately reflects the actual calculations being performed and prevents confusion between documented behavior and actual implementation.
