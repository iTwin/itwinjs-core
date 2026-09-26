/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { DbResult, Id64, Id64String, IModelStatus } from "@itwin/core-bentley";
import { Code, ColorDef, IModel, IModelError, SubCategoryAppearance } from "@itwin/core-common";
import { IModelJsNative } from "@bentley/imodeljs-native";
import { assert, expect } from "chai";
import * as path from "node:path";
import { DrawingCategory } from "../../Category";
import { ChangesetReader } from "../../ChangesetReader";
import { ChangeInstance, PropertyFilter, RowFormatOptions } from "../../ChangesetReaderTypes";
import { ChangeUnifier, ChangeUnifierArgs } from "../../ChangeUnifier";
import { BriefcaseDb, ChannelControl } from "../../core-backend";
import { EditTxn } from "../../EditTxn";
import { HubMock } from "../../internal/HubMock";
import { IModelNative } from "../../internal/NativePlatform";
import { ChangeUnifierCache, PartialChangeUnifier } from "../../PartialChangeUnifier";
import { SqliteChangeOp } from "../../SqliteChangesetReader";
import { HubWrappers, IModelTestUtils } from "../IModelTestUtils";
import { KnownTestLocations } from "../KnownTestLocations";
import "../TestUtils"; // registers the global mocha before/after hooks that start/stop the backend

/* eslint-disable @typescript-eslint/naming-convention */ // EC property names are PascalCase

/** `true` once the native addon implements `ChangeUnifier` (iTwin/itwinjs-core#9761). Until then, tests that need it are skipped. */
function isNativeChangeUnifierAvailable(): boolean {
  return typeof (IModelNative.platform as Partial<typeof IModelJsNative>).ChangeUnifier === "function";
}

/** What the tests need to know about the tables of an iModel, queried from `ec_Table`. */
interface TableInfo {
  /** Names of the overflow tables. */
  readonly overflowTables: ReadonlySet<string>;
  /** Id of the root class of the class family mapped to each table, i.e. the exclusive root class of the family's primary table. */
  readonly rootClassIds: ReadonlyMap<string, bigint>;
}

function queryTableInfo(db: BriefcaseDb): TableInfo {
  interface Table { readonly name: string, readonly parentId?: Id64String, readonly isOverflow: boolean, readonly exclusiveRootClassId?: Id64String }
  const tables = new Map<Id64String, Table>();
  db.withSqliteStatement("SELECT Id, ParentTableId, Name, Type, ExclusiveRootClassId FROM ec_Table", (stmt) => {
    while (stmt.step() === DbResult.BE_SQLITE_ROW) {
      tables.set(stmt.getValueId(0), {
        parentId: stmt.isValueNull(1) ? undefined : stmt.getValueId(1),
        name: stmt.getValueString(2),
        isOverflow: stmt.getValueInteger(3) === 3, // DbTable::Type::Overflow
        exclusiveRootClassId: stmt.isValueNull(4) ? undefined : stmt.getValueId(4),
      });
    }
  });

  const overflowTables = new Set<string>();
  const rootClassIds = new Map<string, bigint>();
  for (const table of tables.values()) {
    if (table.isOverflow)
      overflowTables.add(table.name);
    // Joined and overflow tables reference their parent table; the primary table of the class family has no parent.
    let primary: Table | undefined = table;
    while (primary?.parentId !== undefined)
      primary = tables.get(primary.parentId);
    if (primary?.exclusiveRootClassId !== undefined)
      rootClassIds.set(table.name, BigInt(primary.exclusiveRootClassId));
  }
  return { overflowTables, rootClassIds };
}

/** The order of [[ChangeUnifier.instances]]: numeric (root class id, ECInstanceId, stage), with "Old" before "New". */
function sortKeyOf(instance: ChangeInstance, tableInfo: TableInfo): bigint[] {
  const table = instance.$meta.tables[0];
  const rootClassId = tableInfo.rootClassIds.get(table);
  assert.isDefined(rootClassId, `root class of table ${table}`);
  return [rootClassId!, BigInt(instance.ECInstanceId), BigInt(instance.$meta.stage === "Old" ? 0 : 1)];
}

