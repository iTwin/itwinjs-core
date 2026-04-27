# ChangesetReader

[ChangesetReader]($backend) is a low-level API in `@itwin/core-backend` that reads EC-typed change data from a changeset file, a group of changeset files, an in-memory transaction, or local un-pushed changes. It is designed for use cases where you need to inspect what changed at the EC property level — for example, building audit trails, incremental projections, or custom synchronization logic.

## Core concepts

### How change data is stored

A single EC entity may typically map to multiple tables or a single table.

[ChangesetReader]($backend) reads these raw table-row changes and emits one [ChangeInstance]($backend) per row. To reconstruct a complete, merged EC instance across all tables, pipe the reader into [PartialChangeUnifier]($backend).

### The reader–unifier pipeline

[[include:ChangesetReader.BasicPipeline]]

After draining the reader, `pcu.instances` yields one entry per (ECInstanceId + stage) pair, with properties merged across all contributing tables.

### [ChangeInstance]($backend) shape

Every instance has an `$meta` property plus the EC property bag:

```ts
interface ChangeMeta {
  op: "Inserted" | "Updated" | "Deleted";
  stage: "New" | "Old";
  tables: string[];          // SQLite tables that contributed rows
  changeIndexes: number[];   // stream positions of those rows
  instanceKey: string;       // ECInstanceId-ECClassId key used for merging
  propFilter: PropertyFilter; // PropertyFilter.All | PropertyFilter.BisCoreElement | PropertyFilter.InstanceKey
  changeFetchedPropNames: string[]; // property names actually read from the change binary
  rowOptions?: RowFormatOptions; // the rowOptions passed when opening the reader
  isIndirectChange: boolean; // true when the change was applied indirectly
}
```

- `stage: "New"` → post-change value (insert or update-after)
- `stage: "Old"` → pre-change value (delete or update-before)
- An **insert** produces only a `"New"` instance.
- A **delete** produces only an `"Old"` instance.
- An **update** produces both a `"New"` and an `"Old"` instance.

### `changeFetchedPropNames` — what actually changed

Each [ChangeInstance]($backend) carries a `changeFetchedPropNames` array listing exactly which EC property names were fetched directly from the changeset binary (not from the live iModel). This is the ground truth for "what changed":

[[include:ChangesetReader.ChangeFetchedPropNames]]

#### Naming rules

The names in `changeFetchedPropNames` follow these rules based on the property kind:

| Property kind | Rule | Example |
|---|---|---|
| **Simple property** | EC property name as declared in the schema | `"LastMod"` |
| **Compound property** (`Point2d`, `Point3d`, navigation) — **all components changed** | Full property name | `"Origin"` |
| **Compound property** — **only some components changed** | Each changed component listed individually, using `.` as separator | `"Origin.X"`, `"Origin.Y"` (when only X and Y changed for a `Point3d` named `"Origin"`) |
| **Struct property member** | Always in `"StructProp.MemberName"` format | `"CustomStruct.Label"` |
| **Compound member inside a struct** — **all components changed** | `"StructProp.MemberName"` | `"CustomStruct.Myp2d"` |
| **Compound member inside a struct** — **only some components changed** | `"StructProp.MemberName.Component"` | `"CustomStruct.Myp2d.X"` (when only X changed for a `Point2d` property `"Myp2d"` inside struct `"CustomStruct"`) |

> **Note:** `changeFetchedPropNames` always contains the **original EC property names** (e.g. `"LastMod"`, `"Model.Id"`, `"StructProp.X"`) regardless of how `rowOptions` are configured. Even with `useJsName: true`, `changeFetchedPropNames.includes("LastMod")` is correct — **not** `includes("lastMod")`.

#### Null-valued properties — listed in `changeFetchedPropNames` but absent from the instance object

A property name can appear in `changeFetchedPropNames` yet be **absent as a key** on the [ChangeInstance]($backend) object. This happens when the stored value of that property in the changeset binary was `null` (e.g. a column whose value was never set, or a compound property such as `Point3d` where all components were `null`).

`changeFetchedPropNames` records every property that was **read from the binary** — regardless of whether the resulting value was null. The instance object, however, only carries keys for non-null values. The two are therefore complementary:

- **`changeFetchedPropNames`** tells you which properties were part of the changeset delta (including those that changed to or from `null`).
- **Presence as a key on the instance** tells you whether the resulting value was non-null.

