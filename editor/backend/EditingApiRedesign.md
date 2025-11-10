# Edit Command Design Document

## Summary

This document describes the design and implementation of an editing API for iTwin.js that prevents concurrent modification conflicts while supporting both immediate (fire-and-forget) and interactive (long-running) command patterns.

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Implementation Details](#implementation-details)
3. [Test Coverage](#test-coverage)
4. [Future Work](#future-work)

## Architecture Overview

### Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                        IModelDb                             │
│  - Manages global command queue (DeQueue<EditCommandInfo>)  │
│  - Tracks active scope                                      │
│  - Manages nested scope stack                               │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                       EditScope                             │
│  - Represents a transactional scope                         │
│  - Manages state transitions                                │
│  - Handles activation waiting (polling-based for now)       │
│  - Begins/ends multi-transaction operations                 │
│  - Tracks command type (Immediate vs Interactive)           │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────┬──────────────────────────────────────┐
│  ImmediateCommand    │      InteractiveCommand              │
│  (Fire-and-forget)   │      (Long-running)                  │
├──────────────────────┼──────────────────────────────────────┤
│ - execute()          │ - Constructor creates scope          │
│ - Auto save/abandon  │ - startCommandScope() waits          │
│                      │ - executeOperation() for each step   │
│                      │ - endCommandScope() cleanup          │
│                      │ - Manual save/abandon                │
└──────────────────────┴──────────────────────────────────────┘
```

---

## Implementation Details

### EditScope

**Responsibilities**:
- Track scope ID and parent scope ID (for nesting)
- Manage state transitions
- Wait for activation (polling mechanism - to be optimized later)
- Begin/end multi-transaction operations
- Save/abandon changes
- Handle nested vs root scope logic

**Key Properties**:
```typescript
public readonly scopeId: string;           // Unique identifier
public readonly parentScopeId?: string;    // For nested commands
public readonly commandType: CommandType;  // Immediate or Interactive
private _state: EditCommandState;          // Current lifecycle state
```

**State Machine**:
```
NotStarted → Starting → Active → Saving → Completed
                  ↓                ↓
                  └──→ Abandoning → Abandoned
                         ↓
                       Failed
```

### ImmediateCommand (Incomplete and currently in development, implementation likely to change)

**API**:
```typescript
const cmd = new MyImmediateCommand(iModelDb);
const result = await cmd.execute(async () => {
  // Single operation
  return someValue;
});
// Automatically saved or abandoned
```

**Characteristics**:
- Scope created in `execute()`
- Enqueued at execution time
- Callback executes once
- Auto-save on success
- Auto-abandon on error
- Cannot be reused

### InteractiveCommand

**API**:
```typescript
const cmd = new MyInteractiveCommand(iModelDb);  // Enqueued here!

await cmd.startCommandScope();  // Wait for activation
try {
  await cmd.operation1();
  await cmd.operation2();
  await cmd.saveChanges("description");
} catch (error) {
  await cmd.abandonChanges();
} finally {
  await cmd.endCommandScope();
}
```

**Characteristics**:
- Scope created in **constructor**
- Enqueued at construction time (critical for proper concurrency)
- Multiple operations via `executeOperation()`
- Manual save/abandon
- Explicit lifecycle management
- Can wrap entire workflow in convenience methods

**Helper Methods**:
```typescript
// Protected method for subclasses to use
protected async executeOperation<T>(operation: () => Promise<T>): Promise<T>
```

---

## Test Coverage

### Current Test Scenarios

#### Immediate Command Tests ✅
1. **Basic Execution**
   - Square a number
   - Calculate hypotenuse

2. **Nesting**
   - Nested commands (sync)
   - Nested commands (async)
   - Multiple levels of nesting

3. **Concurrency**
   - 4 concurrent commands
   - 20 concurrent commands (high load)
   - Commands with different execution times
   - Alternating external and nested commands

#### Interactive Command Tests ✅
1. **Basic Execution**
   - Simple interactive command
   - Interactive with nested immediate commands
   - Multiple incremental updates (UI drag simulation)

2. **Concurrency**
   - 3 concurrent interactive commands
   - 10 concurrent interactive commands
   - Mix of immediate and interactive commands

3. **Real-World Scenarios**
   - Polygon editor: add/remove vertices
   - Polygon editor: move vertices
   - Slow operations with delays

4. **Error Handling**
   - Abandon on error
   - Nested interactive within immediate

#### Nesting Tests ✅
- Immediate within immediate
- Immediate within interactive
- Interactive within immediate
- ❌ Interactive within interactive (correctly throws error)

### Test Coverage Metrics

**Lines of Test Code**: ~350 lines
**Test Cases**: 24 total
- Immediate: 9 tests
- Interactive: 12 tests
- Mixed: 3 tests

**Scenarios Covered**:
- ✅ Basic operations
- ✅ Nesting (2 levels)
- ✅ Concurrency (up to 20 commands)
- ✅ Error handling
- ✅ State transitions
- ✅ Mixed command types

---

## Future Work

### Critical Items (Must-Have)

1. **Real iModel Testing**
   - Test with actual iModel schema modifications
   - Insert/update/delete elements
   - Verify transaction rollback works correctly
   - Test with BriefcaseDb (not just StandaloneDb)

2. **Verify Save/Abandon Behavior**
   - Confirm changes are actually persisted on save
   - Confirm changes are rolled back on abandon
   - Test transaction boundaries
   - Verify `startTxnId` tracking works correctly

### Important Items (Should-Have)

4. **Command Description Extraction**
   - Currently command descriptions don't propagate properly
   - Extract from callback arguments
   - Make descriptions more meaningful in logs

5. **State Validation Tests**
   - Test all state transitions
   - Verify invalid transitions throw errors
   - Test edge cases (abandon while saving, etc.)

6. **Performance Testing**
   - Measure queue overhead
   - Test with 100+ concurrent commands
   - Memory leak testing (ensure scopes are cleaned up)
   - Profile AsyncLocalStorage overhead

7. **Nested Command Limits**
   - Test deep nesting (5+ levels)
   - Verify AsyncLocalStorage doesn't overflow
   - Document maximum nesting depth

8. **Error Propagation**
   - Test nested command errors bubble up correctly
   - Verify parent abandons when child fails
   - Test error messages are clear

### Nice-to-Have Items

9. **Command Timeout**
   - Add timeout for commands that take too long
   - Configurable timeout per command type
   - Auto-abandon on timeout

10. **Queue Visualization**
    - Debug utility to visualize queue state
    - Show active scope, pending scopes
    - Track command execution history

11. **Queue Priorities**
    - Allow high-priority commands to jump queue
    - System commands vs user commands
    - Configurable priority levels

12. **Command Cancellation**
    - Allow users to cancel queued commands
    - Proper cleanup on cancellation
    - Notification to waiting commands

13. **Metrics and Monitoring**
    - Track average queue wait time
    - Track command execution time
    - Alert on queue buildup
    - Performance dashboards

---

## API Examples (Currenty in develeopment, likely to change)

### Immediate Command Example

```typescript
class UpdatePropertyCommand extends ImmediateCommand<UpdatePropertyArgs, void> {
  public async updateProperty(args: UpdatePropertyArgs): Promise<void> {
    const element = this._iModel.elements.getElement(args.elementId);
    element.userLabel = args.newValue;
    this._iModel.elements.updateElement(element);
  }
}

// Usage
const cmd = new UpdatePropertyCommand(iModelDb);
await cmd.execute(async () => {
  await cmd.updateProperty({ elementId: "0x123", newValue: "New Label" });
});
// Automatically saved
```

### Interactive Command Example

```typescript
class VertexDragCommand extends InteractiveCommand<VertexDragArgs, void> {
  private _originalPosition?: Point3d;
  private _elementId?: string;

  public async selectVertex(elementId: string): Promise<void> {
    return await this.executeOperation(async () => {
      this._elementId = elementId;
      const element = this._iModel.elements.getElement(elementId);
      this._originalPosition = element.placement.origin;
    });
  }

  public async moveVertex(newPosition: Point3d): Promise<void> {
    return await this.executeOperation(async () => {
      const element = this._iModel.elements.getElement(this._elementId!);
      element.placement.origin = newPosition;
      this._iModel.elements.updateElement(element);
    });
  }
}

// Usage
const cmd = new VertexDragCommand(iModelDb);
await cmd.startCommandScope();
try {
  await cmd.selectVertex(elementId);

  // User drags mouse
  for (const moveEvent of dragEvents) {
    await cmd.moveVertex(moveEvent.position);
  }

  await cmd.saveChanges("Moved vertex");
} catch (error) {
  await cmd.abandonChanges();
} finally {
  await cmd.endCommandScope();
}
```

---