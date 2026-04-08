# ECChangesetReader

`ECChangesetReader` is a low-level API in `@itwin/core-backend` that reads EC-typed change data from a changeset file, a group of changeset files, an in-memory transaction, or local un-pushed changes. It is designed for use cases where you need to inspect what changed at the EC property level — for example, building audit trails, incremental projections, or custom synchronization logic.

## Core concepts

### How change data is stored

iTwin.js stores changes at the SQLite table-row level. A single EC entity may typically map to multiple tables or single table. Each table row change is a separate entry in the changeset stream.

`ECChangesetReader` reads these raw table-row changes and emits one `ECNativeChangeInstance` per row. To reconstruct a complete, merged EC instance across all tables, pipe the reader into `ECNativePartialChangeUnifier`.

### The reader–unifier pipeline

```ts
using reader = ECChangesetReader.openFile({ db, fileName });
using pcu = new ECNativePartialChangeUnifier(ECNativeChangeUnifierCache.createInMemoryCache());

while (reader.step()) {
  pcu.appendFrom(reader);
}

for (const instance of pcu.instances) {
  console.log(instance.ECInstanceId, instance.$meta.op, instance.$meta.stage);
}
```

After draining the reader, `pcu.instances` yields one entry per (ECInstanceId + stage) pair, with properties merged across all contributing tables.

### `ECNativeChangeInstance` shape

Every instance has an `$meta` property plus the EC property bag:

```ts
interface ECNativeChangeMeta {
  op: "Inserted" | "Updated" | "Deleted";
  stage: "New" | "Old";
  tables: string[];          // SQLite tables that contributed rows
  changeIndexes: number[];   // stream positions of those rows
  nativeKey: string;         // ECInstanceId-ECClassId key used for merging
  mode: string;              // "All_Properties" | "Bis_Element_Properties" | "Instance_Key"
  changesetFetchedProps: Set<string>; // property names actually read from the changeset
  rowOptions?: object;       // the rowOptions passed when opening the reader
  isIndirectChange: boolean; // true when the change was applied indirectly
}
```

- `stage: "New"` → post-change value (insert or update-after)
- `stage: "Old"` → pre-change value (delete or update-before)
- An **insert** produces only a `"New"` instance.
- A **delete** produces only an `"Old"` instance.
- An **update** produces both a `"New"` and an `"Old"` instance.

### `changesetFetchedProps` — what actually changed

Each `ECNativeChangeInstance` carries a `changesetFetchedProps` set listing exactly which EC property names were fetched directly from the changeset binary (not from the live iModel). This is the ground truth for "what changed":

```ts
// Only trust props present in changesetFetchedProps to reflect the changeset delta.
// Other props on the instance may reflect the current live-iModel state.
const changedProps = instance.$meta.changesetFetchedProps;
if (changedProps.has("Category.Id")) {
  console.log("Category changed →", instance.Category);
}
```

---

## Opening a reader

### `openFile` — read a single pushed changeset file

```ts
import { ECChangesetReader, ECNativePartialChangeUnifier, ECNativeChangeUnifierCache } from "@itwin/core-backend";

const changesets = await iModelDb.pullChanges();
// or: const changesets = await HubMock.downloadChangesets({ iModelId, targetDir });

using reader = ECChangesetReader.openFile({
  db: iModelDb,
  fileName: changesets[1].pathname,
  rowOptions: { abbreviateBlobs: false }, // return full binary instead of { bytes: N }
});
using pcu = new ECNativePartialChangeUnifier(ECNativeChangeUnifierCache.createInMemoryCache());

while (reader.step())
  pcu.appendFrom(reader);

for (const instance of pcu.instances) {
  console.log(instance.$meta.op, instance.ECInstanceId, instance.$meta.stage);
}
```

### `openGroup` — read multiple changesets as a single stream

`openGroup` concatenates multiple changeset files into one logical stream. The unifier merges them across the whole group — an element that was inserted in changeset 1 and updated in changeset 2 surfaces as a single `"Inserted"` `"New"` instance reflecting its final state.

```ts
using reader = ECChangesetReader.openGroup({
  db: iModelDb,
  changesetFiles: [insertCs.pathname, updateCs.pathname],
  rowOptions: { abbreviateBlobs: false },
});
using pcu = new ECNativePartialChangeUnifier(ECNativeChangeUnifierCache.createInMemoryCache());

while (reader.step())
  pcu.appendFrom(reader);

// The merged instance for an insert+update pair will have:
//   $meta.op === "Inserted"  (because the first appearance was an insert)
//   $meta.tables = ["bis_Element", "bis_GeometricElement2d"]  (accumulated across both changesets)
//   properties reflect the final update values
```