function compareSortKeys(lhs: bigint[], rhs: bigint[]): number {
  for (let i = 0; i < lhs.length; ++i) {
    if (lhs[i] !== rhs[i])
      return lhs[i] < rhs[i] ? -1 : 1;
  }
  return 0;
}

/** The ops and `isIndirectChange` flags of the rows of one instance and stage that came from main (i.e. non-overflow) tables. */
interface MainTableRows {
  readonly ops: Set<SqliteChangeOp>;
  readonly isIndirect: Set<boolean>;
}

/** The expected output of [[ChangeUnifier]], computed with [[PartialChangeUnifier]]. */
interface ExpectedInstances {
  /** Instances merged by PartialChangeUnifier, sorted the way ChangeUnifier sorts them. */
  readonly instances: ChangeInstance[];
  /** The main-table rows of each instance, by PartialChangeUnifier merge key. */
  readonly mainTableRows: ReadonlyMap<string, MainTableRows>;
}

/** The key PartialChangeUnifier merges partial instances by. */
function partialChangeUnifierKey(instance: ChangeInstance): string {
  return `${instance.$meta.instanceKey}-${instance.$meta.stage}`.toLowerCase();
}

function unifyWithPartialChangeUnifier(readers: Iterable<ChangesetReader>, tableInfo: TableInfo): ExpectedInstances {
  const mainTableRows = new Map<string, MainTableRows>();
  using unifier = new PartialChangeUnifier(ChangeUnifierCache.createInMemoryCache());
  for (const reader of readers) {
    while (reader.step()) {
      if (!reader.isECTable)
        continue;
      if (!tableInfo.overflowTables.has(reader.tableName)) {
        for (const partial of [reader.inserted, reader.deleted]) {
          if (partial === undefined)
            continue;
          const key = partialChangeUnifierKey(partial);
          const rows = mainTableRows.get(key) ?? { ops: new Set<SqliteChangeOp>(), isIndirect: new Set<boolean>() };
          rows.ops.add(reader.op);
          rows.isIndirect.add(reader.isIndirectChange);
          mainTableRows.set(key, rows);
        }
      }
      unifier.appendFrom(reader);
    }
  }
  const instances = Array.from(unifier.instances);
  instances.sort((lhs, rhs) => compareSortKeys(sortKeyOf(lhs, tableInfo), sortKeyOf(rhs, tableInfo)));
  return { instances, mainTableRows };
}

function unifyNatively(readers: Iterable<ChangesetReader>, args?: ChangeUnifierArgs): ChangeInstance[] {
  using unifier = ChangeUnifier.fromReaders(readers, args);
  return Array.from(unifier.instances());
}

/**
 * Assert that the instances of [[ChangeUnifier]] equal those of [[PartialChangeUnifier]], except for the documented differences:
 * - ChangeUnifier sorts numerically by (root class id, ECInstanceId, stage).
 * - ChangeUnifier takes `op` and `isIndirectChange` from the rows of main (non-overflow) tables. If only overflow tables
 *   contributed, `op` is "Updated" and `isIndirectChange` comes from the first row. PartialChangeUnifier takes both from the first row.
 * @param severalReaders `true` if the instances merge the rows of several readers, in which case the same table or
 * change index can contribute more than once, so `tables` and `changeIndexes` are compared as sets.
 */
