/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as path from "path";
import {
  BriefcaseDb,
  ChannelControl,
  DrawingCategory,
  PropertyFilter,
  ECChangesetReader,
  EditTxn,
  PartialChangeUnifier,
  ChangeUnifierCache,
} from "@itwin/core-backend";
import { IModelTestUtils as BackendTestUtils, HubWrappers } from "@itwin/core-backend/lib/cjs/test/IModelTestUtils";
import { HubMock } from "@itwin/core-backend/lib/cjs/internal/HubMock";
import { Code, ColorDef, IModel, SubCategoryAppearance } from "@itwin/core-common";
import { Id64String } from "@itwin/core-bentley";
import { KnownTestLocations } from "./IModelTestUtils";


function startTestTxn(iModel: BriefcaseDb, description = "changeset reader"): EditTxn {
  const txn = new EditTxn(iModel, description);
  txn.start();
  return txn;
}

async function importSchemaStrings(txn: EditTxn, schemas: string[]): Promise<void> {
  if (txn.isActive)
    txn.saveChanges();
  await txn.iModel.importSchemaStrings(schemas);
}

describe("ECChangesetReader Examples", () => {
  let db: BriefcaseDb;
  let txn: EditTxn;
  let insertChangesetPath: string;
  let updateChangesetPath: string;
  let elementId: Id64String;
  let modelId: Id64String;
  let categoryId: Id64String;

  const adminToken = "super manager token";

  before(async () => {
    HubMock.startup("ECChangesetReaderExamples", KnownTestLocations.outputDir);
    const iTwinId = HubMock.iTwinId;

    const iModelId = await HubMock.createNewIModel({
      iTwinId,
      iModelName: "ECChangesetReaderExamples",
      accessToken: adminToken,
    });
    db = await HubWrappers.downloadAndOpenBriefcase({ iTwinId, iModelId, accessToken: adminToken });
    txn = startTestTxn(db, "ECChangesetReader examples setup");
    // Import a simple schema
    const schema = `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="ExSnippets" alias="es" version="01.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
      <ECSchemaReference name="BisCore" version="01.00" alias="bis"/>
      <ECEntityClass typeName="Widget">
        <BaseClass>bis:GraphicalElement2d</BaseClass>
        <ECProperty propertyName="Label" typeName="string"/>
        <ECArrayProperty propertyName="Tags" typeName="string" minOccurs="0" maxOccurs="unbounded"/>
      </ECEntityClass>
    </ECSchema>`;
    await importSchemaStrings(txn, [schema]);
    db.channels.addAllowedChannel(ChannelControl.sharedChannelName);

    // Changeset 1 — setup (model + category)
    await db.locks.acquireLocks({ shared: IModel.dictionaryId });
    [, modelId] = BackendTestUtils.createAndInsertDrawingPartitionAndModel(txn, Code.createEmpty(), true);
    categoryId = DrawingCategory.insert(txn, IModel.dictionaryId, "WidgetCat",
      new SubCategoryAppearance({ color: ColorDef.fromString("rgb(0,128,255)").toJSON() }));
    txn.saveChanges("setup");
    await db.pushChanges({ description: "setup", accessToken: adminToken });

    // Changeset 2 — insert widget
    await db.locks.acquireLocks({ shared: modelId });
    elementId = txn.insertElement({
      classFullName: "ExSnippets:Widget",
      model: modelId,
      category: categoryId,
      code: Code.createEmpty(),
      Label: "first", // eslint-disable-line @typescript-eslint/naming-convention
      Tags: ["alpha", "beta"], // eslint-disable-line @typescript-eslint/naming-convention
    } as any);
    txn.saveChanges("insert widget");
    await db.pushChanges({ description: "insert widget", accessToken: adminToken });

    // Changeset 3 — update widget
    await db.locks.acquireLocks({ exclusive: elementId });
    txn.updateElement({
      ...db.elements.getElementProps(elementId),
      Tags: ["alpha", "beta", "gamma"], // eslint-disable-line @typescript-eslint/naming-convention
    });
    txn.saveChanges("update widget");
    await db.pushChanges({ description: "update widget", accessToken: adminToken });

    // Download changesets so we have their paths
    const targetDir = path.join(KnownTestLocations.outputDir, iModelId, "changesets");
    const changesets = await HubMock.downloadChangesets({ iModelId, targetDir });
    // changesets[0] = setup, changesets[1] = insert, changesets[2] = update
    insertChangesetPath = changesets[1].pathname;
    updateChangesetPath = changesets[2].pathname;
  });

  after(() => {
    txn.end();
    db.close();
    HubMock.shutdown();
  });

  it("basic reader–unifier pipeline", () => {
    // __PUBLISH_EXTRACT_START__ ECChangesetReader.BasicPipeline
    using reader = ECChangesetReader.openFile({ db, fileName: insertChangesetPath });
    using pcu = new PartialChangeUnifier(ChangeUnifierCache.createInMemoryCache());

    while (reader.step()) {
      pcu.appendFrom(reader);
    }

    for (const instance of pcu.instances) {
      expect(instance.ECInstanceId).to.exist;
      expect(instance.$meta.op).to.exist;
      expect(instance.$meta.stage).to.exist;

    }
    // __PUBLISH_EXTRACT_END__
  });

  it("openGroup — multiple changesets as one stream", () => {
    // __PUBLISH_EXTRACT_START__ ECChangesetReader.OpenGroup
    // openGroup merges insert + update into a single logical stream.
    // An element inserted in the first changeset and updated in the second
    // surfaces as a single "Inserted" instance reflecting its final state.
    using reader = ECChangesetReader.openGroup({
      db,
      changesetFiles: [insertChangesetPath, updateChangesetPath],
    });
    using pcu = new PartialChangeUnifier(ChangeUnifierCache.createInMemoryCache());

    while (reader.step()) {
      pcu.appendFrom(reader);
    }

    for (const instance of pcu.instances) {
      if (instance.$meta.stage === "New") {
        // op is "Inserted" because the first appearance across the group was an insert
        expect(instance.$meta.op).to.exist;
        expect(instance.ECInstanceId).to.exist;
      }
    }
    // __PUBLISH_EXTRACT_END__
  });

  it("filter by table and op-code", () => {
    // __PUBLISH_EXTRACT_START__ ECChangesetReader.FilterTable
    using reader = ECChangesetReader.openFile({ db, fileName: insertChangesetPath });

    reader.setTableNameFilters(new Set(["bis_Element"]));
    reader.setOpCodeFilters(new Set(["Inserted", "Updated"]));

    while (reader.step()) {
      if (reader.inserted) {
        // Only bis_Element rows with op Inserted or Updated reach here.
        // Rows that do not match the active filters are skipped entirely —
        // the reader automatically advances to the next row.
        expect(reader.inserted.ECInstanceId).to.exist;
        expect(reader.inserted.$meta.op).to.exist;
      }
      // reader.deleted is always undefined because "Deleted" was not included.
    }
    // __PUBLISH_EXTRACT_END__
  });

  it("filter by EC class name", () => {
    // __PUBLISH_EXTRACT_START__ ECChangesetReader.FilterClassNames
    // Restrict the stream to a known set of EC class names (full "SchemaName:ClassName" format).
    // Rows for any other class are skipped entirely.
    const classNames = new Set(["ExSnippets:Widget"]);

    using reader = ECChangesetReader.openFile({ db, fileName: insertChangesetPath });
    reader.setClassNameFilters(classNames);

    while (reader.step()) {
      if (reader.inserted)
        expect(reader.inserted.ECClassId).to.exist;
    }
    // __PUBLISH_EXTRACT_END__
  });

  it("rowOption classIdsToClassNames", () => {
    // __PUBLISH_EXTRACT_START__ ECChangesetReader.RowOptionsClassNames
    using reader = ECChangesetReader.openFile({
      db,
      fileName: insertChangesetPath,
      rowOptions: { classIdsToClassNames: true },
    });
    using pcu = new PartialChangeUnifier(ChangeUnifierCache.createInMemoryCache());
    while (reader.step()) pcu.appendFrom(reader);

    for (const instance of pcu.instances) {
      // ECClassId is now a fully-qualified name instead of a hex string
      expect(instance.ECClassId).to.exist; // e.g. "ExSnippets.Widget"
      // Navigation property class identifiers are also resolved:
      // instance.Category → { Id: "0x...", RelECClassId: "BisCore.GeometricElement2dIsInCategory" }
    }
    // __PUBLISH_EXTRACT_END__
  });

  it("rowOption useJsName and changeFetchedPropNames uses original EC names", () => {
    // __PUBLISH_EXTRACT_START__ ECChangesetReader.UseJsNameAndChangeFetchedPropNames
    using reader = ECChangesetReader.openFile({
      db,
      fileName: insertChangesetPath,
      rowOptions: { useJsName: true }, // property keys are camelCase
    });
    using pcu = new PartialChangeUnifier(ChangeUnifierCache.createInMemoryCache());
    while (reader.step()) pcu.appendFrom(reader);

    for (const instance of pcu.instances) {
      // Property keys on the instance object use JS names (camelCase):
      expect(instance.id).to.exist;           // ECInstanceId → id
      expect(instance.className).to.exist;    // ECClassId → className (resolved)

      // changeFetchedPropNames always stores the original EC schema names,
      // regardless of useJsName. Always query it with the schema-level name:
      const changed = instance.$meta.changeFetchedPropNames;
      if (changed.includes("Tags"))       // ✅ original EC name — correct
        expect(instance.tags).to.exist;
      // changed.includes("tags")         // ❌ never true — JS name is wrong here
    }
    // __PUBLISH_EXTRACT_END__
  });

  it("rowOption abbreviateBlobs false — full binary values", () => {
    // __PUBLISH_EXTRACT_START__ ECChangesetReader.RowOptionsAbbreviateBlobs
    using reader = ECChangesetReader.openFile({
      db,
      fileName: insertChangesetPath,
      rowOptions: { abbreviateBlobs: false }, // return full Uint8Array instead of { bytes: N }
    });
    using pcu = new PartialChangeUnifier(ChangeUnifierCache.createInMemoryCache());
    while (reader.step()) pcu.appendFrom(reader);

    for (const instance of pcu.instances) {
      // Binary properties are now returned as full Uint8Array values
      if (instance.GeometryStream instanceof Uint8Array)
        expect(instance.GeometryStream.byteLength).to.be.greaterThan(0);
    }
    // __PUBLISH_EXTRACT_END__
  });

  it("changeFetchedPropNames — trusting only what the changeset recorded", () => {
    // __PUBLISH_EXTRACT_START__ ECChangesetReader.ChangeFetchedPropNames
    using reader = ECChangesetReader.openFile({ db, fileName: updateChangesetPath });
    using pcu = new PartialChangeUnifier(ChangeUnifierCache.createInMemoryCache());
    while (reader.step()) pcu.appendFrom(reader);

    for (const instance of pcu.instances) {
      if (instance.ECInstanceId !== elementId) continue;

      const changedProps = instance.$meta.changeFetchedPropNames; // string[]
      // Only properties listed here were read directly from the changeset binary.
      // Other properties on the instance may reflect the current live-iModel state.
      if (changedProps.includes("Tags"))
        expect(instance.Tags).to.exist;
    }
    // __PUBLISH_EXTRACT_END__

    // Basic sanity check
    const instances = Array.from(pcu.instances);
    const widgetNew = instances.find(
      (i) => i.ECInstanceId === elementId && i.$meta.stage === "New",
    );
    expect(widgetNew).to.exist;
    expect(widgetNew!.$meta.changeFetchedPropNames).to.include("Tags");
  });

  it("openTxn — read a saved transaction", () => {
    const txnProps = db.txns.getLastSavedTxnProps();
    if (!txnProps) return; // no saved txns available in current db state
    const txnId = txnProps.id;

    // __PUBLISH_EXTRACT_START__ ECChangesetReader.OpenTxn
    using reader = ECChangesetReader.openTxn({ db, txnId });
    using pcu = new PartialChangeUnifier(ChangeUnifierCache.createInMemoryCache());
    while (reader.step()) pcu.appendFrom(reader);

    const instances = Array.from(pcu.instances);
    const changed = instances.find((i) => i.$meta.stage === "New");
    // __PUBLISH_EXTRACT_END__
    void changed;
  });

  it("useJsName row option", () => {
    // __PUBLISH_EXTRACT_START__ ECChangesetReader.UseJsName
    using reader = ECChangesetReader.openFile({
      db,
      fileName: insertChangesetPath,
      rowOptions: { useJsName: true },
    });
    using pcu = new PartialChangeUnifier(ChangeUnifierCache.createInMemoryCache());
    while (reader.step()) pcu.appendFrom(reader);

    for (const instance of pcu.instances) {
      // Property keys on the instance use camelCase JS names:
      expect(instance.id).to.exist;        // ECInstanceId → id
      expect(instance.className).to.exist; // ECClassId → className (resolved to full class name)
      // Navigation property sub-keys also use camelCase:
      // instance.category → { id: "0x...", relClassName: "BisCore.GeometricElement2dIsInCategory" }
      // Array property names are also camelCased:
      // instance.tags → ["alpha", "beta"]  (Tags → tags)
    }
    // __PUBLISH_EXTRACT_END__
  });

  it("Instance_Key mode — only ECInstanceId and ECClassId", () => {
    // __PUBLISH_EXTRACT_START__ ECChangesetReader.ModeInstanceKey
    using reader = ECChangesetReader.openFile({
      db,
      fileName: insertChangesetPath,
      propFilter: PropertyFilter.InstanceKey,
      rowOptions: { classIdsToClassNames: true },
    });
    using pcu = new PartialChangeUnifier(ChangeUnifierCache.createInMemoryCache());
    while (reader.step()) pcu.appendFrom(reader);

    for (const instance of pcu.instances) {
      // Only ECInstanceId and ECClassId are populated — all other properties are absent
      expect(instance.$meta.op).to.exist;
      expect(instance.ECInstanceId).to.exist;
      expect(instance.ECClassId).to.exist;
    }
    // __PUBLISH_EXTRACT_END__
  });

  it("SQLite-backed cache for large changesets", () => {
    // __PUBLISH_EXTRACT_START__ ECChangesetReader.CacheStrategies
    using cache = ChangeUnifierCache.createSqliteBackedCache();
    using pcu = new PartialChangeUnifier(cache);
    using reader = ECChangesetReader.openFile({ db, fileName: insertChangesetPath });
    while (reader.step()) pcu.appendFrom(reader);
    for (const instance of pcu.instances) {
      expect(instance.ECInstanceId).to.exist;
      expect(instance.$meta.op).to.exist;
    }
    // __PUBLISH_EXTRACT_END__
  });

  it("openLocalChanges — read local saved changes", async () => {
    await db.locks.acquireLocks({ shared: modelId });
    elementId = txn.insertElement({
      classFullName: "ExSnippets:Widget",
      model: modelId,
      category: categoryId,
      code: Code.createEmpty(),
      Label: "second", // eslint-disable-line @typescript-eslint/naming-convention
      Tags: ["alpha", "beta"], // eslint-disable-line @typescript-eslint/naming-convention
    } as any);
    txn.saveChanges("insert second widget");
    // __PUBLISH_EXTRACT_START__ ECChangesetReader.OpenLocalChanges
    using reader = ECChangesetReader.openLocalChanges({ db });
    using pcu = new PartialChangeUnifier(ChangeUnifierCache.createInMemoryCache());
    while (reader.step()) pcu.appendFrom(reader);
    for (const instance of pcu.instances) {
      expect(instance.ECInstanceId).to.exist;
      expect(instance.$meta.op).to.exist;
    }
    // __PUBLISH_EXTRACT_END__

    // __PUBLISH_EXTRACT_START__ ECChangesetReader.OpenLocalChangesIncludeInMemory
    // Pass includeInMemoryChanges: true to also include the in-memory (not yet saved) changes:
    using reader2 = ECChangesetReader.openLocalChanges({ db, includeInMemoryChanges: true });
    // __PUBLISH_EXTRACT_END__
    void reader2;
  });

  it("openInMemoryChanges — read in-memory changes", async () => {
    await db.locks.acquireLocks({ shared: modelId });
    elementId = txn.insertElement({
      classFullName: "ExSnippets:Widget",
      model: modelId,
      category: categoryId,
      code: Code.createEmpty(),
      Label: "third", // eslint-disable-line @typescript-eslint/naming-convention
      Tags: ["alpha", "beta"], // eslint-disable-line @typescript-eslint/naming-convention
    } as any);
    // __PUBLISH_EXTRACT_START__ ECChangesetReader.OpenInMemoryChanges
    using reader = ECChangesetReader.openInMemoryChanges({ db });
    // __PUBLISH_EXTRACT_END__
    void reader;
  });
});

