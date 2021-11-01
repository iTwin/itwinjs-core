# Interactive Editing Applications

## Txns

A `Txn` (pronounced "Texan") is a **set of changes to a briefcase**, created by a call to [IModelDb.saveChanges]($backend). A Txn may optionally have a name, supplied with the `description` argument to `SaveChange`.

Txns are created by *tracking* all changes made to the briefcase at the lowest level. When the call to `SaveChanges` ends the underlying [SQLite transaction](https://sqlite.org/lang_transaction.html), all tracked changes are combined into a *changeset* of what happened. A Txn holds that changeset and it is stored *in the briefcase* within the same SQLite transaction as the changes it describes. In this manner, all changes to the briefcase, and the Txn that describes them, are atomic - either they are all saved or none are are saved.

> Txns are stored in a "local" table, so they are don't attempt to track themselves.

Txns hold the *net changes* made during the transaction. That is, the Txn does not hold the sequence of individual changes made to the briefcase, only the final result of all changes together. For example, if an element is added and later deleted in the same transaction, the net is no change. Likewise if a property of an element is modified more than once, the Txn will only hold the final value.

### Undo/Redo via Txns

Txns store both the final state of the changes, on a per-property basis, and the starting state of the those properties before the changes we made. The pre-changed values can be used to *reverse* a previously applied Txn, moving the briefcase to its exact state before the changes were made. Likewise, a previously reversed Txn may be *reinstated*, to move the briefcase back to its post-changed state.

Since Txns are created by an application's call to `SaveChanges`, they can be used to group sets of changes that are *undone* and *redone* together. The Txn's description is used to indicate to the user what operations undo/redo affects. By calling `SaveChanges` at logical states of the briefcase (e.g. between user actions), interactive programs can permit users to undo (i.e. "back up") and redo their actions without having to write special code to ensure database integrity.

While Txns themselves hold net changes for a single transaction, they are stored in the briefcase in the order they were made. This forms a *timeline of the session*, and provides the ordering for undo. Only the most recent Txn in the session may be undone. Once a Txn is undone, and unless it is immediately redone (i.e. any other changes are made to the briefcase), it is abandoned. Txns persist across sessions even if the program crashes. Applications may, but generally don't, permit undo/redo across sessions,

## Monitoring Txns

Every [BriefcaseDb]($backend) has a [TxnManager]($backend) associated that is used for operations on Txns. Likewise, every [BriefcaseConnection]($frontend) has a [BriefcaseTxns]($frontend). `TxnManager` and `BriefcaseTxns` emit events with information about "what happened" as changes are made to the database, permitting applications to remain synchronized with the persistent state of the iModel by, for example, updating in-memory state or (on the frontend) refreshing the contents of [Viewport]($frontend)s and UI components.

## Pushing ChangeSets to IModelHub

Txns hold local changes to a single briefcase. When users are ready to send the result of all their local changes to IModelHub, the local Txns must be merged together to form a ChangeSet. Changesets hold the *net changes* made during the session. As above, if an element is added in one Txn and then deleted in a subsequent Txn, the result is no change in the ChangeSet.

> Conceptually, there is no difference between a Txn and a ChangeSet - they both describe the net result of a set of changes to the briefcase. They are merely given different names to distinguish their roles in the workflow. If it helps, you can think of a Txn as a *micro ChangeSet*. Txns are created and named by `SaveChanges` and held in a *session timeline* inside a briefcase. ChangeSet are created by merging Txns, and are given a name when they are pushed to the *iModel timeline* in IModelHub. A ChangeSet represents the result of a single session from a single briefcase.

Once a session is ended by successfully pushing its ChangeSet to IModelHub, all Txns are deleted and the Txn timeline is cleared.
