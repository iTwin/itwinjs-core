# Writing to iModels using IModelDb

An IModelDb also serves as a staging area where a [backend](../Glossary.md#backend) can change the content of an iModel and then submit the changes to iModelHub.

A backend can make the following kinds of changes:

- [Create or update Elements](./CreateElements.md)
- [Create or update Models](./CreateModels.md)
- [Reserve Codes](./ReserveCodes.md)

Use [IModelDb.saveChanges]($backend) to commit changes locally. [BriefcaseDb.txns]($backend) manages local transactions and supports undo/redo of pending local changes — those saved via [IModelDb.saveChanges]($backend) but not yet pushed. Once changes are pushed to iModelHub via [BriefcaseDb.pushChanges]($backend), they become part of the permanent changeset history and can no longer be reversed using the local undo/redo stack.

## Pushing changes to iModelHub

Use [BriefcaseDb.pushChanges]($backend) to push local changes to iModelHub as a changeset, so that others can see them. After a changeset is pushed to iModelHub, it becomes part of the iModel's permanent timeline. This method automatically [pulls and merges](./IModelDbSync.md) new ChangeSets from iModelHub.

> Only a single application can push to iModelHub at a time. IModelDb.pushChanges automatically retries push on appropriate failures. However, it is possible that all retry attempts fail, if there are a lot of other applications pushing at the same time. In that case, push should be attempted again later.

## Reversing pushed changesets

While the local undo/redo stack is cleared after pushing, it is still possible to reverse the *effect* of previously-pushed changesets using [BriefcaseDb.revertAndPushChanges]($backend). This method applies the targeted changesets in reverse to produce a new "revert" changeset, which is then pushed to iModelHub. Before calling it, the briefcase must be "clean": it must have no unsaved changes (`hasUnsavedChanges` must be false) and no pending transactions (`txns.hasPendingTxns` must be false). Save and push local changes first, or discard them, before attempting the revert. The original changesets are **not** removed from iModelHub's timeline — the history is append-only and immutable.

| Scenario | Mechanism |
|---|---|
| Undo/redo **unpushed** local changes | `txns.reverseTxns` / `txns.reinstateTxn` |
| Reverse the effect of **pushed** changesets | `BriefcaseDb.revertAndPushChanges({ toIndex })` |
| Remove a changeset from history entirely | Not possible — iModelHub timeline is immutable |