A concrete example arises with a `Point3d` property. Insert the Point3d property but only partially (e.g. Y and Z without X). A subsequent update that sets all three components will record a `NULL`-to-non-null transition in the changeset binary. Reading that update changeset:

- The `"New"` instance **has** `Position`(Point3d property) as a key (non-null value).
- The `"Old"` instance does **not** have `Position` as a key (was NULL), but `"Position"` **is** listed in `changeFetchedPropNames` for both stages because the binary recorded the full transition.

[[include:ChangesetReader.NullValuedPoint3d]]

**Rule of thumb:** Use `changeFetchedPropNames` to determine *which* properties changed. Use `"propName" in instance` (or optional chaining) to distinguish "changed to/from a non-null value" from "changed to/from null".

---

## Disposal — always close the reader and unifier

[ChangesetReader]($backend) and [PartialChangeUnifier]($backend) both hold native resources (file handles, SQLite connections, memory allocations) that must be released when you are done. Failing to do so will leak native handles until the garbage collector eventually runs.

The preferred approach is the `using` declaration (TC39 Explicit Resource Management, available in TypeScript ≥ 5.2). Objects declared with `using` are automatically disposed at the end of the enclosing block — even if an exception is thrown:

```ts
{
  using reader = ChangesetReader.openFile({ db, fileName: changeset.pathname });
  using pcu = new PartialChangeUnifier(ChangeUnifierCache.createInMemoryCache());

  while (reader.step())
    pcu.appendFrom(reader);

  for (const instance of pcu.instances)
    console.log(instance.$meta.op, instance.ECInstanceId);
  // reader and pcu are disposed here automatically
}
```

If you cannot use `using` (e.g. the reader must cross async boundaries or live beyond the current block), call `[Symbol.dispose]()` explicitly in a `finally` block:

```ts
const reader = ChangesetReader.openFile({ db, fileName: changeset.pathname });
const pcu = new PartialChangeUnifier(ChangeUnifierCache.createInMemoryCache());
try {
  while (reader.step())
    pcu.appendFrom(reader);
  for (const instance of pcu.instances)
    console.log(instance.$meta.op, instance.ECInstanceId);
} finally {
  reader[Symbol.dispose]();
  pcu[Symbol.dispose]();
}
```

> **Important:** The same rule applies to [ChangeCache]($backend) instances created via [ChangeUnifierCache.createSqliteBackedCache]($backend) — they wrap a SQLite connection and must also be disposed.

---

## Opening a reader

### [ChangesetReader.openFile]($backend) — read a single pushed changeset file

[[include:ChangesetReader.BasicPipeline]]

### [ChangesetReader.openGroup]($backend) — read multiple changesets as a single stream

[ChangesetReader.openGroup]($backend) concatenates multiple changeset files into one logical stream. The unifier merges them across the whole group — an element that was inserted in changeset 1 and updated in changeset 2 surfaces as a single `"Inserted"` `"New"` instance reflecting its final state.

[[include:ChangesetReader.OpenGroup]]

### [ChangesetReader.openTxn]($backend) — read a saved (not yet pushed) local transaction

[[include:ChangesetReader.OpenTxn]]

### [ChangesetReader.openLocalChanges]($backend) — read all local un-pushed saved changes

[[include:ChangesetReader.OpenLocalChanges]]

Pass `includeInMemoryChanges: true` to also include the in-memory (not yet saved) changes on top:

[[include:ChangesetReader.OpenLocalChangesIncludeInMemory]]

### [ChangesetReader.openInMemoryChanges]($backend) — read only the in-memory (unsaved) changes

[[include:ChangesetReader.OpenInMemoryChanges]]

---

## Property filter — controlling which properties are returned

All `open*` methods accept a `propFilter` argument that controls which properties are included:

| Filter | Properties returned |
|---|---|
| `All` (default) | All EC properties mapped to changed tables |
| `BisCoreElement` | For classes whose base class is `BisCore:Element` only `BisCore:Element` properties mapped to changed tables are returned. If no `BisCore:Element` class property is changed currently, only `ECInstanceId` and `ECClassId` is returned. For classes whose base class is not `BisCore:Element` all EC Properties mapped to changed tables are returned.|
| `InstanceKey` | Only `ECInstanceId` and `ECClassId` |

[[include:ChangesetReader.ModeInstanceKey]]

The active filter is stored as a `PropertyFilter` enum value in `instance.$meta.propFilter`:

```ts
assert.strictEqual(instance.$meta.propFilter, PropertyFilter.InstanceKey);
```

---

## Row options — formatting EC property values

