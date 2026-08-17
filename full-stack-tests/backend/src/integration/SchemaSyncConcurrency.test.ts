/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { Suite } from "mocha";
import { BriefcaseDb, IModelHost } from "@itwin/core-backend";
import { HubMock } from "@itwin/core-backend/lib/cjs/internal/HubMock";
import { AccessToken, DbResult } from "@itwin/core-bentley";
import { IModel } from "@itwin/core-common";
import "./StartupShutdown"; // calls startup/shutdown IModelHost before/after all tests
import { AzuriteTest } from "./AzuriteTest";
import {
  assertThrowsAsyncContaining, createTestIModel, enableSchemaSync, expectCacheTablesIdentical, expectCensusPreserved, expectMetadataTablesIdentical,
  expectNoForeignKeyViolations, expectPhysicalSchemaIdentical, importTinySchema, initializeContainer, insertDrawingModelAndCategory,
  insertGeometricElement2d, listMetadataTables, openTestBriefcase, queryPropNames, readTableRows, takeElementCensus, TinyPrimitiveProp, TinySchema,
  tinySchemaToXml, TinyStructProp,
} from "./SchemaSyncTestUtils";

interface BriefcaseSet {
  briefcases: BriefcaseDb[];
  accessTokens: AccessToken[];
}

const createBriefcases = async (args: { containerId: string, iModelName: string, briefcaseCount: number, cachePrefix: string }): Promise<BriefcaseSet> => {
  const containerProps = await initializeContainer({ baseUri: AzuriteTest.baseUri, containerId: args.containerId });
  const accessTokens = Array.from({ length: args.briefcaseCount }, (_, index) => `${args.cachePrefix}-user-${index + 1}`);
  const { iTwinId, iModelId } = await createTestIModel({ iModelName: args.iModelName, accessToken: accessTokens[0] });
  const briefcases: BriefcaseDb[] = [];
  for (let index = 0; index < args.briefcaseCount; ++index) {
    briefcases.push(await openTestBriefcase({
      iTwinId,
      iModelId,
      accessToken: accessTokens[index],
      cacheName: `${args.cachePrefix}-b${index + 1}`,
    }));
  }

  await enableSchemaSync(briefcases[0], containerProps);
  for (const briefcase of briefcases.slice(1))
    await briefcase.pullChanges({ accessToken: accessTokens[briefcases.indexOf(briefcase)] });

  return { briefcases, accessTokens };
};

const closeBriefcases = (briefcases: BriefcaseDb[]): void => {
  for (const briefcase of briefcases) {
    try {
      briefcase.close();
    } catch {
      // HubMock's afterEach still shuts down if a test failed before it could release a lock.
    }
  }
};

const pushChangesWithPull = async (briefcase: BriefcaseDb, accessToken: AccessToken, description: string): Promise<void> => {
  try {
    await briefcase.pushChanges({ accessToken, description });
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("pull is required"))
      throw error;
    await briefcase.pullChanges({ accessToken });
    await briefcase.pushChanges({ accessToken, description });
  }
};

const schemaWithClass = (name: string, alias: string, className: string, propertyName: string, ver = "01.00.00"): TinySchema => ({
  name,
  alias,
  ver,
  refs: [{ name: "BisCore", ver: "01.00.00", alias: "bis" }],
  classes: [{
    type: "entity",
    name: className,
    baseClass: "bis:GeometricElement2d",
    props: [{ kind: "primitive", name: propertyName, type: "string" }],
  }],
});

const cumulativeSchema = (propertyCount: number, ver: string): TinySchema => ({
  name: "CumulativeSchema",
  alias: "cum",
  ver,
  refs: [{ name: "BisCore", ver: "01.00.00", alias: "bis" }],
  classes: [{
    type: "entity",
    name: "CumulativeElement",
    baseClass: "bis:GeometricElement2d",
    props: Array.from({ length: propertyCount }, (_, index): TinyPrimitiveProp => ({
      kind: "primitive",
      name: `round${index + 1}`,
      type: "string",
    })),
  }],
});

const structAndPipeSchema = (structMemberCount: number, ver: string): TinySchema => ({
  name: "ConcurrentTransform",
  alias: "ct",
  ver,
  refs: [{ name: "BisCore", ver: "01.00.00", alias: "bis" }],
  classes: [{
    type: "struct",
    name: "Struct1",
    props: Array.from({ length: structMemberCount }, (_, index): TinyPrimitiveProp => ({
      kind: "primitive",
      name: `p${index}`,
      type: "string",
    })),
  }, {
    type: "entity",
    name: "Pipe1",
    baseClass: "bis:GeometricElement2d",
    props: [
      { kind: "primitive", name: "name", type: "string" },
      { kind: "struct", name: "s0", type: "Struct1" } satisfies TinyStructProp,
      { kind: "struct", name: "s1", type: "Struct1" } satisfies TinyStructProp,
    ],
  }],
});

