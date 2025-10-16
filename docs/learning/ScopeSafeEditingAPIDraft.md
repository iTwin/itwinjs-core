# Scope-Safe Editing API

## Problem Statement

While an edit operation is in progress, other asynchronous actions (e.g., undo, redo, pull, merge, saveChanges, abandonChanges, discardChanges) can interfere with the backend state, potentially leading to inconsistent or erroneous behavior.

## Proposed Solution

We need to make edit operations scope-safe by ensuring that only a defined set of actions can occur during an active edit session. This can be achieved by:

### 1. Serializing Backend Operations
Prevent new operations from starting until the current edit operation is either committed or abandoned.

### 2. Restricting Conflicting Actions
Disallow or throw exceptions for operations that could disrupt the edit session.

### 3. Providing a Query Mechanism
Allow the frontend to check whether a specific operation is currently allowed, based on the backend's state.

### Identified Race Conditions In Unit Tests

#### 1. **AbandonChanges During Active Edit Command**
- **Scenario**: While an `EditCommand` is actively creating elements, `abandonChanges()` is called
- **Result**: Partial element creation occurs before abandonment, leading to inconsistent state
- **Impact**: Elements that should have been part of a cohesive edit operation get partially committed

#### 2. **DiscardChanges During Active Edit Command**
- **Scenario**: Similar to abandon, but using `discardChanges()` during active element insertion
- **Result**: Race condition where some elements persist despite the discard operation
- **Impact**: Incomplete rollback of edit operations

#### 3. **SaveChanges During Insert-Abandon Operations**
- **Scenario**: `saveChanges()` called while an edit command is performing `performInsertAbandonOperation`
- **Result**: Elements that were meant to be abandoned get saved instead
- **Impact**: Violation of expected transactional behavior

#### 4. **PullChanges During Active Edit Sessions**
- **Scenario**: Attempting to pull changes from hub while an edit command has unsaved changes
- **Current Behavior**: Properly throws error with "unsaved changes" message
- **Status**: Already handled correctly

#### 5. **Concurrent Multi-Operation Race Conditions**
- **Scenario**: Multiple async operations (EditCommand, abandonChanges, undo, explicit element deletion) executing simultaneously
- **Result**: Unpredictable element states, ID reuse with different properties
- **Impact**: Complete breakdown of data consistency guarantees

## Test Coverage Strategy

### Unit Tests
- [ ] EditSessionManager state transitions
- [ ] Operation validation logic
- [ ] Error message consistency
- [ ] Edge cases (nested commands, timeouts)

### Integration Tests
- [✅] Race condition scenarios
- [ ] Multi-briefcase scenarios
- [ ] Complex edit command workflows
- [ ] Error recovery scenarios

### Performance Tests
- [ ] Impact of additional state checks
- [ ] Concurrent operation handling
- [ ] Large-scale edit session management

---

*This document will be updated as implementation progresses and new findings emerge.*
