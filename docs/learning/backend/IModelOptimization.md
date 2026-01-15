# iModel Database Optimization

## Overview

iTwin.js iModels are SQLite databases that can benefit from periodic optimization. This document explains how to use the database optimization APIs to maintain optimal query performance and iModel file size.

## optimize() API

The simplest way to optimize an iModel is to pass `true` to the `close()` method:

```typescript
import { BriefcaseDb } from "@itwin/core-backend";

// Automatically optimize when closing
briefcaseDb.close(true);
```

This is the recommended approach as it:
- Ensures optimization happens before the iModel is closed
- Requires minimal code changes
- Guarantees the iModel is in optimal state for the next user

For more control over when optimization occurs, use the `optimize()` method directly:

```typescript
import { BriefcaseDb } from "@itwin/core-backend";

// Optimize before closing
briefcaseDb.performCheckpoint();  // Changes might still be in the WAL file
briefcaseDb.optimize();
briefcaseDb.saveChanges();

// Later close without re-optimizing
briefcaseDb.close();
```

This approach is useful when:
- You want to optimize at specific points during a long editing session
- You need to measure optimization impact separately
- You want to handle optimization errors explicitly

### What optimize() Does

The `optimize()` method performs two operations in sequence:

1. **VACUUM** - Rebuilds the database file to reclaim unused space and defragment
2. **ANALYZE** - Updates SQLite query optimizer statistics for better query performance

When called via `close(true)`, the optimize operation happens automatically before the iModel is closed and changes are saved.

### Important Considerations

- **Exclusive access required**: The optimize operation requires exclusive database access
- **Time-consuming**: VACUUM creates a temporary copy of the database, which can take time on large files
- **Write mode only**: Only works on databases opened for write access
- **Blocks other operations**: The database is locked during optimization

## Individual Operations

For more control, you can call VACUUM and ANALYZE separately:

### vacuum()

Reclaims unused space and defragments the database file:

```typescript
// After large deletions
briefcaseDb.vacuum();
```

### analyze()

Updates SQLite query optimizer statistics:

```typescript
// After large data imports or schema changes
briefcaseDb.analyze();
```

## Common Issues

### File size not decreasing even after significant defragmentation expectation

**Possible Cause**: In WAL (Write-Ahead Logging) mode, changes stay in the WAL file until checkpoint.

**Solution**: Call `performCheckpoint()` before optimizing.

```typescript
briefcase.performCheckpoint(); // Merge WAL into main file
briefcase.optimize();
briefcase.saveChanges();
```
