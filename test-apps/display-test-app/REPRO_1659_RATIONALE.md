# Issue #1659 Reproduction — Rationale & Theory Validation

## The Bug

**Symptom**: Move/copy operations in Substation+ became unacceptably slow after upgrading from iTwin.js 4.11 to 5.2.

**Root cause identified**: Commit `ce418d16d8` — **GoogleMaps support (#7604)** (2025-02-21) changed `ScreenViewport.addDecorations()` to iterate `this.getTileTreeRefs()` instead of `this.tiledGraphicsProviderRefs()`. This means every decoration rebuild now iterates ALL tile tree refs (view model refs + map refs + provider refs), not just the external tiled graphics providers. Combined with the fact that decorations are invalidated on every mouse motion (by AccuSnap, ToolAdmin locate circle, and ToolAdmin.updateDynamics), this makes decoration rebuilds during move/copy drag significantly more expensive.

**Prior fix applied**: Changed `changeDynamics()` from `invalidateDecorations()` to `requestRedraw()` in `Viewport.ts` line 1748. This fix is necessary but insufficient — other code paths still invalidate decorations during mouse motion.

## Key Code Change

**4.11 (correct — `ScreenViewport.addDecorations()`):**
```typescript
context.addFromDecorator(this.view);
this.forEachTiledGraphicsProviderTree((ref) => context.addFromDecorator(ref));
// ^ Only iterates external TiledGraphicsProviders
```

**Current (buggy — `ScreenViewport.addDecorations()`):**
```typescript
context.addFromDecorator(this.view);
for (const ref of this.getTileTreeRefs()) {   // ← BUG: includes view's own refs!
  context.addFromDecorator(ref);
}
```

`getTileTreeRefs()` yields `this.view.getTileTreeRefs()` + `this.mapTileTreeRefs` + `this.tiledGraphicsProviderRefs()`. The view's model and displayStyle refs are already decorated via `this.view`, so iterating them again is redundant work. Map tile tree refs also get their `decorate()` called twice (they DO override it).

## Other Invalidation Sources

The `changeDynamics` fix addresses one source of `invalidateDecorations()` but NOT these others that fire on every mouse motion:

- **AccuSnap** (`AccuSnap.ts:229-232`): `setCurrHit()` → `setFlashHit()` → `setNeedsFlash()` → `view.invalidateDecorations()`
- **ToolAdmin.onMotion()** (line 1165): `if (this.isLocateCircleOn) vp.invalidateDecorations()`
- **ToolAdmin.updateDynamics()** (line 982): `vp.invalidateDecorations()` when dynamics are NOT active

These explain why connector dec/sec is high in BOTH fixed and regressed modes during our initial testing — the `changeDynamics` fix alone doesn't prevent decoration rebuilds.

## A/B Test Setup

Two worktrees for direct comparison:

- **4.11 baseline**: `/Users/benpolinsky/source/itwinjs-core.worktrees/repro-1659-baseline-4.11`
- **Current branch**: `/Users/benpolinsky/source/itwinjs-core.worktrees/copy-and-move-regression-1659`

Both have identical test infrastructure: `CreateReproIModel`, `ReproIssue1659` decorators, `InteractiveMoveElementsTool`.

## How to Run the A/B Test

### On EACH version:

```bash
# Launch DTA with editing enabled
IMJS_READ_WRITE=1 npx electron <lib-path>/backend/DtaElectronMain.js
# 4.11: lib/backend/DtaElectronMain.js
# Current: lib/cjs/backend/DtaElectronMain.js

# 1. Create test iModel
dta repro 1659 create 30 50

# 2. Open the created .bim file (path shown in notification)

# 3. Start an editing session
dta edit

# 4. Add decorators (300 connector ports + annotations + HUD)
dta repro 1659 decorate

# 5. Select some elements (drag-select a group)

# 6. Start interactive move
dta interactive move

# 7. Click anywhere to set anchor point, then move mouse
#    Observe dynamics responsiveness and HUD stats
#    Press Escape to cancel
```

### What to Compare

| Metric | 4.11 (expected) | Current (expected) |
|--------|-----------------|-------------------|
| Dynamics smoothness | Smooth | Sluggish/jerky |
| connector dec/sec | Moderate | Higher (more iteration per rebuild) |
| Frame rate during drag | Higher | Lower |

## What This Proves / Disproves

### If current is noticeably slower than 4.11 with decorators active

**Then**: The `addDecorations()` change (iterating all tile tree refs) combined with frequent `invalidateDecorations()` calls is the regression cause. The fix should revert `addDecorations` to only iterate providers and map refs, not `getTileTreeRefs()`.

### If both versions feel the same

**Then**: The regression is elsewhere — possibly in `TransformGraphicsProvider`, the backend editing pipeline, or something specific to S+'s iModel structure that our programmatic iModel doesn't capture.

## What This Reproduction Does NOT Cover

1. **Backend copy performance** — Issue #1658 (ECReferenceTypesCache traversal). Separate concern.
2. **Real TransformGraphicsProvider cost** — We use the real `TransformElementsTool` but with simple programmatic geometry, not complex S+ symbols.
3. **Real clash detection latency** — S+ runs spatial queries on every mousemove; we simulate with CPU burn.
4. **Catalog iModel overlay** — S+ uses catalog iModels which add additional tile tree refs beyond what our programmatic iModel provides.