function assertMatchesPartialChangeUnifier(actual: ChangeInstance[], expected: ExpectedInstances, tableInfo: TableInfo, severalReaders = false): void {
  for (let i = 1; i < actual.length; ++i)
    assert.isBelow(compareSortKeys(sortKeyOf(actual[i - 1], tableInfo), sortKeyOf(actual[i], tableInfo)), 0, `instances ${i - 1} and ${i} are not sorted`);

  assert.equal(actual.length, expected.instances.length, "number of instances");
  actual.forEach((actualInstance, i) => {
    const expectedInstance = expected.instances[i];
    const { $meta: actualMeta, ...actualProps } = actualInstance;
    const { $meta: expectedMeta, ...expectedProps } = expectedInstance;
    const what = `${expectedMeta.instanceKey} ${expectedMeta.stage}`;

    assert.deepEqual(actualProps, expectedProps, `${what}: properties`);
    assert.sameMembers(Object.keys(actualMeta), Object.keys(expectedMeta), `${what}: $meta keys`);
    assert.equal(actualMeta.instanceKey, expectedMeta.instanceKey, `${what}: instanceKey`);
    assert.equal(actualMeta.stage, expectedMeta.stage, `${what}: stage`);
    assert.equal(actualMeta.propFilter, expectedMeta.propFilter, `${what}: propFilter`);
    assert.deepEqual(actualMeta.rowOptions, expectedMeta.rowOptions, `${what}: rowOptions`);
    assert.deepEqual(actualMeta.changeFetchedPropNames, expectedMeta.changeFetchedPropNames, `${what}: changeFetchedPropNames`);
    if (severalReaders) {
      assert.sameMembers([...new Set(actualMeta.tables)], [...new Set(expectedMeta.tables)], `${what}: tables`);
      assert.sameMembers([...new Set(actualMeta.changeIndexes)], [...new Set(expectedMeta.changeIndexes)], `${what}: changeIndexes`);
    } else {
      assert.deepEqual(actualMeta.tables, expectedMeta.tables, `${what}: tables`);
      assert.deepEqual(actualMeta.changeIndexes, expectedMeta.changeIndexes, `${what}: changeIndexes`);
    }

    const mainTableRows = expected.mainTableRows.get(partialChangeUnifierKey(expectedInstance));
    if (mainTableRows === undefined) {
      assert.equal(actualMeta.op, "Updated", `${what}: op of an instance only overflow tables contributed to`);
      assert.equal(actualMeta.isIndirectChange, expectedMeta.isIndirectChange, `${what}: isIndirectChange`);
    } else {
      assert.include([...mainTableRows.ops], actualMeta.op, `${what}: op`);
      assert.include([...mainTableRows.isIndirect], actualMeta.isIndirectChange, `${what}: isIndirectChange`);
    }
  });
}

/** Options for opening a [[ChangesetReader]] in these tests. */
interface ReaderOptions {
  readonly propFilter?: PropertyFilter;
  readonly rowOptions?: RowFormatOptions;
  readonly invert?: boolean;
  /** Configures the reader, e.g. sets filters, before it is used. */
  readonly configure?: (reader: ChangesetReader) => void;
}

function startTestTxn(iModel: BriefcaseDb, description: string): EditTxn {
  const txn = new EditTxn(iModel, description);
  txn.start();
  return txn;
}

async function importSchemaStrings(txn: EditTxn, schemas: string[]): Promise<void> {
  if (txn.isActive)
    txn.saveChanges();
  await txn.iModel.importSchemaStrings(schemas);
}

/** Wait so that LastMod on bis_Model gets a distinct timestamp in the next changeset. */
async function waitForDistinctLastMod(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 300));
}