const assertClassesPresent = (briefcase: BriefcaseDb, classNames: string[]): void => {
  for (const className of classNames)
    assert.isNotEmpty(queryPropNames(briefcase, className), `${className} is missing`);
};

const sharedPoolSchema = (name: string, alias: string, className: string, propertyPrefix: string): TinySchema => ({
  name,
  alias,
  ver: "01.00.00",
  refs: [{ name: "BisCore", ver: "01.00.00", alias: "bis" }],
  classes: [{
    type: "entity",
    name: className,
    baseClass: "bis:GeometricElement2d",
    props: Array.from({ length: 12 }, (_, index): TinyPrimitiveProp => ({
      kind: "primitive",
      name: `${propertyPrefix}${index}`,
      type: "string",
    })),
  }],
});

interface MappedPropertyColumn {
  propertyName: string;
  tableName: string;
  columnName: string;
}

const queryMappedPropertyColumns = (briefcase: BriefcaseDb, propertyNames: string[]): MappedPropertyColumn[] => {
  const mapped: MappedPropertyColumn[] = [];
  const placeholders = propertyNames.map(() => "?").join(",");
  briefcase.withPreparedSqliteStatement(`
    SELECT p.Name, t.Name, c.Name
    FROM ec_PropertyMap pm
    JOIN ec_PropertyPath pp ON pp.Id=pm.PropertyPathId
    JOIN ec_Property p ON p.Id=pp.RootPropertyId
    JOIN ec_Column c ON c.Id=pm.ColumnId
    JOIN ec_Table t ON t.Id=c.TableId
    WHERE p.Name IN (${placeholders})`, (stmt) => {
    propertyNames.forEach((propertyName, index) => stmt.bindString(index + 1, propertyName));
    while (stmt.step() === DbResult.BE_SQLITE_ROW) {
      mapped.push({
        propertyName: stmt.getValue(0).getString(),
        tableName: stmt.getValue(1).getString(),
        columnName: stmt.getValue(2).getString(),
      });
    }
  });
  return mapped;
};