`rowOptions` are passed to the native EC row adaptor and affect how property values are formatted:

| Option | Effect |
|---|---|
| `abbreviateBlobs: true` (or omitted) | Binary properties summarized as `{ bytes: N }` — this is the default behavior |
| `abbreviateBlobs: false` | Binary properties returned as full `Uint8Array` instead of the default `{ bytes: N }` summary |
| `classIdsToClassNames: true` | `ECClassId` and `RelECClassId` values converted from hex strings to fully-qualified names (e.g. `"BisCore.DrawingModel"`) |
| `useJsName: true` | All property keys and struct sub-keys returned in camelCase (`id`, `className`, `lastMod`, `structProp.x`, etc.). Navigation property sub-keys use `{ id, relClassName }` instead of `{ Id, RelECClassId }`. `ECClassId` and nav-prop class identifiers are automatically resolved to class names. |

The active `rowOptions` object is stored on every instance's `$meta.rowOptions` for inspection.

### Example — `classIdsToClassNames`

[[include:ChangesetReader.RowOptionsClassNames]]

### Example — `useJsName`

[[include:ChangesetReader.UseJsName]]

### Example — reading full binary blobs

[[include:ChangesetReader.RowOptionsAbbreviateBlobs]]

---

## `changeFetchedPropNames` always uses original EC property names

`$meta.changeFetchedPropNames` always contains the **original EC property names** regardless of any `rowOptions` in effect. The `useJsName` row option renames the keys on the returned instance object to use JS names, but it does **not** affect the names stored in `changeFetchedPropNames`.

This means you must always check `changeFetchedPropNames` using the schema-level EC property name, not the JS name:

[[include:ChangesetReader.UseJsNameAndChangeFetchedPropNames]]

In short: use `useJsName` names when reading property values off the instance, but always use the original EC schema names when querying `changeFetchedPropNames`.

---

## Filtering — restricting which changes are yielded

After opening a reader (and before the first [ChangesetReader.step]($backend) call) you can install one or more filters to narrow the change stream. When a row does not match an active filter it is **skipped entirely** — the reader automatically advances to the next row.

Three independent filter axes are available and can be combined:

| Priority | Method | Filters on |
|---|---|---|
| 1 | [ChangesetReader.setOpCodeFilters]($backend) | Change operation (`"Inserted"`, `"Updated"`, `"Deleted"`) |
| 2 | [ChangesetReader.setTableNameFilters]($backend) | SQLite table name of the row in proper case |
| 3 | [ChangesetReader.setClassNameFilters]($backend) | EC class name of the instance (format: `"SchemaName:ClassName"`) in proper case |

Filters are applied in the priority order above. If the op-code filter rejects a row, the table and class-name filters are not evaluated. If the table filter rejects a row, the class-name filter is not evaluated.

Each setter accepts a `Set<>`. Passing an empty `Set` is equivalent to calling the corresponding `clear*` method.

### Example — only yield inserts and updates for a specific table

[[include:ChangesetReader.FilterTable]]

### Example — only yield changes for a known set of EC class names

[[include:ChangesetReader.FilterClassNames]]

### Clearing filters at runtime

All three filters can be cleared individually without reopening the reader:

```ts
reader.clearTableNameFilters();
reader.clearOpCodeFilters();
reader.clearClassNameFilters();
```

---

## Cache strategies

By default [PartialChangeUnifier]($backend) uses an in-memory cache (`Map`). For very large changesets that would exhaust memory, use the SQLite-backed cache instead:

[[include:ChangesetReader.CacheStrategies]]

---

## Complete worked example

The following example imports a custom schema, inserts an element, pushes a second update, and demonstrates reading each changeset independently and then together as a group:

[[include:ChangesetReader.WorkedExample]]

---

## Out-of-sync iModel behaviour

> **See also:** the test suite `"ChangesetReader: behaviour in case imodel is not in sync with change file or transaction being read"` in
> `core/backend/src/test/standalone/ChangesetReader.test.ts`.

[ChangesetReader]($backend) uses the **live iModel** in two ways: to resolve `ECClassId` in case it is not part of the changeset or transaction(very common in cases of `Update` because generally only element props are updated not the class of the instance), and to fill in the non-changed components of compound property values. For compound types — `Point2d`, `Point3d`, and navigation properties - when a changeset records a change to only one component, the reader must fetch the remaining components from the live iModel to reconstruct the full value. For example, if only `X` changes in a `Point2d` property, `Y` is read from the current live database state. This means the reader's output quality depends on the current state of the iModel — specifically whether the entity being read still exists in the database at the time of reading, and whether subsequent transactions have already modified the components that were not part of the recorded changeset delta.

