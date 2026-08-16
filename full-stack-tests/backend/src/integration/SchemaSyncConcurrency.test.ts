/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { Suite } from "mocha";
import { BriefcaseDb, IModelHost } from "@itwin/core-backend";
import { HubMock } from "@itwin/core-backend/lib/cjs/internal/HubMock";
import { AccessToken } from "@itwin/core-bentley";
import { IModel } from "@itwin/core-common";
import "./StartupShutdown"; // calls startup/shutdown IModelHost before/after all tests
import { AzuriteTest } from "./AzuriteTest";
import {
  assertThrowsAsyncContaining, createTestIModel, enableSchemaSync, expectCacheTablesIdentical, expectMetadataTablesIdentical,
  expectNoForeignKeyViolations, expectPhysicalSchemaIdentical, importTinySchema, initializeContainer, insertDrawingModelAndCategory,
  insertGeometricElement2d, listMetadataTables, openTestBriefcase, queryPropNames, readTableRows, TinyPrimitiveProp, TinySchema,
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
});