describe("ECChangesetReader Examples — complete worked example", () => {
  const adminToken = "super manager token";

  before(() => HubMock.startup("ECChangesetReaderWorkedEx", KnownTestLocations.outputDir));
  after(() => HubMock.shutdown());

  it("complete worked example", async () => {
    // __PUBLISH_EXTRACT_START__ ECChangesetReader.WorkedExample
    const iTwinId = HubMock.iTwinId;

    // 1. Create and open a briefcase
    const iModelId = await HubMock.createNewIModel({ iTwinId, iModelName: "demo", accessToken: adminToken });
    const db = await HubWrappers.downloadAndOpenBriefcase({ iTwinId, iModelId, accessToken: adminToken });
    const txn = startTestTxn(db, "ECChangesetReader worked example setup");

    // 2. Import a schema with a binary and a string-array property
    const schema = `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="Demo" alias="d" version="01.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
      <ECSchemaReference name="BisCore" version="01.00" alias="bis"/>
      <ECEntityClass typeName="Widget">
        <BaseClass>bis:GraphicalElement2d</BaseClass>
        <ECProperty propertyName="Payload" typeName="binary"/>
        <ECArrayProperty propertyName="Tags" typeName="string" minOccurs="0" maxOccurs="unbounded"/>
      </ECEntityClass>
    </ECSchema>`;
    await importSchemaStrings(txn, [schema]);
    db.channels.addAllowedChannel(ChannelControl.sharedChannelName);

    // 3. Push changeset 1 — model and category setup
    await db.locks.acquireLocks({ shared: IModel.dictionaryId });
    const [, modelId] = BackendTestUtils.createAndInsertDrawingPartitionAndModel(txn, Code.createEmpty(), true);
    const catId = DrawingCategory.insert(txn, IModel.dictionaryId, "DemoCat",
      new SubCategoryAppearance({ color: ColorDef.fromString("rgb(0,0,255)").toJSON() }));
    txn.saveChanges("setup");
    await db.pushChanges({ description: "setup", accessToken: adminToken });

    // 4. Push changeset 2 — insert widget
    await db.locks.acquireLocks({ shared: modelId });
    const elementId: Id64String = txn.insertElement({
      classFullName: "Demo:Widget",
      model: modelId,
      category: catId,
      code: Code.createEmpty(),
      Payload: new Uint8Array([0x01, 0x02, 0x03]), // eslint-disable-line @typescript-eslint/naming-convention
      Tags: ["alpha", "beta"], // eslint-disable-line @typescript-eslint/naming-convention
    } as any);
    txn.saveChanges("insert widget");
    await db.pushChanges({ description: "insert widget", accessToken: adminToken });

    // 5. Push changeset 3 — update widget
    await db.locks.acquireLocks({ exclusive: elementId });
    txn.updateElement({
      ...db.elements.getElementProps(elementId),
      Tags: ["alpha", "beta", "gamma"], // eslint-disable-line @typescript-eslint/naming-convention
    });
    txn.saveChanges("update widget");
    await db.pushChanges({ description: "update widget", accessToken: adminToken });

    // 6. Download the pushed changesets
    const targetDir = path.join(KnownTestLocations.outputDir, iModelId, "changesets");
    const changesets = await HubMock.downloadChangesets({ iModelId, targetDir });
    const [, insertCs, updateCs] = changesets; // [setup, insert, update]

    // 7. Read the insert changeset individually
    {
      using reader = ECChangesetReader.openFile({
        db,
        fileName: insertCs.pathname,
        rowOptions: { abbreviateBlobs: false },
      });
      using pcu = new PartialChangeUnifier(ChangeUnifierCache.createInMemoryCache());
      while (reader.step()) pcu.appendFrom(reader);

      const elem = Array.from(pcu.instances).find(
        (i) => i.ECInstanceId === elementId && i.$meta.stage === "New",
      );
      // elem.$meta.op === "Inserted"
      // elem.Payload instanceof Uint8Array  → [1, 2, 3]
      // elem.Tags → ["alpha", "beta"]
      // elem.$meta.changeFetchedPropNames.includes("Tags") → true
      expect(elem?.$meta.op).to.exist;
      expect(elem?.Tags).to.exist;
    }

    // 8. Read the update changeset individually
    {
      using reader = ECChangesetReader.openFile({
        db,
        fileName: updateCs.pathname,
        rowOptions: { abbreviateBlobs: false },
      });
      using pcu = new PartialChangeUnifier(ChangeUnifierCache.createInMemoryCache());
      while (reader.step()) pcu.appendFrom(reader);

      const instances = Array.from(pcu.instances);
      const elemNew = instances.find((i) => i.ECInstanceId === elementId && i.$meta.stage === "New");
      const elemOld = instances.find((i) => i.ECInstanceId === elementId && i.$meta.stage === "Old");
      // elemNew.Tags → ["alpha", "beta", "gamma"]
      // elemOld.Tags → ["alpha", "beta"]
      // elemNew.$meta.changeFetchedPropNames.includes("Tags") → true
      expect(elemNew?.Tags).to.exist;
      expect(elemOld?.Tags).to.exist;
    }

    // 9. Read both changesets as a group
    {
      using reader = ECChangesetReader.openGroup({
        db,
        changesetFiles: [insertCs.pathname, updateCs.pathname],
        rowOptions: { abbreviateBlobs: false },
      });
      using pcu = new PartialChangeUnifier(ChangeUnifierCache.createInMemoryCache());
      while (reader.step()) pcu.appendFrom(reader);

      const elem = Array.from(pcu.instances).find(
        (i) => i.ECInstanceId === elementId && i.$meta.stage === "New",
      );
      // op is "Inserted" because the first appearance across the group was an insert.
      // Final Tags value reflects the update (["alpha","beta","gamma"]).
      // tables accumulated: ["bis_Element", "bis_GeometricElement2d"]
      expect(elem?.$meta.op).to.exist;
      expect(elem?.Tags).to.exist;
    }

    txn.end();
    db.close();
    // __PUBLISH_EXTRACT_END__
  });
});
