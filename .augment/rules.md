# Augment Workspace Rules

## Copy Debug Button Logging

**Rule:** Always add debug logs to Copy Debug button, not just web console

**When:** Implementing new features, debugging, or adding diagnostic information

**Instructions:**
1. ✅ **DO:** Add logs to Copy Debug button capture system (ItemEffectRegistry, game state)
2. ❌ **DON'T:** Rely solely on console.log() for important debug information
3. ✅ **DO:** Include context (gameId, side, item names, stat values, event triggers)
4. ✅ **DO:** Use emoji prefixes (🛡️, ⚔️, ⚡, ✅, ❌, ⚠️)
5. ✅ **DO:** Make logs copy-paste friendly with clear formatting
6. ✅ **DO:** Add safety checks for undefined values

**Example:**
```typescript
// ✅ GOOD - Captured by Copy Debug button
itemEffectRegistry.log(gameId, side, `⚔️ Hornets Nest: Fired ${count} retaliatory projectiles`);

// ❌ BAD - Only in web console
console.log('Fired projectiles');
```

**Copy Debug should capture:**
- Item activation events
- Stat calculations and rolls
- Game state changes
- Error conditions
- Performance metrics
- Event emissions and subscriptions

---

## Emoji Logging Convention

**Required:** All console logs MUST use emojis for categorization

**Standard Emojis:**
- 🛡️ Defense items and shields
- ⚔️ Weapon items and projectiles
- ⚡ Power items and buffs
- 🏰 Castle items and knight units
- ✅ Success / Completion
- ❌ Error / Failure
- ⚠️ Warning / Important
- 🔧 Debug / Technical info
- 🎯 Event triggers
- 📊 Stats / Calculations

**Example:**
```typescript
console.log('🛡️ Ironman Armor: Shield created with', shieldHp, 'HP');
console.log('⚔️ Shortsword: Firing', count, 'bonus projectiles');
console.log('✅ Item effect registered successfully');
console.log('❌ ERROR: gameId is undefined');
```