Two concrete failure modes arise:

### 1. Deleted instance — class identity lost

**Scenario:** An element is inserted, updated, then deleted across three changesets. The update changeset (the "middle" one) is read **after** the element has already been deleted from the live iModel.

**What happens:** As in the update changeset obviously the ECClassId was not updated for the instance, only some properties might have been updated so `ECClassId` was not part of the changeset. So when the reader resolves the `ECClassId` for a row, it performs a lookup in the live iModel's table. Because the element no longer exists, the native layer cannot determine which leaf domain class the row belongs to. It falls back to the per-table base class (`BisCore.Element` for `bis_Element`, `BisCore.GeometricElement2d` for `bis_GeometricElement2d`). The per-table instances are **not merged** into a single `TestDomain.Test2dElement` instance; instead they appear as separate entries under their base-class identities.

```ts
// After push 2 (insert), push 3 (update), push 4 (delete):
// Reading the update changeset (push 3) AFTER the element has been deleted:

using reader = ChangesetReader.openFile({
  db: iModelDb,          // iModel has already applied the delete
  fileName: updateChangeset.pathname,
  propFilter: PropertyFilter.InstanceKey,
  rowOptions: { classIdsToClassNames: true },
});
// ...
// Expected (if in sync): one merged instance with ECClassId "TestDomain.Test2dElement"
// Actual (out of sync):  two separate instances:
//   { ECClassId: "BisCore.Element",              stage: "New" }
//   { ECClassId: "BisCore.GeometricElement2d",   stage: "New" }
//   { ECClassId: "BisCore.Element",              stage: "Old" }
//   { ECClassId: "BisCore.GeometricElement2d",   stage: "Old" }
```

**Rule of thumb:** To read a changeset reliably, the iModel's current state should be **at** the change being read or the consumers of the api must be sure that, the instance was not deleted and for the compound properties of the instance like `Point2d`, `Point3d` or `NavProps`, no change was done to them subsequently after. In practice this means: read changesets in order and keep the iModel at the point being inspected.

### 2. Subsequent unsaved transaction pollutes property values

**Scenario:** Three transactions occur in sequence: T1 inserts an element with `s = {x:1.5, y:2.5}`, T2 updates `s.X` to `100`, T3 updates `s.Y` to `200`. Reading T2 via [ChangesetReader.openTxn]($backend) after T3 has already been saved.

**What happens:** Because [ChangesetReader.openTxn]($backend) fetches non-changed properties from the live database (which reflects T3), the `Old` and `New` stage values for properties *not* recorded in the changeset reflect the current live state, not the state at T2. In this example:

```ts
// After T1 (insert s={1.5,2.5}), T2 (s.X→100), T3 (s.Y→200), reading T2:

assert.deepEqual(elementOld.s, { X: 1.5, Y: 200 });  // Y is polluted from T3
assert.deepEqual(elementNew.s, { X: 100,  Y: 200 });  // Y is polluted from T3
```

`s.Y` reads `200` in both Old and New because the live iModel already has `200` and the T2 changeset only recorded the delta for `s.X`.

**Workaround:** Use `changeFetchedPropNames` to identify which properties were sourced directly from the changeset and are therefore trustworthy:

```ts
// Only s.X was actually changed in T2:
expect(elementNew.$meta.changeFetchedPropNames).to.include("s.X");
expect(elementNew.$meta.changeFetchedPropNames).not.to.include("s.Y");

// So only trust s.X for the before/after comparison:
const oldX = elementOld.s.X; // 1.5 — correct
const newX = elementNew.s.X; // 100 — correct
// Do NOT compare s.Y from Old vs New — it was not part of this changeset.
```

### Summary

It doesnot depend on whether a change group or a changeset or a transaction is opened. It might happen when the iModel's state is not in sync with the change being read. In other words it might happen when the iModel's state is not **at** the change being read.

| Scenario | Risk | Mitigation |
|---|---|---|
| Reading a changeset after entity is deleted | `ECClassId` resolves to the per-table base class; rows are not merged into the leaf domain class | Read changesets before the entity is deleted from the live iModel |
| Reading a historical transaction after new transactions have been saved | Property values not recorded in that txn's changeset reflect the current live state, not the historical state | Filter trustworthy properties using `$meta.changeFetchedPropNames` |