describe("ChangeUnifier", () => {
  const accessToken = "super manager token";
  const wideElementPropCount = 36; // enough to spill properties p34 and p35 into bis_GeometricElement2d_Overflow
  let rwIModel: BriefcaseDb | undefined;
  let txn: EditTxn | undefined;
  let tableInfo: TableInfo;
  /** Paths of the changesets pushed by the test setup, except the one that imports the schema. */
  const changesets = { inserts: "", updates: "", deletes: "", bulkInserts: "" };
  /** Ids of CuTest:CuElements `e[0]`..`e[4]`, CuTest:CuWideElements `w0` and `w1` and CuTest:CuRefersTo relationships `r0` and `r1`. */
  const ids = { e: [] as Id64String[], w0: "", w1: "", r0: "", r1: "" };

  function db(): BriefcaseDb {
    assert.isDefined(rwIModel);
    return rwIModel!;
  }

  function openReader(fileName: string, options: ReaderOptions = {}): ChangesetReader {
    const reader = ChangesetReader.openFile({ db: db(), fileName, propFilter: options.propFilter, rowOptions: options.rowOptions, invert: options.invert });
    options.configure?.(reader);
    return reader;
  }

  /** Opens each reader when it is requested and disposes it when the next one is requested, as documented for [[ChangeUnifier.fromReaders]]. */
  function* openReaders(fileNames: string[], options: ReaderOptions = {}): Generator<ChangesetReader> {
    for (const fileName of fileNames) {
      using reader = openReader(fileName, options);
      yield reader;
    }
  }

  before(async function () {
    if (!isNativeChangeUnifierAvailable())
      this.skip();

    HubMock.startup("ChangeUnifier", KnownTestLocations.outputDir);
    const iTwinId = HubMock.iTwinId;
    const iModelId = await HubMock.createNewIModel({ iTwinId, iModelName: "changeUnifier", description: "ChangeUnifier", accessToken });
    const iModel = rwIModel = await HubWrappers.downloadAndOpenBriefcase({ iTwinId, iModelId, accessToken });
    const editTxn = txn = startTestTxn(iModel, "ChangeUnifier setup");

    // Changeset 0: schema, drawing model and category.
    const schema = `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="CuTest" alias="cut" version="01.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
      <ECSchemaReference name="BisCore" version="01.00" alias="bis"/>
      <ECEntityClass typeName="CuElement">
        <BaseClass>bis:GraphicalElement2d</BaseClass>
        <ECProperty propertyName="Label" typeName="string"/>
        <ECProperty propertyName="Num" typeName="int"/>
        <ECProperty propertyName="Pt" typeName="point2d"/>
        <ECProperty propertyName="Bin" typeName="binary"/>
      </ECEntityClass>
      <ECEntityClass typeName="CuWideElement">
        <BaseClass>bis:GraphicalElement2d</BaseClass>
        ${Array.from({ length: wideElementPropCount }, (_, i) => `<ECProperty propertyName="p${i}" typeName="string"/>`).join("\n        ")}
      </ECEntityClass>
      <ECRelationshipClass typeName="CuRefersTo" strength="referencing" modifier="Sealed">
        <BaseClass>bis:ElementRefersToElements</BaseClass>
        <Source multiplicity="(0..*)" roleLabel="refers to" polymorphic="true"><Class class="CuElement"/></Source>
        <Target multiplicity="(0..*)" roleLabel="is referenced by" polymorphic="true"><Class class="CuElement"/></Target>
      </ECRelationshipClass>
    </ECSchema>`;
    await importSchemaStrings(editTxn, [schema]);
    iModel.channels.addAllowedChannel(ChannelControl.sharedChannelName);
    await iModel.locks.acquireLocks({ shared: IModel.dictionaryId });
    const modelCode = Code.createEmpty();
    modelCode.value = "ChangeUnifierDrawing";
    const [, drawingModelId] = IModelTestUtils.createAndInsertDrawingPartitionAndModel(editTxn, modelCode, true);
    const categoryId = DrawingCategory.queryCategoryIdByName(iModel, IModel.dictionaryId, "ChangeUnifierCategory")
      ?? DrawingCategory.insert(editTxn, IModel.dictionaryId, "ChangeUnifierCategory", new SubCategoryAppearance({ color: ColorDef.fromString("rgb(0,128,255)").toJSON() }));
    editTxn.saveChanges("setup");
    await iModel.pushChanges({ description: "setup", accessToken });

    const insertElement = (classFullName: string, props: object) => editTxn.insertElement({
      classFullName,
      model: drawingModelId,
      category: categoryId,
      code: Code.createEmpty(),
      ...props,
    } as any);
    const wideProps = (prefix: string, count: number) => Object.fromEntries(Array.from({ length: count }, (_, i) => [`p${i}`, `${prefix}-${i}`]));

    // Changeset 1: insert elements - including properties in the overflow table - and relationships.
    await waitForDistinctLastMod();
    await iModel.locks.acquireLocks({ shared: drawingModelId });
    for (let i = 0; i < 5; ++i)
      ids.e.push(insertElement("CuTest:CuElement", { Label: `e${i}`, Num: i, Pt: { x: i, y: -i }, Bin: new Uint8Array([i, i + 1, i + 2]) }));
    ids.w0 = insertElement("CuTest:CuWideElement", wideProps("w0", wideElementPropCount));
    ids.w1 = insertElement("CuTest:CuWideElement", wideProps("w1", wideElementPropCount));
    editTxn.saveChanges("insert elements");
    await iModel.locks.acquireLocks({ exclusive: Id64.toIdSet([ids.e[0], ids.e[1], ids.e[3], ids.e[4]]) });
    ids.r0 = editTxn.insertRelationship({ classFullName: "CuTest:CuRefersTo", sourceId: ids.e[0], targetId: ids.e[1] });
    ids.r1 = editTxn.insertRelationship({ classFullName: "CuTest:CuRefersTo", sourceId: ids.e[3], targetId: ids.e[4] });
    editTxn.saveChanges("insert relationships");
    await iModel.pushChanges({ description: "inserts", accessToken });

    // Changeset 2: update elements, including properties in the overflow table.
    await waitForDistinctLastMod();
    await iModel.locks.acquireLocks({ exclusive: Id64.toIdSet([ids.e[0], ids.e[1], ids.w0]) });
    editTxn.updateElement({ ...iModel.elements.getElementProps(ids.e[0]), Label: "e0-updated" });
    editTxn.updateElement({ ...iModel.elements.getElementProps(ids.e[1]), Num: 100, Pt: { x: 10, y: 20 } });
    editTxn.updateElement({ ...iModel.elements.getElementProps(ids.w0), p34: "w0-34-updated", p35: "w0-35-updated" }); // only properties in the overflow table
    editTxn.saveChanges("update elements");
    await iModel.pushChanges({ description: "updates", accessToken });

    // Changeset 3: delete elements - including properties in the overflow table - and a relationship.
    await waitForDistinctLastMod();
    await iModel.locks.acquireLocks({ exclusive: Id64.toIdSet([ids.e[2], ids.w1, ids.e[3], ids.e[4]]) });
    editTxn.deleteRelationship(iModel.relationships.getInstanceProps("CuTest:CuRefersTo", ids.r1));
    editTxn.deleteElement([ids.e[2], ids.w1]);
    editTxn.saveChanges("delete elements");
    await iModel.pushChanges({ description: "deletes", accessToken });

    // Changeset 4: insert enough elements to spill when the memory budget is tiny.
    await waitForDistinctLastMod();
    await iModel.locks.acquireLocks({ shared: drawingModelId });
    for (let i = 0; i < 60; ++i)
      insertElement("CuTest:CuElement", { Label: `bulk${i}`, Num: i, Pt: { x: i, y: i }, Bin: new Uint8Array([i, 255 - i]) });
    editTxn.saveChanges("bulk insert elements");
    await iModel.pushChanges({ description: "bulk inserts", accessToken });

    const downloaded = await HubMock.downloadChangesets({ iModelId, targetDir: path.join(KnownTestLocations.outputDir, iModelId, "changesets") });
    assert.equal(downloaded.length, 5);
    [, changesets.inserts, changesets.updates, changesets.deletes, changesets.bulkInserts] = downloaded.map((changeset) => changeset.pathname);
    tableInfo = queryTableInfo(iModel);
    assert.isTrue(tableInfo.overflowTables.has("bis_GeometricElement2d_Overflow"));
  });

  after(() => {
    txn?.end();
    rwIModel?.close();
    if (rwIModel !== undefined)
      HubMock.shutdown();
  });

  it("matches PartialChangeUnifier for inserts, updates and deletes", () => {
    const propFilters = [PropertyFilter.All, PropertyFilter.BisCoreElement, PropertyFilter.InstanceKey];
    const rowOptionsList: Array<RowFormatOptions | undefined> = [undefined, { classIdsToClassNames: true }, { abbreviateBlobs: false }];
    for (const fileName of [changesets.inserts, changesets.updates, changesets.deletes]) {
      for (const propFilter of propFilters) {
        for (const rowOptions of rowOptionsList) {
          const options = { propFilter, rowOptions };
          const expected = unifyWithPartialChangeUnifier(openReaders([fileName], options), tableInfo);
          assert.isNotEmpty(expected.instances);
          assertMatchesPartialChangeUnifier(unifyNatively(openReaders([fileName], options)), expected, tableInfo);
        }
      }
    }
  });

  it("merges the rows of all tables of an instance and fills $meta from the reader", () => {
    const rowOptions = { classIdsToClassNames: true };
    const instances = unifyNatively(openReaders([changesets.updates], { propFilter: PropertyFilter.All, rowOptions }));

    const w0Old = instances.find((i) => i.ECInstanceId === ids.w0 && i.$meta.stage === "Old");
    const w0New = instances.find((i) => i.ECInstanceId === ids.w0 && i.$meta.stage === "New");
    expect(w0Old).to.exist;
    expect(w0New).to.exist;
    assert.isBelow(instances.indexOf(w0Old!), instances.indexOf(w0New!), "Old before New");
    for (const instance of [w0Old!, w0New!]) {
      assert.equal(instance.ECClassId, "CuTest.CuWideElement");
      assert.equal(instance.$meta.op, "Updated");
      assert.equal(instance.$meta.propFilter, PropertyFilter.All);
      assert.deepEqual(instance.$meta.rowOptions, rowOptions);
      assert.isFalse(instance.$meta.isIndirectChange);
      assert.include(instance.$meta.tables, "bis_Element");
      assert.include(instance.$meta.tables, "bis_GeometricElement2d_Overflow");
      assert.isString(instance.LastMod);
    }
    assert.equal(w0Old!.p34, "w0-34");
    assert.equal(w0Old!.p35, "w0-35");
    assert.equal(w0New!.p34, "w0-34-updated");
    assert.equal(w0New!.p35, "w0-35-updated");
    assert.isUndefined(w0New!.p0, "unchanged properties are not part of the change");

    const e1New = instances.find((i) => i.ECInstanceId === ids.e[1] && i.$meta.stage === "New");
    expect(e1New).to.exist;
    assert.equal(e1New!.Num, 100);
    assert.deepEqual(e1New!.Pt, { X: 10, Y: 20 });
  });

  it("honors the options and filters of the readers", () => {
    const cases: Array<{ fileName: string, options: ReaderOptions }> = [
      { fileName: changesets.updates, options: { invert: true } },
      { fileName: changesets.deletes, options: { configure: (reader) => reader.setOpCodeFilters(new Set(["Deleted"])) } },
      { fileName: changesets.inserts, options: { configure: (reader) => reader.setClassNameFilters(new Set(["CuTest:CuWideElement", "CuTest:CuRefersTo"])) } },
      { fileName: changesets.updates, options: { configure: (reader) => reader.setTableNameFilters(new Set(["bis_Element"])) } },
      { fileName: changesets.bulkInserts, options: { configure: (reader) => reader.enableStrictMode() } },
    ];
    for (const { fileName, options } of cases) {
      const expected = unifyWithPartialChangeUnifier(openReaders([fileName], options), tableInfo);
      assert.isNotEmpty(expected.instances);
      assertMatchesPartialChangeUnifier(unifyNatively(openReaders([fileName], options)), expected, tableInfo);
    }

    const deleted = unifyNatively(openReaders([changesets.deletes], cases[1].options));
    assert.sameMembers(deleted.map((i) => i.ECInstanceId), [ids.e[2], ids.w1, ids.r1]);
    for (const instance of deleted) {
      assert.equal(instance.$meta.op, "Deleted");
      assert.equal(instance.$meta.stage, "Old");
    }
  });

  it("reports 'Updated' for instances only overflow tables contributed to", () => {
    const options: ReaderOptions = { configure: (reader) => reader.setTableNameFilters(new Set(tableInfo.overflowTables)) };
    for (const fileName of [changesets.inserts, changesets.updates, changesets.deletes]) {
      const expected = unifyWithPartialChangeUnifier(openReaders([fileName], options), tableInfo);
      assert.isNotEmpty(expected.instances, "rows from overflow tables");
      const actual = unifyNatively(openReaders([fileName], options));
      assertMatchesPartialChangeUnifier(actual, expected, tableInfo);
      for (const instance of actual)
        assert.equal(instance.$meta.op, "Updated");
    }
  });

  it("keeps only the requested properties", () => {
    const propNames = ["Label", "Num", "Model", "LastMod", "p35"];
    const kept = new Set(["ECInstanceId", "ECClassId", ...propNames]);
    for (const fileName of [changesets.inserts, changesets.updates, changesets.deletes]) {
      const all = unifyNatively(openReaders([fileName]));
      const projected = unifyNatively(openReaders([fileName]), { propNames });
      assert.equal(projected.length, all.length);
      projected.forEach((instance, i) => {
        const { $meta: meta, ...props } = instance;
        const { $meta: allMeta, ...allProps } = all[i];
        assert.deepEqual(props, Object.fromEntries(Object.entries(allProps).filter(([name]) => kept.has(name))));
        assert.isDefined(props.ECInstanceId);
        assert.isDefined(props.ECClassId);
        const { changeFetchedPropNames, ...otherMeta } = meta;
        const { changeFetchedPropNames: allChangeFetchedPropNames, ...allOtherMeta } = allMeta;
        assert.deepEqual(otherMeta, allOtherMeta);
        assert.includeMembers(allChangeFetchedPropNames, changeFetchedPropNames);
      });
      assert.isTrue(projected.some((instance) => instance.Label !== undefined || instance.p35 !== undefined), "some requested properties were kept");
    }
  });

  it("returns the same instances when it spills to temporary files", () => {
    const options: ReaderOptions = { rowOptions: { abbreviateBlobs: false } };
    const fileNameLists = [[changesets.bulkInserts], [changesets.updates], [changesets.inserts, changesets.updates, changesets.deletes, changesets.bulkInserts]];
    for (const fileNames of fileNameLists) {
      const inMemory = unifyNatively(openReaders(fileNames, options), { memoryBudgetBytes: 0 });
      assert.isNotEmpty(inMemory);
      assert.deepEqual(unifyNatively(openReaders(fileNames, options)), inMemory, "default memory budget");
      for (const args of [{ memoryBudgetBytes: 1 }, { memoryBudgetBytes: 1, batchSize: 1 }, { memoryBudgetBytes: 1024, batchSize: 7 }, { memoryBudgetBytes: 0, batchSize: 3 }])
        assert.deepEqual(unifyNatively(openReaders(fileNames, options), args), inMemory, JSON.stringify(args));

      const projectedInMemory = unifyNatively(openReaders(fileNames, options), { propNames: ["Label", "Bin"], memoryBudgetBytes: 0 });
      assert.deepEqual(unifyNatively(openReaders(fileNames, options), { propNames: ["Label", "Bin"], memoryBudgetBytes: 1 }), projectedInMemory, "projected");
    }

    const expected = unifyWithPartialChangeUnifier(openReaders([changesets.bulkInserts], options), tableInfo);
    assert.isAtLeast(expected.instances.length, 60);
    assertMatchesPartialChangeUnifier(unifyNatively(openReaders([changesets.bulkInserts], options), { memoryBudgetBytes: 1 }), expected, tableInfo);
  });

  it("merges the rows of several readers", () => {
    const fileNames = [changesets.inserts, changesets.updates, changesets.deletes];
    const expected = unifyWithPartialChangeUnifier(openReaders(fileNames), tableInfo);
    const actual = unifyNatively(openReaders(fileNames));
    assertMatchesPartialChangeUnifier(actual, expected, tableInfo, true);

    // Rows of later readers win.
    const e0New = actual.find((i) => i.ECInstanceId === ids.e[0] && i.$meta.stage === "New");
    assert.equal(e0New?.Label, "e0-updated");
    // An instance inserted by one reader and deleted by another has both stages.
    assert.sameMembers(actual.filter((i) => i.ECInstanceId === ids.e[2]).map((i) => i.$meta.stage), ["Old", "New"]);

    // Readers that are all open while the unifier is created give the same result as readers opened one at a time.
    using inserts = openReader(changesets.inserts);
    using updates = openReader(changesets.updates);
    using deletes = openReader(changesets.deletes);
    assert.deepEqual(unifyNatively([inserts, updates, deletes]), actual);
  });

  it("consumes the readers", () => {
    using reader = openReader(changesets.inserts);
    using unifier = ChangeUnifier.fromReader(reader);
    assert.isFalse(reader.step(), "the unifier read all rows");
    assert.isUndefined(reader.inserted);
    assert.isUndefined(reader.deleted);
    expect(() => reader.setOpCodeFilters(new Set(["Inserted"]))).to.throw(IModelError, "consumed by a ChangeUnifier");
    expect(() => ChangeUnifier.fromReader(reader)).to.throw(IModelError, "already been consumed");
    assert.isNotEmpty(Array.from(unifier.instances()));
    expect(() => reader.close()).to.not.throw();
  });

  it("rejects readers that cannot be merged", () => {
    {
      using reader = openReader(changesets.inserts);
      assert.isTrue(reader.step());
      expect(() => ChangeUnifier.fromReader(reader)).to.throw(IModelError, "already been stepped");
      assert.isTrue(reader.step(), "the reader was not consumed");
    }
    {
      using reader = openReader(changesets.inserts);
      expect(() => ChangeUnifier.fromReaders([reader, reader])).to.throw(IModelError, "already been consumed");
    }
    {
      using inserts = openReader(changesets.inserts, { propFilter: PropertyFilter.All });
      using updates = openReader(changesets.updates, { propFilter: PropertyFilter.InstanceKey });
      expect(() => ChangeUnifier.fromReaders([inserts, updates])).to.throw(IModelError, "same propFilter and rowOptions");
      assert.isFalse(inserts.step(), "readers before the failing one were consumed");
      assert.isTrue(updates.step(), "the failing reader was not consumed");
    }
    {
      using inserts = openReader(changesets.inserts, { rowOptions: { classIdsToClassNames: true } });
      using updates = openReader(changesets.updates);
      expect(() => ChangeUnifier.fromReaders([inserts, updates])).to.throw(IModelError, "same propFilter and rowOptions");
    }
    {
      // Omitted row options are equivalent to their defaults.
      using inserts = openReader(changesets.inserts, { rowOptions: { abbreviateBlobs: true, classIdsToClassNames: false } });
      using updates = openReader(changesets.updates);
      using unifier = ChangeUnifier.fromReaders([inserts, updates]);
      for (const instance of unifier.instances())
        assert.deepEqual(instance.$meta.rowOptions, { abbreviateBlobs: true, classIdsToClassNames: false });
    }
  });

  it("returns each instance once and can be disposed more than once", () => {
    const all = unifyNatively(openReaders([changesets.bulkInserts]));
    assert.isAtLeast(all.length, 20);

    using unifier = ChangeUnifier.fromReaders(openReaders([changesets.bulkInserts]), { batchSize: 4 });
    const first: ChangeInstance[] = [];
    for (const instance of unifier.instances()) {
      first.push(instance);
      if (first.length === 10)
        break;
    }
    const rest = Array.from(unifier.instances());
    assert.deepEqual([...first, ...rest], all);
    assert.isEmpty(Array.from(unifier.instances()));

    unifier[Symbol.dispose]();
    expect(() => unifier[Symbol.dispose]()).to.not.throw();
    expect(() => unifier.instances().next()).to.throw(IModelError, "disposed");
  });

  it("returns no instances without readers", () => {
    using unifier = ChangeUnifier.fromReaders([]);
    assert.isEmpty(Array.from(unifier.instances()));
  });
});

describe("ChangeUnifier arguments", () => {
  it("are validated before any reader is requested", () => {
    const invalidArgs: ChangeUnifierArgs[] = [
      { batchSize: 0 },
      { batchSize: -1 },
      { batchSize: 1.5 },
      { batchSize: Number.NaN },
      { memoryBudgetBytes: -1 },
      { memoryBudgetBytes: 0.5 },
      { memoryBudgetBytes: Number.POSITIVE_INFINITY },
    ];
    for (const args of invalidArgs) {
      let requested = false;
      const readers: Iterable<ChangesetReader> = {
        [Symbol.iterator]: () => {
          requested = true;
          return ([] as ChangesetReader[])[Symbol.iterator]();
        },
      };
      expect(() => ChangeUnifier.fromReaders(readers, args), JSON.stringify(args)).to.throw(IModelError, "ChangeUnifier:").with.property("errorNumber", IModelStatus.BadArg);
      assert.isFalse(requested, JSON.stringify(args));
    }
  });
});