### `openTxn` — read a saved (not yet pushed) local transaction

```ts
const txnId = iModelDb.txns.getLastSavedTxnProps()!.id;

using reader = ECChangesetReader.openTxn({ db: iModelDb, txnId });
using pcu = new ECNativePartialChangeUnifier(ECNativeChangeUnifierCache.createInMemoryCache());

while (reader.step())
  pcu.appendFrom(reader);

const instances = Array.from(pcu.instances);
const inserted = instances.find((i) => i.$meta.op === "Inserted");
```

### `openLocalChanges` — read all local un-pushed saved changes

```ts
using reader = ECChangesetReader.openLocalChanges({ db: iModelDb });
```

Pass `includeInMemoryChanges: true` to also include the in-memory (not yet saved) changes on top:

```ts
using reader = ECChangesetReader.openLocalChanges({
  db: iModelDb,
  includeInMemoryChanges: true,
});
```

### `openInMemoryChanges` — read only the in-memory (unsaved) changes

```ts
using reader = ECChangesetReader.openInMemoryChanges({ db: iModelDb });
```

---

## Mode — controlling which properties are returned

All `open*` methods accept a `mode` argument that controls which properties are included:

| Mode | Properties returned |
|---|---|
| `All_Properties` (default) | All EC properties mapped to changed tables |
| `Bis_Element_Properties` | For classes whose base class is `BisCore:Element` only `BisCore:Element` properties mapped to changed tables are returned. If no `BisCore:Element` class property is changed currently, only `ECInstanceId` and `ECClassId` is returned. For classes whose base class is not `BisCore:Element` all EC Properties mapped to changed tables are returned.|
| `Instance_Key` | Only `ECInstanceId` and `ECClassId` |

```ts
import { IModelJsNative } from "@bentley/imodeljs-native";

using reader = ECChangesetReader.openFile({
  db: iModelDb,
  fileName: changeset.pathname,
  mode: IModelJsNative.ECChangesetReader.Mode.Bis_Element_Properties,
  rowOptions: { classIdsToClassNames: true }, // combine with rowOptions for richer output
});
```

The active mode name is stored as a human-readable string in `instance.$meta.mode`:

```ts
assert.equal(instance.$meta.mode, "Bis_Element_Properties");
```

---

## Row options — formatting EC property values

`rowOptions` are passed to the native EC row adaptor and affect how property values are formatted:

| Option | Effect |
|---|---|
| `abbreviateBlobs: true` | Binary properties returned as `{ bytes: N }` instead of raw `Uint8Array` |
| `abbreviateBlobs: false` | Binary properties returned as full `Uint8Array` or `base64` strings in case of `GeometryStream` |
| `classIdsToClassNames: true` | `ECClassId` and `RelECClassId` values converted from hex strings to fully-qualified names (e.g. `"BisCore.DrawingModel"`) |
| `useJsName: true` | All property keys returned in camelCase (`id`, `className`, `lastMod`, etc.) and navigation property sub-keys as `{ id, relClassName }` instead of `{ Id, RelECClassId }` |

The active `rowOptions` object is stored on every instance's `$meta.rowOptions` for inspection.

### Example — `classIdsToClassNames`

```ts
using reader = ECChangesetReader.openFile({
  db: iModelDb,
  fileName: changeset.pathname,
  rowOptions: { classIdsToClassNames: true },
});
// ...
assert.equal(elem.ECClassId, "TestDomain.Test2dElement");
assert.deepEqual(elem.Category, { Id: categoryId, RelECClassId: "BisCore.GeometricElement2dIsInCategory" });
```

### Example — `useJsName`

```ts
using reader = ECChangesetReader.openTxn({
  db: iModelDb,
  txnId,
  rowOptions: { useJsName: true },
});
// ...
assert.equal(elem.id, elementId);           // ECInstanceId → id
assert.equal(elem.className, "TestDomain.Test2dElement"); // ECClassId → className
assert.deepEqual(elem.category, { id: categoryId, relClassName: "BisCore.GeometricElement2dIsInCategory" });
```

### Example — reading full binary blobs

