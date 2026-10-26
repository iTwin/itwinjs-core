/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { DbResult, Id64Array, Id64String } from "@itwin/core-bentley";
import { Code, ElementAspectProps, IModel, SubCategoryAppearance } from "@itwin/core-common";
import { BulkElementAspectsStatus, ChannelControl, EditTxn, IModelDb, IModelHost, IModelJsFs, PhysicalModel, SpatialCategory, StandaloneDb, withEditTxn } from "@itwin/core-backend";
import { HubWrappers, IModelTestUtils, KnownTestLocations } from "@itwin/core-backend/lib/cjs/test/index";
import { HubMock } from "@itwin/core-backend/lib/cjs/internal/HubMock";
import { Reporter } from "@itwin/perf-tools";

/* eslint-disable @typescript-eslint/naming-convention */

const schemaXml = `<?xml version="1.0" encoding="UTF-8"?>
<ECSchema schemaName="BulkAspectPerf" alias="bap" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
  <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
  ${Array.from({ length: 10 }, (_, i) => `<ECEntityClass typeName="Unique${i}">
    <BaseClass>bis:ElementUniqueAspect</BaseClass>
    <ECProperty propertyName="StrProp" typeName="string"/>
    <ECProperty propertyName="IntProp" typeName="int"/>
  </ECEntityClass>`).join("\n  ")}
  <ECEntityClass typeName="Multi">
    <BaseClass>bis:ElementMultiAspect</BaseClass>
    <ECProperty propertyName="StrProp" typeName="string"/>
    <ECProperty propertyName="IntProp" typeName="int"/>
  </ECEntityClass>
</ECSchema>`;

