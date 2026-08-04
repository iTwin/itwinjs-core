# Concurrency Control

Concurrency control is how iTwin.js coordinates simultaneous changes to an iModel among multiple [briefcases](../Glossary.md#Briefcase) while preserving data integrity. It is based on the identity of a briefcase, and should not be confused with user access control (the "right" to make changes based on roles).

iTwin.js provides two complementary mechanisms:

- **[Locks](#locks)** protect *existing* models and elements from conflicting concurrent modification. A lock is *pessimistic*: it serializes changes so that only one briefcase at a time can edit a given element.
- **[Reservations](#reservations)** coordinate the concurrent *creation* of elements that share an identity across briefcases — any [Element]($backend) inserted with an explicit `federationGuid`, such as shared [DefinitionElement]($backend)s (categories, line styles, materials) or the template elements of a component. Reservations let multiple briefcases add and reference the *same* element at the same time without conflicting, and without serializing on a lock.

The two work in tandem: locks keep concurrent edits to established data safe, while reservations keep concurrent *additions* of shared building blocks safe. To make coordinated changes, an app follows these rules:

1. **Lock** the models and elements it intends to modify before modifying them (under the default [pessimistic policy](#concurrency-control-policies)).
1. **Reserve** any elements that carry an explicit `federationGuid` before inserting them, when the iModel uses [SchemaSync](#reservations-and-schemasync).
1. **[Pull and merge](./IModelDbSync.md)** before pushing.

An app uses [BriefcaseDb.locks]($backend) to work with locks and [IModelDb.reservations]($backend) to work with reservations.

## Background

This article assumes that you already know that:

- An iModel is a multi-user database.
- An app works with a [briefcase](../Glossary.md#Briefcase) using the [BriefcaseDb]($backend) class.
- A briefcase has a unique [BriefcaseId]($common) that is issued and tracked by [iModelHub](../IModelHub/index.md).
- Every element has a unique [Id64]($bentley) that combines a briefcase id with a locally-sequential id, so that different briefcases never mint the same element id.
- Changes are captured and distributed in the form of [Changesets](../IModelHub/briefcases.md).
- Changesets are ordered in a sequence that is called the [timeline](../IModelHub/index.md#the-timeline-of-changes-to-an-imodel) of the iModel. A changeset's position on the timeline is indicated by its [ChangesetIndex]($common).
- Changesets are stored in iModelHub.

## Concurrency Glossary

| Term                                | Definition                                                                                                                                                                                                                                                          |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Base**                            | Changeset B is *based* on Changeset A if B comes after A in the timeline.                                                                                                                                                                                           |
| **Change-merging**                  | Same as merge.                                                                                                                                                                                                                                                      |
| **Concurrency Control**             | How to coordinate simultaneous transactions while preserving data integrity.                                                                                                                                                                                        |
| **Concurrency Control Policy**      | The rules that apps must follow when changing models and elements. Normally [pessimistic](#concurrency-control-policies).                                                                                                                                        |
| **Conflict**                        | Arises when two Changesets change the same object in different ways, where neither Changeset is based on the other.                                                                                                                                                 |
| **DefinitionElement**               | A reusable, shared element (e.g. a [Category]($backend), [LineStyle]($backend), or material) held in a [DefinitionModel]($backend) and referenced by many other elements. See [Reservations](#reservations).                                                         |
| **Federation GUID**                 | A globally-unique identifier ([GuidString]($bentley)) that stably identifies an element across briefcases and iModels. Reservations use an explicitly-set federation GUID to agree on a shared identity for an element.                                                                      |
| **Lock**                            | The right to modify an Element (and, for the exclusive lock, its descendant Elements).                                                                                                                                                                              |
| **Merge**                           | Apply a Changeset to a briefcase.                                                                                                                                                                                                                                   |
| **Pessimistic Concurrency Control** | The default policy: apps must acquire locks before changing existing elements.                                                                                                                                                                                     |
| **Push**                            | Upload a Changeset to iModelHub.                                                                                                                                                                                                                                    |
| **Pull**                            | Download a Changeset from iModelHub. See [IModelDb synchronization](./IModelDbSync.md).                                                                                                                                                                             |
| **Reservation**                     | An agreement, coordinated through [SchemaSync](#reservations-and-schemasync), that pre-allocates a shared element id for an element with an explicit federation GUID so multiple briefcases can create the same element concurrently. See [Reservations](#reservations). |
| **Schema Lock**                     | The exclusive lock on the root (repository model) element. Blocks *all* other locks while held; required to import schemas. See [Schema Lock](#the-schema-lock).                                                                                                    |
| **Tip**                             | The most recent version of an iModel. Also, the most recent Changeset in the timeline.                                                                                                                                                                              |
| **Transaction**                     | A set of changes that are committed or abandoned atomically, making up a unit of work. A transaction is *committed* by calling [BriefcaseDb.saveChanges]($backend). Multiple transactions to a briefcase are combined into a [Changeset](../Glossary.md#Changeset). |
| **Version**                         | The state of an iModel as of a specific point in its timeline, that is, the result of the Changesets up to that point.                                                                                                                                              |

## Concurrency Control Policies

By default, an iModel uses a **pessimistic** policy: models and elements must be locked before they can be modified. The policy is determined when the iModel is created in iModelHub via the `noLocks` parameter of [BackendHubAccess.createNewIModel]($backend). If `noLocks` is not specified (the default), iTwin.js enforces that the appropriate locks must be acquired *before* modifying elements. The policy is fixed for the life of the iModel, and is enforced whenever a [BriefcaseDb]($backend) is opened.

> **Optimistic concurrency (experimental).** A `noLocks: true` iModel permits editing without locks, relying on property-level change-merging to reconcile concurrent edits when briefcases pull and push. This mode is **experimental and incomplete**: its conflict-resolution behavior is not fully specified and it is **not recommended for production applications**. Prefer the default pessimistic policy, and use [reservations](#reservations) — not `noLocks` — to enable concurrent creation of shared definitions.

## Locks

Locks implement the pessimistic policy. Locking an element before changing it prevents concurrent changes and forces briefcase transactions that affect the same models and elements to be serialized, so they merge without conflicts.

To work with a pessimistic iModel, apps follow the **pull → lock → change → push** pattern.

### Lock Types

Locks apply (only) to Elements and are acquired on behalf of a briefcase by specifying a lock type and an ElementId. There are two types:

- **Exclusive lock**: Reserves an Element for exclusive access. Only the holder of the exclusive lock may modify or delete the Element.
- **Shared lock**: Holding a shared lock on an Element blocks other briefcases from acquiring the exclusive lock on that Element (but allows other shared locks).

### Acquiring Locks

Locks are acquired through the [LockControl]($backend) interface exposed by [BriefcaseDb.locks]($backend) — via [LockControl.acquireLocks]($backend), supplying the shared and/or exclusive ElementIds to lock.

Rules for acquiring locks:

- Only one briefcase at a time may hold the exclusive lock on an Element.
- You may only obtain the exclusive lock on an Element if your `BriefcaseDb.changeset.index` is equal to or greater than the [ChangesetIndex]($common) recorded the last time the lock was released. That is, you may only acquire the exclusive lock on an Element if your briefcase holds its most recent state.
- You cannot obtain a shared lock on an Element while another briefcase holds the exclusive lock.
- Obtaining a lock on an Element (either exclusive or shared) also requires the shared lock on its Model and its Parent, if it has one. This is automatic and recursive: a request for a single lock may in fact require many locks all the way up the hierarchy, if they are not already held. If any required lock is unavailable, no locks are obtained.
- Acquiring the exclusive lock on a Model (via its modeled element) implicitly acquires the exclusive lock on all of its elements. Likewise, acquiring the exclusive lock on an element implicitly acquires the exclusive lock on its children.

For reference, the locks required for direct element changes are:

| Operation      | Locks Required                                       |
| -------------- | ---------------------------------------------------- |
| Insert element | Shared lock on Model and Parent Element, if present  |
| Modify element | Exclusive lock                                       |
| Delete element | Exclusive lock                                       |

Notes:

- **ElementAspects** do not have their own locks. An [ElementAspect]($backend) is owned by its element, so inserting, updating, or deleting an aspect is governed by the **exclusive lock on the owning element** — acquire that lock before changing any of the element's aspects.
- These rules apply only to *direct* changes to Elements. *Indirect* changes made during change propagation (for example, from [ElementDrivesElement]($backend) relationships) do *not* require locks.
- The lock on a Model is really a lock on its modeled element, since they share the same Id.

### The Schema Lock

The "root" ElementId is the [IModel.repositoryModelId]($common). The exclusive lock on the root element is called the **Schema Lock**. It follows from the rules above that to obtain the Schema Lock, no other briefcase may be *holding any* locks; and while the Schema Lock is held, no other briefcase may *obtain any* locks. The Schema Lock is required to import a schema — see [Changesets and Schema Changes](#changesets-and-schema-changes).

### Releasing Locks

Locks are normally released when the briefcase pushes its changes via [BriefcaseDb.pushChanges]($backend), though they may optionally be retained via the `retainLocks` option. If locks are acquired but no changes were made, or all changes were abandoned, locks can be released manually via [LockControl.releaseAllLocks]($backend).

## Reservations

> Reservations are a `@beta` feature. See [IModelDb.reservations]($backend) and [SynchronousChannel.Reservations]($backend).

Locks solve the problem of concurrent edits to *existing* data, but they are a poor fit for a common collaboration pattern: several users independently adding the *same* shared element at the same time. Consider two briefcases that each need a `"Steel"` material or a `"Hidden"` line style that does not yet exist, or that each import the same component (a `RecipeDefinitionElement` and the template elements in its sub-model) from a catalog. Each would insert its own copy, producing either duplicate elements or a hard [Code]($common) uniqueness conflict on push. Forcing the two briefcases to serialize on a lock (or the Schema Lock) to avoid this defeats the goal of concurrent editing.

**Reservations** address this directly. A reservation is a small piece of shared bookkeeping — coordinated through [SchemaSync](#reservations-and-schemasync) — that agrees, ahead of time, on a single identity for a to-be-created element: one caller-supplied **[federation GUID](#concurrency-glossary)** and one pre-allocated **element id**. Once an element is reserved, any briefcase that inserts it will get that *same* id. Two users can therefore create "the same" category (or component template element) concurrently and end up with one shared element, not a conflict.

The rule is deliberately broad: ***any [Element]($backend) inserted with an explicitly-set `federationGuid` must first be reserved*** (when SchemaSync is enabled and the Schema Lock is not held). An element whose `federationGuid` is left unset is not affected — a briefcase-namespaced GUID is auto-generated for it that cannot collide with another briefcase's.

### Reservations vs. Locks

| | **Locks** | **Reservations** |
| --- | --- | --- |
| Protect against | Conflicting concurrent **modification** of existing elements | Conflicting concurrent **creation** of elements with a shared identity |
| Concurrency model | Pessimistic (serialize — one writer) | Cooperative (many briefcases create the *same* thing) |
| Applies to | Any model or element | Any [Element]($backend) inserted with an explicit `federationGuid` |
| Requirement | The iModel's pessimistic policy | [SchemaSync](#reservations-and-schemasync) is enabled |
| API | [BriefcaseDb.locks]($backend) | [IModelDb.reservations]($backend) |

The two are complementary, not alternatives. Inserting a reserved element still follows the normal locking rules for an insert (e.g. a shared lock on its Model — typically the dictionary model, [IModel.dictionaryId]($common), for shared definitions). Reservations remove the *identity* conflict; locks continue to govern the *change*.

### Reservations and SchemaSync

Reservations require the iModel to have **SchemaSync** enabled. SchemaSync maintains a shared cloud database (a `SchemaSyncDb`) alongside the iModel; the reservation bookkeeping lives there, and its cloud write-lock serializes concurrent reservation requests so that id allocation and [Code]($common) uniqueness are enforced atomically across all briefcases.

- When SchemaSync is **not** enabled, [IModelDb.reservations]($backend) is a no-op: [SynchronousChannel.Reservations.needsElementReservation]($backend) always returns `false` and element inserts behave exactly as before. No reservation is required or performed.
- When SchemaSync **is** enabled, inserts of elements with an explicitly-set `federationGuid` are validated against reservations (see [Inserting a reserved element](#inserting-a-reserved-element)).

Reservations are re-initialized automatically whenever a pull or push enables or disables SchemaSync for the briefcase.

### Reserving Elements

Call [SynchronousChannel.Reservations.reserveElements]($backend) with the elements you intend to create. The whole batch succeeds or fails together. Each entry supplies an explicit `federationGuid`, a `classFullName`, and an optional [CodeProps]($common):

- The `federationGuid` is the element's stable identity across briefcases and is **required** for every entry.
- The `code` is optional. When a non-empty `code.value` is supplied, it is stored and enforced to be unique across all reservations (early conflict detection). An empty Code is not subject to uniqueness.

```ts
// Reserve a shared line style before any briefcase inserts it.
const fedGuid = Guid.createValue();
await briefcase.reservations.reserveElements({
  elements: [{
    federationGuid: fedGuid,
    classFullName: LineStyle.classFullName,
    code: LineStyle.createCode(briefcase, IModel.dictionaryId, "Hidden"),
  }],
});
```

Reserving is **idempotent**: if two briefcases reserve the identical identity (same GUID, class, and code) concurrently, both converge on the one reservation. If two briefcases reserve the *same non-empty Code* for *different* federation GUIDs, the container enforces Code uniqueness and exactly one caller wins; the other's promise rejects with an [ElementReservationError]($common) (`reservation-conflict`).

Use [SynchronousChannel.Reservations.needsElementReservation]($backend) to check whether an element still needs to be reserved. Because of local caching, a `false` result only means the reservation was seen as of the last [SynchronousChannel.Reservations.reserveElements]($backend) call — it is not a hard guarantee against a concurrent reservation elsewhere; the container write-lock is the authority.

### Inserting a Reserved Element

Once reserved, insert the element normally. When SchemaSync is enabled and the insert carries an explicitly-set `federationGuid`, the [Element]($backend) insert hook resolves the reservation (by `federationGuid`) and:

- stamps the reserved **element id** onto the insert, so the element gets the same id in every briefcase;
- verifies the insert's class and Code match what was reserved.

```ts
await briefcase.locks.acquireLocks({ shared: IModel.dictionaryId });
const id = briefcase.elements.insertElement({
  classFullName: LineStyle.classFullName,
  model: IModel.dictionaryId,
  code: LineStyle.createCode(briefcase, IModel.dictionaryId, "Hidden"),
  federationGuid: fedGuid,
});
```

If SchemaSync is enabled and no matching reservation exists for the insert's `federationGuid`, the insert throws an [ElementReservationError]($common) (`reservation-not-found`): reserve the element first. Inserting under the Schema Lock bypasses reservation checks, since holding the Schema Lock already serializes all briefcases.

### Reservation Errors

Reservation and insert failures throw an [ElementReservationError]($common), whose `key` distinguishes the cause:

| Key                          | Meaning                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------------ |
| `invalid-reservation`        | Missing or malformed federation GUID, malformed Code, or unknown class.                          |
| `reservation-conflict`       | The requested element conflicts with an existing reservation (different class or Code).           |
| `reservation-not-found`      | No reservation exists for the element being inserted; reserve it first.                           |
| `container-has-local-changes`| The SchemaSync container has un-pushed local changes; the insert cannot be trusted yet.          |
| `id-sequence-exhausted`      | The pool of element ids available for reserved elements has been exhausted.                       |
| `corrupt-reservation-data`   | The persisted reservation bookkeeping is corrupt.                                                |

Use [ElementReservationError.isError]($common) to test for these, optionally passing a specific key.

## Using Locks and Reservations Together

A typical concurrent-editing session combines both mechanisms:

1. **Pull and merge** to synchronize with the tip.
1. **Reserve** any elements with a shared identity you plan to create with [SynchronousChannel.Reservations.reserveElements]($backend). This agrees on shared ids so other briefcases creating the same elements won't conflict.
1. **Lock** the models and elements you intend to modify (e.g. a shared lock on the dictionary model to insert reserved shared definitions, and the exclusive lock on any existing elements you will edit).
1. **Change** — insert the reserved elements and make your edits within a transaction, then [BriefcaseDb.saveChanges]($backend).
1. **Push** to iModelHub. Locks are released (unless retained); the reserved elements land with their agreed-upon ids.

Because reservations settle *identity* up front and locks serialize *modifications*, multiple users can add and reference the same shared elements while independently editing different parts of the iModel — all without conflicts.

## Changesets and Schema Changes

The Schema Lock must be acquired before importing a schema into a briefcase. Schema changes must also be isolated in a dedicated Changeset, separate from other kinds of changes. This is true regardless of whether reservations are in use. To import a schema, an app must:

1. Pull and merge to synchronize with the tip.
1. Push any local changes to iModelHub.
1. Obtain the Schema Lock.
1. Perform the schema import in a local transaction.
1. Push the results of the schema import as a Changeset to iModelHub.
1. Release the Schema Lock.