```ts
using reader = ECChangesetReader.openFile({
  db: iModelDb,
  fileName: changeset.pathname,
  rowOptions: { abbreviateBlobs: false },
});
// ...
assert.deepEqual(elem.BinProp, new Uint8Array([1, 2, 3, 4]));
```

---

## Filtering — restricting which changes are yielded

After opening a reader (and before the first `step()` call) you can install one or more filters to narrow the change stream. Filters affect which instances are populated in `inserted` / `deleted` — **the reader still steps through every underlying row**, so `op`, `tableName`, `isECTable`, and `isIndirectChange` are always populated regardless of filters.

Three independent filter axes are available and can be combined:

| Priority | Method | Filters on |
|---|---|---|
| 1 | `setOpCodeFilters(ops)` | Change operation (`"Inserted"`, `"Updated"`, `"Deleted"`) |
| 2 | `setTableNameFilters(tableNames)` | SQLite table name of the row |
| 3 | `setClassIdFilters(classIds)` | EC class id of the instance |

Filters are applied in the priority order above. If the op-code filter rejects a row, the table and class-id filters are not evaluated. If the table filter rejects a row, the class-id filter is not evaluated.

Each setter accepts a `Set<>`. Passing an empty `Set` is equivalent to calling the corresponding `clear*` method.

### Example — only yield inserts and updates for a specific table

```ts
using reader = ECChangesetReader.openFile({ db, fileName: changeset.pathname });

reader.setTableNameFilters(new Set(["bis_Element"]));
reader.setOpCodeFilters(new Set(["Inserted", "Updated"]));

while (reader.step()) {
  if (reader.inserted) {
    // Only bis_Element rows with op Inserted or Updated reach here.
    console.log(reader.inserted.ECInstanceId, reader.inserted.$meta.op);
  }
  // reader.deleted is always undefined because "Deleted" was not included.
}
```

### Example — only yield changes for a known set of EC class ids

```ts
const classIds = new Set([physicalElementClassId, drawingElementClassId]);

using reader = ECChangesetReader.openFile({ db, fileName: changeset.pathname });
reader.setClassIdFilters(classIds);

while (reader.step()) {
  if (reader.inserted)
    console.log("class match →", reader.inserted.ECClassId);
}
```

### Clearing filters at runtime

All three filters can be cleared individually without reopening the reader:

```ts
reader.clearTableNameFilters();
reader.clearOpCodeFilters();
reader.clearClassIdFilters();
```

---

## Cache strategies

By default `ECNativePartialChangeUnifier` uses an in-memory cache (`Map`). For very large changesets that would exhaust memory, use the SQLite-backed cache instead:

```ts
using cache = ECNativeChangeUnifierCache.createSqliteBackedCache(iModelDb);
using pcu = new ECNativePartialChangeUnifier(cache);
```

---

## Complete worked example

The following example imports a custom schema, inserts an element, pushes a second update, and demonstrates reading each changeset independently and then together as a group:

```ts
import path from "path";
import {
  ECChangesetReader,
  ECNativePartialChangeUnifier,
  ECNativeChangeUnifierCache,
  IModelDb,
  HubWrappers,
  HubMock,
  DrawingCategory,
  IModelTestUtils,
} from "@itwin/core-backend";
import { Code, IModel, SubCategoryAppearance, ColorDef } from "@itwin/core-common";
import { Id64String } from "@itwin/core-bentley";

async function example(adminToken: string, iTwinId: string, outputDir: string) {
  // 1. Create/open briefcase
  const iModelId = await HubMock.createNewIModel({ iTwinId, iModelName: "demo", accessToken: adminToken });
  const db = await HubWrappers.downloadAndOpenBriefcase({ iTwinId, iModelId, accessToken: adminToken });

  // 2. Import schema with a binary and a string-array property
  const schema = `<?xml version="1.0" encoding="UTF-8"?>
  <ECSchema schemaName="Demo" alias="d" version="01.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
    <ECSchemaReference name="BisCore" version="01.00" alias="bis"/>
    <ECEntityClass typeName="Widget">
      <BaseClass>bis:GraphicalElement2d</BaseClass>
      <ECProperty propertyName="Payload" typeName="binary"/>
      <ECArrayProperty propertyName="Tags" typeName="string" minOccurs="0" maxOccurs="unbounded"/>
    </ECEntityClass>
  </ECSchema>`;
  await db.importSchemaStrings([schema]);
  db.channels.addAllowedChannel(/* sharedChannelName */);

  await db.locks.acquireLocks({ shared: IModel.dictionaryId });
  const [, modelId] = IModelTestUtils.createAndInsertDrawingPartitionAndModel(db, Code.createEmpty(), true);
  const catId = DrawingCategory.insert(db, IModel.dictionaryId, "DemoCat",
    new SubCategoryAppearance({ color: ColorDef.fromString("rgb(0,0,255)").toJSON() }));
  db.saveChanges("setup");
  await db.pushChanges({ description: "setup", accessToken: adminToken });

  // 3. Changeset 2 — insert
  await db.locks.acquireLocks({ shared: modelId });
  const elementId: Id64String = db.elements.insertElement({
    classFullName: "Demo:Widget",
    model: modelId,
    category: catId,
    code: Code.createEmpty(),
    Payload: new Uint8Array([0x01, 0x02, 0x03]),
    Tags: ["alpha", "beta"],
  } as any);
  db.saveChanges("insert widget");
  await db.pushChanges({ description: "insert widget", accessToken: adminToken });

  // 4. Changeset 3 — update
  await db.locks.acquireLocks({ exclusive: elementId });
  db.elements.updateElement({
    ...db.elements.getElementProps(elementId),
    Tags: ["alpha", "beta", "gamma"],
  } as any);
  db.saveChanges("update widget");
  await db.pushChanges({ description: "update widget", accessToken: adminToken });

  // 5. Download changesets
  const targetDir = path.join(outputDir, iModelId, "changesets");
  const changesets = await HubMock.downloadChangesets({ iModelId, targetDir });
  const [, insertCs, updateCs] = changesets; // [setup, insert, update]

  // 6. Read insert changeset individually
  {
    using reader = ECChangesetReader.openFile({
      db,
      fileName: insertCs.pathname,
      rowOptions: { abbreviateBlobs: false },
    });
    using pcu = new ECNativePartialChangeUnifier(ECNativeChangeUnifierCache.createInMemoryCache());
    while (reader.step()) pcu.appendFrom(reader);

    const elem = Array.from(pcu.instances).find(
      (i) => i.ECInstanceId === elementId && i.$meta.stage === "New"
    );
    // elem.$meta.op === "Inserted"
    // elem.Payload instanceof Uint8Array  → [1, 2, 3]
    // elem.Tags → ["alpha", "beta"]
    // elem.$meta.changesetFetchedProps.has("Tags") → true
    console.log("insert op:", elem?.$meta.op);
    console.log("insert Tags:", elem?.Tags);
  }

  // 7. Read update changeset individually
  {
    using reader = ECChangesetReader.openFile({
      db,
      fileName: updateCs.pathname,
      rowOptions: { abbreviateBlobs: false },
    });
    using pcu = new ECNativePartialChangeUnifier(ECNativeChangeUnifierCache.createInMemoryCache());
    while (reader.step()) pcu.appendFrom(reader);

    const instances = Array.from(pcu.instances);
    const elemNew = instances.find((i) => i.ECInstanceId === elementId && i.$meta.stage === "New");
    const elemOld = instances.find((i) => i.ECInstanceId === elementId && i.$meta.stage === "Old");
    // elemNew.Tags → ["alpha", "beta", "gamma"]
    // elemOld.Tags → ["alpha", "beta"]
    // elemNew.$meta.changesetFetchedProps.has("Tags") → true
    console.log("update new Tags:", elemNew?.Tags);
    console.log("update old Tags:", elemOld?.Tags);
  }

  // 8. Read both changesets as a group
  {
    using reader = ECChangesetReader.openGroup({
      db,
      changesetFiles: [insertCs.pathname, updateCs.pathname],
      rowOptions: { abbreviateBlobs: false },
    });
    using pcu = new ECNativePartialChangeUnifier(ECNativeChangeUnifierCache.createInMemoryCache());
    while (reader.step()) pcu.appendFrom(reader);

    const elem = Array.from(pcu.instances).find(
      (i) => i.ECInstanceId === elementId && i.$meta.stage === "New"
    );
    // op is "Inserted" because the first appearance across the group was an insert.
    // Final Tags value reflects the update (["alpha","beta","gamma"]).
    // tables accumulated: ["bis_Element", "bis_GeometricElement2d"]
    console.log("group op:", elem?.$meta.op);         // "Inserted"
    console.log("group final Tags:", elem?.Tags);      // ["alpha","beta","gamma"]
  }

  db.close();
}
```

