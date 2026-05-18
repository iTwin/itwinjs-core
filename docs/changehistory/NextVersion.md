---
publish: false
---
# NextVersion

- [NextVersion](#nextversion)
  - [@itwin/core-backend](#itwincore-backend)
    - [ECSQL CROSS JOIN now supports optional ON clause](#ecsql-cross-join-now-supports-optional-on-clause)
    - [Schema changesets can be reversed](#schema-changesets-can-be-reversed)
    - [Changeset Group support](#changeset-group-support)
  - [Electron 42 support](#electron-42-support)

## @itwin/core-backend

### ECSQL CROSS JOIN now supports optional ON clause

`CROSS JOIN` in ECSQL now accepts an optional `ON` condition, matching standard SQL and SQLite behavior. Previously, `CROSS JOIN` only produced an unfiltered Cartesian product between two classes.

The key benefit of using `CROSS JOIN` with an `ON` clause — rather than `INNER JOIN` — is optimizer control: SQLite's [special CROSS JOIN handling](https://www.sqlite.org/lang_select.html#special_handling_of_cross_join_) prevents the query planner from reordering the joined tables, giving applications explicit control over the join order and query execution plan.

**Example** — filter the Cartesian product while locking join order:

```sql
-- Returns only matching Person/Identifier pairs, but forces Person to be the outer table
SELECT * FROM ts.Person p CROSS JOIN ts.Identifier i ON p.PersonalID = i.PersonId
```

This is equivalent in result to an `INNER JOIN`, but the optimizer is not permitted to swap the table order, which can be important for performance-sensitive queries.

### Schema changesets can be reversed

This makes it possible to walk a changeset timeline backwards through interleaved schema and data changesets. After reversing a schema changeset, the EC metadata (class definitions, property mappings, schema version) reflects the state prior to that changeset.

As a result, `CheckpointManager.downloadCheckpoint` now succeeds when the target changeset is older than the checkpoint and the range spans one or more schema changesets. Previously this would fail because schema changesets could not be reversed.

### Changeset Group support

Three new `@beta` methods have been added to [BriefcaseDb]($backend) for a high-level Changeset Group workflow:

- `beginChangesetGroup(description?)` — creates a new Changeset Group (`state: "inProgress"`) and stores it as the active group on the briefcase.
- `endChangesetGroup()` — closes the active group (`state: "completed"`) and clears it from the briefcase.
- `currentChangesetGroup` (getter) — returns the active [ChangesetGroupProps]($common), or `undefined` if no group is in progress.

Once `beginChangesetGroup` is called, all subsequent `pushChanges` calls will automatically associate their changesets with the active group until `endChangesetGroup` is called. An explicit `changesetGroupId` on [PushChangesArgs]($backend) will override the automatic association.

A Changeset Group is a logical container for one or more changesets that represent a single higher-level operation (e.g., one synchronization run). Typical usage:

```typescript
// 1. Begin a group before pushing any changesets
const group = await db.beginChangesetGroup("synchronization run 2024-01-01");

// 2. Push one or more changesets — groupId is automatically applied
await db.pushChanges({ description: "sync batch 1/2" });
await db.pushChanges({ description: "sync batch 2/2" });

// 3. Close the group once all changesets have been pushed
await db.endChangesetGroup();
```

Two new optional `@beta` methods have also been added to [BackendHubAccess]($backend) for lower-level access:

- `createChangesetGroup` — creates a new Changeset Group and returns its [ChangesetGroupProps]($common).
- `updateChangesetGroup` — closes an open Changeset Group by setting its state to `"completed"`.

A new optional `changesetGroupId` field has been added to [PushChangesArgs]($backend) so that changesets can be explicitly associated with a group when pushed.

Two new types have been added to `@itwin/core-common`:

- [ChangesetGroupProps]($common) — describes a Changeset Group (`id`, `state`, optional `description`).
- [ChangesetGroupState]($common) — string union of possible group states: `"inProgress"`, `"completed"`, `"timedOut"`, `"forciblyClosed"`.

The [HubMock]($backend-itwin-core) test utility now supports these operations as well.

## Electron 42 support

In addition to [already supported Electron versions](../learning/SupportedPlatforms.md#electron), iTwin.js now supports [Electron 42](https://www.electronjs.org/blog/electron-42-0).