describe("Schema synchronization concurrency", function (this: Suite) {
  this.timeout(0);

  before(async () => {
    IModelHost.authorizationClient = new AzuriteTest.AuthorizationClient();
    AzuriteTest.userToken = AzuriteTest.service.userToken.readWrite;
  });

  after(async () => {
    IModelHost.authorizationClient = undefined;
  });

  // A test that fails before its own HubMock.shutdown() would otherwise take every later test with it.
  afterEach(() => {
    if (HubMock.isValid)
      HubMock.shutdown();
  });

  it("two briefcases importing different schemas converge", async () => {
    const { briefcases, accessTokens } = await createBriefcases({
      containerId: "sync-conc-1",
      iModelName: "sync-conc-different-schemas",
      briefcaseCount: 2,
      cachePrefix: "syncConc1",
    });
    const [b1, b2] = briefcases;
    try {
      await Promise.all([
        importTinySchema(b1, schemaWithClass("ConcurrentSchemaA", "csa", "PipeA", "fromA")),
        importTinySchema(b2, schemaWithClass("ConcurrentSchemaB", "csb", "PipeB", "fromB")),
      ]);

      await pushChangesWithPull(b1, accessTokens[0], "push schema A");
      await pushChangesWithPull(b2, accessTokens[1], "push schema B");
      await b1.pullChanges({ accessToken: accessTokens[0] });
      await b2.pullChanges({ accessToken: accessTokens[1] });

      const classes = ["ConcurrentSchemaA:PipeA", "ConcurrentSchemaB:PipeB"];
      assertClassesPresent(b1, classes);
      assertClassesPresent(b2, classes);
      expectMetadataTablesIdentical(b1, b2, "after concurrent imports", { a: "b1", b: "b2" });
      expectPhysicalSchemaIdentical(b1, b2, "after concurrent imports");
      expectNoForeignKeyViolations(b1, "after concurrent imports in b1");
      expectNoForeignKeyViolations(b2, "after concurrent imports in b2");
    } finally {
      closeBriefcases(briefcases);
    }
  });

  // This variant carries a committed local element transaction with each schema import, so the push rebase must preserve data from both sides.
  it("two briefcases importing different schemas converge with committed unpushed element changes #extended", async () => {
    const { briefcases, accessTokens } = await createBriefcases({
      containerId: "sync-conc-1-extended",
      iModelName: "sync-conc-different-schemas-with-data",
      briefcaseCount: 2,
      cachePrefix: "syncConc1Extended",
    });
    const [b1, b2] = briefcases;
    try {
      const classes = ["ConcurrentSchemaDataA:PipeA", "ConcurrentSchemaDataB:PipeB"];
      await Promise.all([
        importTinySchema(b1, schemaWithClass("ConcurrentSchemaDataA", "csda", "PipeA", "fromA")),
        importTinySchema(b2, schemaWithClass("ConcurrentSchemaDataB", "csdb", "PipeB", "fromB")),
      ]);

      const placeA = await insertDrawingModelAndCategory(b1, "ConcurrentSchemaDataA");
      await insertGeometricElement2d(b1, {
        ...placeA,
        classFullName: classes[0],
        props: { fromA: "element from A" },
        userLabel: "element from A",
      });
      const placeB = await insertDrawingModelAndCategory(b2, "ConcurrentSchemaDataB");
      await insertGeometricElement2d(b2, {
        ...placeB,
        classFullName: classes[1],
        props: { fromB: "element from B" },
        userLabel: "element from B",
      });

      const beforeB1 = await takeElementCensus(b1, [classes[0]]);
      const beforeB2 = await takeElementCensus(b2, [classes[1]]);
      await pushChangesWithPull(b1, accessTokens[0], "push schema A and data");
      await pushChangesWithPull(b2, accessTokens[1], "push schema B and data");
      await b1.pullChanges({ accessToken: accessTokens[0] });
      await b2.pullChanges({ accessToken: accessTokens[1] });

      expectCensusPreserved(beforeB1, await takeElementCensus(b1, [classes[0], classes[1]]), "after rebasing b1 data");
      expectCensusPreserved(beforeB2, await takeElementCensus(b2, [classes[0], classes[1]]), "after rebasing b2 data");
      assertClassesPresent(b1, classes);
      assertClassesPresent(b2, classes);
      expectMetadataTablesIdentical(b1, b2, "after concurrent imports with data", { a: "b1", b: "b2" });
      expectPhysicalSchemaIdentical(b1, b2, "after concurrent imports with data");
      expectNoForeignKeyViolations(b1, "after concurrent imports with data in b1");
      expectNoForeignKeyViolations(b2, "after concurrent imports with data in b2");
    } finally {
      closeBriefcases(briefcases);
    }
  });

  it("a briefcase created from the timeline afterwards agrees with the importers", async () => {
    const { briefcases, accessTokens } = await createBriefcases({
      containerId: "sync-conc-2",
      iModelName: "sync-conc-timeline-briefcase",
      briefcaseCount: 2,
      cachePrefix: "syncConc2",
    });
    const [b1, b2] = briefcases;
    let b3: BriefcaseDb | undefined;
    try {
      await importTinySchema(b1, schemaWithClass("TimelineSchemaA", "tsa", "TimelinePipeA", "fromA"));
      await importTinySchema(b2, schemaWithClass("TimelineSchemaB", "tsb", "TimelinePipeB", "fromB"));
      await pushChangesWithPull(b1, accessTokens[0], "push timeline schema A");
      await pushChangesWithPull(b2, accessTokens[1], "push timeline schema B");
      await b1.pullChanges({ accessToken: accessTokens[0] });
      await b2.pullChanges({ accessToken: accessTokens[1] });

      const iModelId = b1.iModelId;
      const iTwinId = b1.iTwinId;
      b3 = await openTestBriefcase({
        iTwinId,
        iModelId,
        accessToken: "syncConc2-user-3",
        cacheName: "syncConc2-b3",
      });

      const classes = ["TimelineSchemaA:TimelinePipeA", "TimelineSchemaB:TimelinePipeB"];
      assertClassesPresent(b3, classes);
      expectMetadataTablesIdentical(b1, b3, "between an importer and a timeline briefcase", { a: "b1", b: "b3" });
      expectPhysicalSchemaIdentical(b1, b3, "between an importer and a timeline briefcase");
    } finally {
      closeBriefcases([...briefcases, ...(b3 ? [b3] : [])]);
    }
  });

  // Several rebuilds make the timeline briefcase regenerate cache rows after a sequence of schema changes rather than one import.
  it("a timeline briefcase agrees after several concurrent schema and data rounds #extended", async () => {
    const { briefcases, accessTokens } = await createBriefcases({
      containerId: "sync-conc-2-extended",
      iModelName: "sync-conc-timeline-several-rounds",
      briefcaseCount: 2,
      cachePrefix: "syncConc2Extended",
    });
    const [b1, b2] = briefcases;
    let b3: BriefcaseDb | undefined;
    const className = "CumulativeSchema:CumulativeElement";
    try {
      for (let round = 1; round <= 3; ++round) {
        const schema = cumulativeSchema(round, `01.00.0${round - 1}`);
        const beforeB1 = round === 1 ? undefined : await takeElementCensus(b1, [className]);
        const beforeB2 = round === 1 ? undefined : await takeElementCensus(b2, [className]);
        await Promise.all([importTinySchema(b1, schema), importTinySchema(b2, schema)]);
        await pushChangesWithPull(b1, accessTokens[0], `push timeline schema round ${round} from b1`);
        await pushChangesWithPull(b2, accessTokens[1], `push timeline schema round ${round} from b2`);
        await b1.pullChanges({ accessToken: accessTokens[0] });
        await b2.pullChanges({ accessToken: accessTokens[1] });

        assertClassesPresent(b1, [className]);
        assertClassesPresent(b2, [className]);
        const expectedProperties = Array.from({ length: round }, (_, index) => `round${index + 1}`);
        assert.deepEqual(queryPropNames(b1, className), expectedProperties);
        assert.deepEqual(queryPropNames(b2, className), expectedProperties);
        if (beforeB1 && beforeB2) {
          expectCensusPreserved(beforeB1, await takeElementCensus(b1, [className]), `after schema round ${round} in b1`);
          expectCensusPreserved(beforeB2, await takeElementCensus(b2, [className]), `after schema round ${round} in b2`);
        }

        if (round < 3) {
          for (const [index, briefcase] of briefcases.entries()) {
            const place = await insertDrawingModelAndCategory(briefcase, `TimelineRound${round}B${index + 1}`);
            await insertGeometricElement2d(briefcase, {
              ...place,
              classFullName: className,
              props: { [`round${round}`]: `b${index + 1}-round${round}` },
              userLabel: `round ${round} element b${index + 1}`,
            });
          }
          await pushChangesWithPull(b1, accessTokens[0], `push timeline data round ${round} from b1`);
          await pushChangesWithPull(b2, accessTokens[1], `push timeline data round ${round} from b2`);
          await b1.pullChanges({ accessToken: accessTokens[0] });
          await b2.pullChanges({ accessToken: accessTokens[1] });
        }
      }

      const beforeTimelineBriefcase = await takeElementCensus(b1, [className]);
      const b2Census = await takeElementCensus(b2, [className]);
      expectCensusPreserved(beforeTimelineBriefcase, b2Census, "after all schema and data rounds in b2");
      expectCensusPreserved(b2Census, beforeTimelineBriefcase, "after all schema and data rounds in b1");

      b3 = await openTestBriefcase({
        iTwinId: b1.iTwinId,
        iModelId: b1.iModelId,
        accessToken: "syncConc2Extended-user-3",
        cacheName: "syncConc2Extended-b3",
      });
      const afterTimelineBriefcase = await takeElementCensus(b3, [className]);
      expectCensusPreserved(beforeTimelineBriefcase, afterTimelineBriefcase, "after the timeline briefcase is created");
      expectCensusPreserved(b2Census, afterTimelineBriefcase, "after the timeline briefcase is created from b2");
      expectCensusPreserved(afterTimelineBriefcase, beforeTimelineBriefcase, "the timeline briefcase has no extra or missing elements");

      const allBriefcases = [b1, b2, b3];
      for (const briefcase of allBriefcases) {
        assertClassesPresent(briefcase, [className]);
        assert.deepEqual(queryPropNames(briefcase, className), ["round1", "round2", "round3"]);
        expectNoForeignKeyViolations(briefcase, `after all rounds in b${allBriefcases.indexOf(briefcase) + 1}`);
      }
      expectMetadataTablesIdentical(b1, b2, "after several rounds", { a: "b1", b: "b2" });
      expectMetadataTablesIdentical(b1, b3, "after several rounds", { a: "b1", b: "b3" });
      expectMetadataTablesIdentical(b2, b3, "after several rounds", { a: "b2", b: "b3" });
      expectCacheTablesIdentical(b1, b2, "after several rounds", { a: "b1", b: "b2" });
      expectCacheTablesIdentical(b1, b3, "after several rounds", { a: "b1", b: "b3" });
      expectCacheTablesIdentical(b2, b3, "after several rounds", { a: "b2", b: "b3" });
      expectPhysicalSchemaIdentical(b1, b2, "after several rounds");
      expectPhysicalSchemaIdentical(b1, b3, "after several rounds");
      expectPhysicalSchemaIdentical(b2, b3, "after several rounds");
    } finally {
      closeBriefcases([...briefcases, ...(b3 ? [b3] : [])]);
    }
  });

  it("the cache tables match between an importer and a briefcase that only pulled", async () => {
    const { briefcases, accessTokens } = await createBriefcases({
      containerId: "sync-conc-3",
      iModelName: "sync-conc-cache-tables",
      briefcaseCount: 2,
      cachePrefix: "syncConc3",
    });
    const [importer, pulled] = briefcases;
    try {
      await importTinySchema(importer, schemaWithClass("CacheSchema", "cache", "CachePipe", "value"));
      await pushChangesWithPull(importer, accessTokens[0], "push cache schema");
      await pulled.pullChanges({ accessToken: accessTokens[1] });

      const cacheTables = listMetadataTables(importer, { cacheTablesOnly: true });
      const cacheRowCount = cacheTables.reduce((count, table) => count + readTableRows(importer, table).length, 0);
      assert.isAbove(cacheRowCount, 0, "the cache table comparison must have rows");
      expectCacheTablesIdentical(importer, pulled, "after a schema import and a pull", { a: "importer", b: "pulled" });
    } finally {
      closeBriefcases(briefcases);
    }
  });

  // A third briefcase built only from the timeline checks deterministic cache ids across an importer, a pulling briefcase, and a late download.
  it("the cache tables match across three briefcases using different schema routes #extended", async () => {
    const { briefcases, accessTokens } = await createBriefcases({
      containerId: "sync-conc-3-extended",
      iModelName: "sync-conc-cache-three-routes",
      briefcaseCount: 2,
      cachePrefix: "syncConc3Extended",
    });
    const [importer, pulled] = briefcases;
    let timelineBriefcase: BriefcaseDb | undefined;
    try {
      const schemaV1 = schemaWithClass("CacheRoutesSchema", "crs", "CacheRoutesPipe", "first");
      const schemaV2: TinySchema = {
        ...schemaV1,
        ver: "01.00.01",
        classes: [{
          ...schemaV1.classes![0],
          props: [...schemaV1.classes![0].props!, { kind: "primitive", name: "second", type: "string" }],
        }],
      };
      await importTinySchema(importer, schemaV1);
      await importer.pushChanges({ accessToken: accessTokens[0], description: "push first cache route schema" });
      await pulled.pullChanges({ accessToken: accessTokens[1] });
      await importTinySchema(importer, schemaV2);
      await importer.pushChanges({ accessToken: accessTokens[0], description: "push second cache route schema" });
      await pulled.pullChanges({ accessToken: accessTokens[1] });

      timelineBriefcase = await openTestBriefcase({
        iTwinId: importer.iTwinId,
        iModelId: importer.iModelId,
        accessToken: "syncConc3Extended-user-3",
        cacheName: "syncConc3Extended-b3",
      });
      const className = "CacheRoutesSchema:CacheRoutesPipe";
      for (const briefcase of [importer, pulled, timelineBriefcase]) {
        assert.deepEqual(queryPropNames(briefcase, className), ["first", "second"]);
        expectNoForeignKeyViolations(briefcase, "after three cache routes");
      }
      const cacheTables = listMetadataTables(importer, { cacheTablesOnly: true });
      const cacheRowCount = cacheTables.reduce((count, table) => count + readTableRows(importer, table).length, 0);
      assert.isAbove(cacheRowCount, 0, "the cache table comparison must have rows");
      expectCacheTablesIdentical(importer, pulled, "between importer and pulling briefcase", { a: "importer", b: "pulled" });
      expectCacheTablesIdentical(importer, timelineBriefcase, "between importer and timeline briefcase", { a: "importer", b: "timeline" });
      expectCacheTablesIdentical(pulled, timelineBriefcase, "between pulling and timeline briefcase", { a: "pulled", b: "timeline" });
    } finally {
      closeBriefcases([...briefcases, ...(timelineBriefcase ? [timelineBriefcase] : [])]);
    }
  });

  it("an import is refused while another briefcase holds the exclusive schema lock", async () => {
    const { briefcases, accessTokens } = await createBriefcases({
      containerId: "sync-conc-4",
      iModelName: "sync-conc-exclusive-lock",
      briefcaseCount: 2,
      cachePrefix: "syncConc4",
    });
    const [b1, b2] = briefcases;
    try {
      const initialSchema = structAndPipeSchema(11, "01.00.00");
      const widenedSchema = structAndPipeSchema(31, "01.00.01");
      await importTinySchema(b1, initialSchema);
      await b1.pushChanges({ accessToken: accessTokens[0], description: "push transform schema" });
      const place = await insertDrawingModelAndCategory(b1, "ConcurrentTransform");
      await insertGeometricElement2d(b1, { ...place, classFullName: "ConcurrentTransform:Pipe1", props: { name: "preserve" } });
      await b1.pushChanges({ accessToken: accessTokens[0], description: "push transform data" });
      await b2.pullChanges({ accessToken: accessTokens[1] });

      await b2.acquireSchemaLock();
      assert.isTrue(b2.holdsSchemaLock);
      await assertThrowsAsyncContaining(
        async () => b1.upgradeSchemaStrings([tinySchemaToXml(widenedSchema)], {
          accessToken: accessTokens[0],
          description: "widen concurrent transform schema",
        }),
        "exclusive lock is already held",
      );

      await b2.locks.releaseAllLocks();
      assert.isFalse(b2.holdsSchemaLock);
      await b1.upgradeSchemaStrings([tinySchemaToXml(widenedSchema)], {
        accessToken: accessTokens[0],
        description: "widen concurrent transform schema",
      });
      assert.include(queryPropNames(b1, "ConcurrentTransform:Struct1"), "p30");
    } finally {
      closeBriefcases(briefcases);
    }
  });

  // The update path requests a shared repository lock, so this records whether an exclusive schema lock still blocks it.
  it("an update-path import is refused while another briefcase holds the exclusive schema lock #extended", async () => {
    const { briefcases, accessTokens } = await createBriefcases({
      containerId: "sync-conc-4-extended",
      iModelName: "sync-conc-update-exclusive-lock",
      briefcaseCount: 2,
      cachePrefix: "syncConc4Extended",
    });
    const [b1, b2] = briefcases;
    try {
      const initialSchema = schemaWithClass("ConcurrentUpdateSchema", "cus", "UpdatePipe", "first");
      const updatedSchema: TinySchema = {
        ...initialSchema,
        ver: "01.00.01",
        classes: [{
          ...initialSchema.classes![0],
          props: [...initialSchema.classes![0].props!, { kind: "primitive", name: "second", type: "string" }],
        }],
      };
      await importTinySchema(b1, initialSchema);
      await b1.pushChanges({ accessToken: accessTokens[0], description: "push update lock schema" });
      await b2.pullChanges({ accessToken: accessTokens[1] });

      await b2.acquireSchemaLock();
      assert.isTrue(b2.holdsSchemaLock);
      await assertThrowsAsyncContaining(
        async () => importTinySchema(b1, updatedSchema),
        "exclusive lock is already held",
      );

      await b2.locks.releaseAllLocks();
      assert.isFalse(b2.holdsSchemaLock);
      await importTinySchema(b1, updatedSchema);
      assert.isTrue(b1.locks.holdsSharedLock(IModel.repositoryModelId));
      assert.isFalse(b1.holdsSchemaLock);
      await b1.pushChanges({ accessToken: accessTokens[0], description: "push update lock schema" });
      await b2.pullChanges({ accessToken: accessTokens[1] });

      assert.deepEqual(queryPropNames(b1, "ConcurrentUpdateSchema:UpdatePipe"), ["first", "second"]);
      assert.deepEqual(queryPropNames(b2, "ConcurrentUpdateSchema:UpdatePipe"), ["first", "second"]);
      expectMetadataTablesIdentical(b1, b2, "after update-path import behind an exclusive lock", { a: "b1", b: "b2" });
      expectPhysicalSchemaIdentical(b1, b2, "after update-path import behind an exclusive lock");
    } finally {
      closeBriefcases(briefcases);
    }
  });

  it("an additive import still goes through while another briefcase is importing additively", async () => {
    const { briefcases, accessTokens } = await createBriefcases({
      containerId: "sync-conc-5",
      iModelName: "sync-conc-additive-lock",
      briefcaseCount: 2,
      cachePrefix: "syncConc5",
    });
    const [b1, b2] = briefcases;
    try {
      await Promise.all([
        importTinySchema(b1, schemaWithClass("AdditiveSchemaA", "asa", "AdditivePipeA", "fromA")),
        importTinySchema(b2, schemaWithClass("AdditiveSchemaB", "asb", "AdditivePipeB", "fromB")),
      ]);
      assert.isTrue(b1.locks.holdsSharedLock(IModel.repositoryModelId));
      assert.isTrue(b2.locks.holdsSharedLock(IModel.repositoryModelId));
      assert.isFalse(b1.holdsSchemaLock);
      assert.isFalse(b2.holdsSchemaLock);

      await pushChangesWithPull(b1, accessTokens[0], "push additive schema A");
      await pushChangesWithPull(b2, accessTokens[1], "push additive schema B");
      await b1.pullChanges({ accessToken: accessTokens[0] });
      await b2.pullChanges({ accessToken: accessTokens[1] });
      assertClassesPresent(b1, ["AdditiveSchemaA:AdditivePipeA", "AdditiveSchemaB:AdditivePipeB"]);
      assertClassesPresent(b2, ["AdditiveSchemaA:AdditivePipeA", "AdditiveSchemaB:AdditivePipeB"]);
    } finally {
      closeBriefcases(briefcases);
    }
  });

  // Three independent allocations into BisCore's shared table expose a duplicate-column assignment that two concurrent imports could hide.
  it("three additive imports converge while competing for one shared column pool #extended", async () => {
    const { briefcases, accessTokens } = await createBriefcases({
      containerId: "sync-conc-5-extended",
      iModelName: "sync-conc-three-shared-pools",
      briefcaseCount: 3,
      cachePrefix: "syncConc5Extended",
    });
    const schemas = [
      sharedPoolSchema("SharedPoolSchemaA", "spsa", "SharedPoolPipeA", "a"),
      sharedPoolSchema("SharedPoolSchemaB", "spsb", "SharedPoolPipeB", "b"),
      sharedPoolSchema("SharedPoolSchemaC", "spsc", "SharedPoolPipeC", "c"),
    ];
    const classNames = schemas.map((schema) => `${schema.name}:${schema.classes![0].name}`);
    const propertyNames = ["a", "b", "c"].flatMap((prefix) => Array.from({ length: 12 }, (_, index) => `${prefix}${index}`));
    try {
      await Promise.all(briefcases.map(async (briefcase, index) => importTinySchema(briefcase, schemas[index])));
      for (const briefcase of briefcases)
        assert.isTrue(briefcase.locks.holdsSharedLock(IModel.repositoryModelId));

      for (const [index, briefcase] of briefcases.entries())
        await pushChangesWithPull(briefcase, accessTokens[index], `push shared pool schema from b${index + 1}`);
      for (const [index, briefcase] of briefcases.entries())
        await briefcase.pullChanges({ accessToken: accessTokens[index] });

      for (const [index, briefcase] of briefcases.entries()) {
        assertClassesPresent(briefcase, classNames);
        for (const [classIndex, schema] of schemas.entries())
          assert.deepEqual(queryPropNames(briefcase, classNames[classIndex]), schema.classes![0].props!.map((property) => property.name));
        expectNoForeignKeyViolations(briefcase, `after three shared pool imports in b${index + 1}`);

        const mapped = queryMappedPropertyColumns(briefcase, propertyNames);
        assert.equal(mapped.length, propertyNames.length, `not every shared pool property has a column in b${index + 1}`);
        const physicalColumns = mapped.map((property) => `${property.tableName}.${property.columnName}`);
        assert.equal(new Set(physicalColumns).size, physicalColumns.length, `two shared pool properties use one column in b${index + 1}`);
        assert.sameMembers(mapped.map((property) => property.propertyName), propertyNames);
      }
      expectMetadataTablesIdentical(briefcases[0], briefcases[1], "after three shared pool imports", { a: "b1", b: "b2" });
      expectMetadataTablesIdentical(briefcases[0], briefcases[2], "after three shared pool imports", { a: "b1", b: "b3" });
      expectPhysicalSchemaIdentical(briefcases[0], briefcases[1], "after three shared pool imports");
      expectPhysicalSchemaIdentical(briefcases[0], briefcases[2], "after three shared pool imports");
    } finally {
      closeBriefcases(briefcases);
    }
  });

  const pushOrders = [
    [0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0],
  ];
  for (const pushOrder of pushOrders) {
    const orderName = pushOrder.map((index) => index + 1).join("");
    it(`three briefcases converge for push order ${orderName} #extended`, async () => {
      const { briefcases, accessTokens } = await createBriefcases({
        containerId: `sync-conc-6-${orderName}`,
        iModelName: `sync-conc-rounds-${orderName}`,
        briefcaseCount: 3,
        cachePrefix: `syncConc6${orderName}`,
      });
      try {
        const cumulativeClassName = "CumulativeSchema:CumulativeElement";
        for (let round = 1; round <= 3; ++round) {
          const schema = cumulativeSchema(round, `01.00.0${round - 1}`);
          await Promise.all(briefcases.map(async (briefcase) => importTinySchema(briefcase, schema)));
          for (const briefcaseIndex of pushOrder)
            await pushChangesWithPull(briefcases[briefcaseIndex], accessTokens[briefcaseIndex], `push cumulative schema round ${round} from b${briefcaseIndex + 1}`);
          for (let index = 0; index < briefcases.length; ++index)
            await briefcases[index].pullChanges({ accessToken: accessTokens[index] });

          const expectedProperties = Array.from({ length: round }, (_, index) => `round${index + 1}`);
          for (const briefcase of briefcases) {
            assertClassesPresent(briefcase, [cumulativeClassName]);
            assert.deepEqual(queryPropNames(briefcase, cumulativeClassName), expectedProperties);
            expectNoForeignKeyViolations(briefcase, `after round ${round} in b${briefcases.indexOf(briefcase) + 1}`);
          }
          expectMetadataTablesIdentical(briefcases[0], briefcases[1], `after round ${round} in order ${orderName}`, { a: "b1", b: "b2" });
          expectMetadataTablesIdentical(briefcases[0], briefcases[2], `after round ${round} in order ${orderName}`, { a: "b1", b: "b3" });
          expectPhysicalSchemaIdentical(briefcases[0], briefcases[1], `after round ${round} in order ${orderName}`);
          expectPhysicalSchemaIdentical(briefcases[0], briefcases[2], `after round ${round} in order ${orderName}`);
        }

        for (const briefcase of briefcases) {
          assertClassesPresent(briefcase, [cumulativeClassName]);
          assert.deepEqual(queryPropNames(briefcase, cumulativeClassName), ["round1", "round2", "round3"]);
          expectNoForeignKeyViolations(briefcase, `after all rounds in b${briefcases.indexOf(briefcase) + 1}`);
        }
        expectMetadataTablesIdentical(briefcases[0], briefcases[1], `after all rounds in order ${orderName}`, { a: "b1", b: "b2" });
        expectMetadataTablesIdentical(briefcases[0], briefcases[2], `after all rounds in order ${orderName}`, { a: "b1", b: "b3" });
        expectPhysicalSchemaIdentical(briefcases[0], briefcases[1], `after all rounds in order ${orderName}`);
        expectPhysicalSchemaIdentical(briefcases[0], briefcases[2], `after all rounds in order ${orderName}`);
      } finally {
        closeBriefcases(briefcases);
      }
    });
  }

  for (const pushOrder of pushOrders) {
    const orderName = pushOrder.map((index) => index + 1).join("");
    // The selected briefcase rebuilds through the exclusive upgrade path while the other two retain local additive imports, changing who owns the sync-db authority at each order position.
    it(`three briefcases converge for mixed upgrade push order ${orderName} #extended`, async () => {
      const { briefcases, accessTokens } = await createBriefcases({
        containerId: `sync-conc-7-${orderName}`,
        iModelName: `sync-conc-upgrade-rounds-${orderName}`,
        briefcaseCount: 3,
        cachePrefix: `syncConc7${orderName}`,
      });
      const upgradeIndex = 1;
      try {
        const cumulativeClassName = "CumulativeSchema:CumulativeElement";
        for (let round = 1; round <= 3; ++round) {
          const schema = cumulativeSchema(round, `01.00.0${round - 1}`);
          await Promise.all(briefcases.map(async (briefcase, index) => {
            if (index !== upgradeIndex)
              await importTinySchema(briefcase, schema);
          }));

          // The upgrade must acquire the exclusive lock while the additive schema transactions remain local.
          for (const [index, briefcase] of briefcases.entries()) {
            if (index !== upgradeIndex)
              await briefcase.locks.releaseAllLocks();
          }

          for (const briefcaseIndex of pushOrder) {
            if (briefcaseIndex === upgradeIndex) {
              await briefcases[briefcaseIndex].upgradeSchemaStrings([tinySchemaToXml(schema)], {
                accessToken: accessTokens[briefcaseIndex],
                description: `upgrade cumulative schema round ${round} from b${briefcaseIndex + 1}`,
              });
            } else {
              await pushChangesWithPull(briefcases[briefcaseIndex], accessTokens[briefcaseIndex], `push cumulative schema round ${round} from b${briefcaseIndex + 1}`);
            }
          }
          for (let index = 0; index < briefcases.length; ++index)
            await briefcases[index].pullChanges({ accessToken: accessTokens[index] });

          const expectedProperties = Array.from({ length: round }, (_, index) => `round${index + 1}`);
          for (const briefcase of briefcases) {
            assertClassesPresent(briefcase, [cumulativeClassName]);
            assert.deepEqual(queryPropNames(briefcase, cumulativeClassName), expectedProperties);
            expectNoForeignKeyViolations(briefcase, `after mixed upgrade round ${round} in b${briefcases.indexOf(briefcase) + 1}`);
          }
          expectMetadataTablesIdentical(briefcases[0], briefcases[1], `after mixed upgrade round ${round} in order ${orderName}`, { a: "b1", b: "b2" });
          expectMetadataTablesIdentical(briefcases[0], briefcases[2], `after mixed upgrade round ${round} in order ${orderName}`, { a: "b1", b: "b3" });
          expectPhysicalSchemaIdentical(briefcases[0], briefcases[1], `after mixed upgrade round ${round} in order ${orderName}`);
          expectPhysicalSchemaIdentical(briefcases[0], briefcases[2], `after mixed upgrade round ${round} in order ${orderName}`);
        }
      } finally {
        closeBriefcases(briefcases);
      }
    });
  }
});