---

## Out-of-sync iModel behaviour

> **See also:** the test suite `"ECChangesetReader: behaviour in case imodel is not in sync with change file or transaction being read"` in
> `core/backend/src/test/standalone/ECChangesetReader.test.ts`.

`ECChangesetReader` uses the **live iModel** in two ways: to resolve `ECClassId` in case it is not part of the changeset or transaction(very common in cases of `Update` because generally only element props are updated not the class of the instance), and to fill in the non-changed components of compound property values. For compound types — `Point2d`, `Point3d`, and navigation properties - when a changeset records a change to only one component, the reader must fetch the remaining components from the live iModel to reconstruct the full value. For example, if only `X` changes in a `Point2d` property, `Y` is read from the current live database state. This means the reader's output quality depends on the current state of the iModel — specifically whether the entity being read still exists in the database at the time of reading, and whether subsequent transactions have already modified the components that were not part of the recorded changeset delta.

Two concrete failure modes arise:

### 1. Deleted instance — class identity lost

**Scenario:** An element is inserted, updated, then deleted across three changesets. The update changeset (the "middle" one) is read **after** the element has already been deleted from the live iModel.

**What happens:** As in the update changeset obviously the ECClassId was not updated for the instance, only some properties might have been updated so `ECClassId` was not part of the changeset. So when the reader resolves the `ECClassId` for a row, it performs a lookup in the live iModel's table. Because the element no longer exists, the native layer cannot determine which leaf domain class the row belongs to. It falls back to the per-table base class (`BisCore.Element` for `bis_Element`, `BisCore.GeometricElement2d` for `bis_GeometricElement2d`). The per-table instances are **not merged** into a single `TestDomain.Test2dElement` instance; instead they appear as separate entries under their base-class identities.

```ts
// After push 2 (insert), push 3 (update), push 4 (delete):
// Reading the update changeset (push 3) AFTER the element has been deleted:

using reader = ECChangesetReader.openFile({
  db: iModelDb,          // iModel has already applied the delete
  fileName: updateChangeset.pathname,
  mode: IModelJsNative.ECChangesetReader.Mode.Instance_Key,
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

**Scenario:** Three transactions occur in sequence: T1 inserts an element with `s = {x:1.5, y:2.5}`, T2 updates `s.X` to `100`, T3 updates `s.Y` to `200`. Reading T2 via `openTxn` after T3 has already been saved.

**What happens:** Because `openTxn` fetches non-changed properties from the live database (which reflects T3), the `Old` and `New` stage values for properties *not* recorded in the changeset reflect the current live state, not the state at T2. In this example:

```ts
// After T1 (insert s={1.5,2.5}), T2 (s.X→100), T3 (s.Y→200), reading T2:

assert.deepEqual(elementOld.s, { X: 1.5, Y: 200 });  // Y is polluted from T3
assert.deepEqual(elementNew.s, { X: 100,  Y: 200 });  // Y is polluted from T3
```

`s.Y` reads `200` in both Old and New because the live iModel already has `200` and the T2 changeset only recorded the delta for `s.X`.

**Workaround:** Use `changesetFetchedProps` to identify which properties were sourced directly from the changeset and are therefore trustworthy:

```ts
// Only s.X was actually changed in T2:
expect(elementNew.$meta.changesetFetchedProps).to.include("s.X");
expect(elementNew.$meta.changesetFetchedProps).not.to.include("s.Y");

// So only trust s.X for the before/after comparison:
const oldX = elementOld.s.X; // 1.5 — correct
const newX = elementNew.s.X; // 100 — correct
// Do NOT compare s.Y from Old vs New — it was not part of this changeset.
```

### Summary

This scenario is not tied to the type of change being opened by the `ECChangesetReader` i.e. it doesnot depend on whether a change group or a changeset or a transaction is opened. It might happen when the iModel's state is not in sync with the change being read. In other words it might happen when the iModel's state is not **at** the change being read.

| Scenario | Risk | Mitigation |
|---|---|---|
| Reading a changeset after entity is deleted | `ECClassId` resolves to the per-table base class; rows are not merged into the leaf domain class | Read changesets before the entity is deleted from the live iModel |
| Reading a historical transaction after new transactions have been saved | Property values not recorded in that txn's changeset reflect the current live state, not the historical state | Filter trustworthy properties using `$meta.changesetFetchedProps` |