/** Compares the single-aspect EditTxn APIs (insertAspect, updateAspect, deleteAspect) with the bulk ones (insertAspects, updateAspects, deleteAspects). */
describe("PerformanceTest: Bulk ElementAspect operations", () => {
  const outDir = `${KnownTestLocations.outputDir}/BulkElementAspects`;
  const reporter = new Reporter();
  const suite = "BulkElementAspectsPerfTest";

  /** `multi`: ExternalSourceAspects. `unique`: one aspect of each of up to 10 ElementUniqueAspect classes per owner. `mixed`: unique, ExternalSourceAspect and another multi-aspect class in turn. */
  type AspectKind = "multi" | "unique" | "mixed";
  type Api = "single" | "bulk";
  type Operation = "insert" | "update" | "delete";
  interface TestDb { db: IModelDb, ownerIds: Id64Array, close: () => void }
  type TestDbFactory = (name: string, ownerCount: number) => Promise<TestDb>;

  const summary: Array<Record<string, string | number>> = [];

  before(async () => {
    await IModelHost.startup();
    if (!IModelJsFs.existsSync(KnownTestLocations.outputDir))
      IModelJsFs.mkdirSync(KnownTestLocations.outputDir);
    if (!IModelJsFs.existsSync(outDir))
      IModelJsFs.mkdirSync(outDir);
  });

  after(async () => {
    console.table(summary); // eslint-disable-line no-console
    reporter.exportCSV(`${outDir}/BulkElementAspectsPerformanceResults.csv`);
    await IModelHost.shutdown();
  });

  const insertOwners = (txn: EditTxn, ownerCount: number): Id64Array => {
    const modelId = PhysicalModel.insert(txn, IModel.rootSubjectId, "OwnerModel");
    const categoryId = SpatialCategory.insert(txn, IModel.dictionaryId, "OwnerCategory", new SubCategoryAppearance());
    return Array.from({ length: ownerCount }, () => txn.insertElement({ classFullName: "Generic:PhysicalObject", model: modelId, category: categoryId, code: Code.createEmpty() } as any));
  };

  /** A StandaloneDb, where locks are not required. */
  const standaloneDb: TestDbFactory = async (name, ownerCount) => {
    const fileName = IModelTestUtils.prepareOutputFile("BulkElementAspects", `${name}.bim`);
    const db = StandaloneDb.createEmpty(fileName, { rootSubject: { name: "BulkElementAspectsPerfTest" } });
    db.channels.addAllowedChannel(ChannelControl.sharedChannelName);
    await db.importSchemaStrings([schemaXml]);
    const ownerIds = withEditTxn(db, "create owners", (txn) => insertOwners(txn, ownerCount));
    return { db, ownerIds, close: () => { db.close(); IModelJsFs.unlinkSync(fileName); } };
  };

  /** A briefcase where locks are required. The owners are pushed, so they are not new elements, and their model is locked exclusively. */
  const lockedBriefcase: TestDbFactory = async (name, ownerCount) => {
    HubMock.startup(name, KnownTestLocations.outputDir);
    const iModelId = await HubMock.createNewIModel({ iTwinId: HubMock.iTwinId, iModelName: name });
    const db = await HubWrappers.downloadAndOpenBriefcase({ iTwinId: HubMock.iTwinId, iModelId });
    db.channels.addAllowedChannel(ChannelControl.sharedChannelName);
    await db.importSchemaStrings([schemaXml]);
    await db.locks.acquireLocks({ shared: [IModel.dictionaryId, IModel.repositoryModelId] });
    const ownerIds = withEditTxn(db, "create owners", (txn) => insertOwners(txn, ownerCount));
    await db.pushChanges({ description: "create owners" });
    await db.locks.acquireLocks({ exclusive: db.elements.getElement(ownerIds[0]).model });
    return { db, ownerIds, close: () => { db.close(); HubMock.shutdown(); } };
  };

  function aspectProps(kind: AspectKind, ownerIds: Id64Array, aspectsPerOwner: number, index: number, version: string, id?: Id64String): ElementAspectProps {
    const element = ownerIds[Math.floor(index / aspectsPerOwner)];
    const rowKind = kind === "mixed" ? (["unique", "multi", "other"] as const)[index % 3] : kind;
    switch (rowKind) {
      case "multi":
        return { id, classFullName: "BisCore:ExternalSourceAspect", element: { id: element, relClassName: "BisCore:ElementOwnsMultiAspects" }, scope: { id: IModel.rootSubjectId }, identifier: `identifier${index}`, kind: "Element", version } as ElementAspectProps;
      case "other":
        return { id, classFullName: "BulkAspectPerf:Multi", element: { id: element, relClassName: "BisCore:ElementOwnsMultiAspects" }, strProp: version, intProp: index } as ElementAspectProps;
      case "unique":
        return { id, classFullName: `BulkAspectPerf:Unique${index % aspectsPerOwner}`, element: { id: element, relClassName: "BisCore:ElementOwnsUniqueAspect" }, strProp: version, intProp: index } as ElementAspectProps;
    }
  }

  function countAspects(db: IModelDb): number {
    return db.withSqliteStatement("SELECT (SELECT COUNT(*) FROM bis_ElementMultiAspect) + (SELECT COUNT(*) FROM bis_ElementUniqueAspect)", (stmt) => {
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      return stmt.getValueInteger(0);
    });
  }

  /** Inserts, updates and deletes `count` aspects with the given API in a fresh iModel, returning the time of each operation in ms. */
  async function run(createDb: TestDbFactory, kind: AspectKind, api: Api, count: number, aspectsPerOwner: number): Promise<Record<Operation, number>> {
    const { db, ownerIds, close } = await createDb(`BulkAspects_${kind}_${api}_${count}_${aspectsPerOwner}`, Math.ceil(count / aspectsPerOwner));
    const indices = Array.from({ length: count }, (_, i) => i);
    const times: Record<Operation, number> = { insert: 0, update: 0, delete: 0 };
    const time = (operation: Operation, fn: () => void) => {
      const start = performance.now();
      fn();
      times[operation] = performance.now() - start;
    };

    const txn = new EditTxn(db, `${api} aspect perf test`);
    txn.start();
    try {
      let ids: Id64Array = [];
      const insertProps = indices.map((i) => aspectProps(kind, ownerIds, aspectsPerOwner, i, "1"));
      if (api === "single") {
        time("insert", () => { ids = insertProps.map((props) => txn.insertAspect(props)); });
      } else {
        time("insert", () => {
          const result = txn.insertAspects(insertProps);
          assert.equal(result.status, BulkElementAspectsStatus.Success);
          ids = result.ids;
        });
      }
      const initialCount = countAspects(db);
      assert.isAtLeast(initialCount, count);

      const updateProps = indices.map((i) => aspectProps(kind, ownerIds, aspectsPerOwner, i, "2", ids[i]));
      if (api === "single")
        time("update", () => updateProps.forEach((props) => txn.updateAspect(props)));
      else
        time("update", () => assert.equal(txn.updateAspects(updateProps).status, BulkElementAspectsStatus.Success));
      assert.equal(countAspects(db), initialCount);

      if (api === "single")
        time("delete", () => txn.deleteAspect(ids));
      else
        time("delete", () => assert.equal(txn.deleteAspects(ids).status, BulkElementAspectsStatus.Success));
      assert.equal(countAspects(db), initialCount - count);

      txn.saveChanges();
    } finally {
      txn.end();
      close();
    }
    return times;
  }

  async function compare(dbKind: string, createDb: TestDbFactory, kinds: AspectKind[], counts: number[], aspectsPerOwnerCounts: number[]) {
    for (const kind of kinds) {
      for (const aspectsPerOwner of aspectsPerOwnerCounts) {
        for (const count of counts) {
          const results: Record<Api, Record<Operation, number>> = {
            single: await run(createDb, kind, "single", count, aspectsPerOwner),
            bulk: await run(createDb, kind, "bulk", count, aspectsPerOwner),
          };

          for (const operation of ["insert", "update", "delete"] as Operation[]) {
            for (const api of ["single", "bulk"] as Api[])
              reporter.addEntry(suite, `${operation} ${api}`, "Execution time(ms)", results[api][operation], { Db: dbKind, AspectKind: kind, AspectCount: count, AspectsPerOwner: aspectsPerOwner, Operation: operation, Api: api });

            summary.push({
              db: dbKind,
              kind,
              operation,
              aspects: count,
              perOwner: aspectsPerOwner,
              singleMs: Math.round(results.single[operation]),
              bulkMs: Math.round(results.bulk[operation]),
              speedup: Number((results.single[operation] / results.bulk[operation]).toFixed(2)),
            });
          }
        }
      }
    }
  }

  it("single-aspect APIs vs bulk APIs, StandaloneDb", async () => {
    await compare("standalone", standaloneDb, ["multi", "unique", "mixed"], [100, 1000, 10000], [1, 10]);
  });

  it("single-aspect APIs vs bulk APIs, briefcase with locks required", async () => {
    await compare("locked briefcase", lockedBriefcase, ["multi", "mixed"], [1000, 10000], [1, 10]);
  });
});
