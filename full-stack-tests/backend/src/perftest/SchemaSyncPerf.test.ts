/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { Suite } from "mocha";
import * as path from "path";
import { Reporter } from "@itwin/perf-tools";
import { _nativeDb, BriefcaseDb, BriefcaseManager, CloudSqlite, IModelHost, IModelJsFs, SchemaSync, SnapshotDb } from "@itwin/core-backend";
import { HubMock } from "@itwin/core-backend/lib/cjs/internal/HubMock";
import { IModelTestUtils, KnownTestLocations } from "@itwin/core-backend/lib/cjs/test";
import { AccessToken, Guid } from "@itwin/core-bentley";
import { AzuriteTest } from "../integration/AzuriteTest";

const storageType = "azure";

/** Generates ECSchema XML with a configurable number of entity classes and properties per class. */
function buildLargeSchema(name: string, alias: string, version: string, numClasses: number, propsPerClass: number): string {
  const lines: string[] = [];
  lines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  lines.push(`<ECSchema schemaName="${name}" alias="${alias}" version="${version}" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">`);
  lines.push(`  <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>`);
  for (let c = 0; c < numClasses; c++) {
    lines.push(`  <ECEntityClass typeName="Entity${c}">`);
    lines.push(`    <BaseClass>bis:GeometricElement2d</BaseClass>`);
    for (let p = 0; p < propsPerClass; p++) {
      lines.push(`    <ECProperty propertyName="p${p}" typeName="string"/>`);
    }
    lines.push(`  </ECEntityClass>`);
  }
  lines.push(`</ECSchema>`);
  return lines.join("\n");
}

/** Creates and initializes a SchemaSync cloud container backed by the local Azurite instance. */
async function initializeContainer(containerId: string) {
  const baseUri = AzuriteTest.baseUri;
  await AzuriteTest.Sqlite.createAzContainer({ containerId });
  const accessToken = await CloudSqlite.requestToken({ containerId });
  await SchemaSync.CloudAccess.initializeDb({ containerId, baseUri, accessToken, storageType });
  return { containerId, baseUri, accessToken, storageType } as const;
}

/** Opens a new briefcase for the given iModel. */
async function openBriefcase(iModelId: string, iTwinId: string, accessToken: AccessToken): Promise<BriefcaseDb> {
  const props = await BriefcaseManager.downloadBriefcase({ iModelId, iTwinId, accessToken });
  return BriefcaseDb.open(props);
}

describe("SchemaSyncPerf", function (this: Suite) {
  this.timeout(0);

  const reporter = new Reporter();
  const outDir = path.join(KnownTestLocations.outputDir, "SchemaSyncPerformance");

  before(async () => {
    await IModelHost.startup();
    IModelHost.authorizationClient = new AzuriteTest.AuthorizationClient();
    AzuriteTest.userToken = AzuriteTest.service.userToken.readWrite;
    if (!IModelJsFs.existsSync(KnownTestLocations.outputDir))
      IModelJsFs.mkdirSync(KnownTestLocations.outputDir);
    if (!IModelJsFs.existsSync(outDir))
      IModelJsFs.mkdirSync(outDir);
  });

  after(async () => {
    reporter.exportCSV(path.join(outDir, "SchemaSyncPerfResults.csv"));
    IModelHost.authorizationClient = undefined;
    await IModelHost.shutdown();
  });

  /**
   * Measures how long it takes to import schemas of increasing size (classes × properties)
   * into a single briefcase that has SchemaSync enabled.  The import writes to the
   * SchemaSync container so results capture both the EC-schema-import cost and the
   * cloud-write cost.
   */
  it("import large schema via SchemaSync - measure import time", async () => {
    const schemaSizes: Array<{ numClasses: number; propsPerClass: number }> = [
      { numClasses: 1, propsPerClass: 10 },
      { numClasses: 1, propsPerClass: 50 },
      { numClasses: 1, propsPerClass: 100 },
      { numClasses: 5, propsPerClass: 20 },
      { numClasses: 10, propsPerClass: 20 },
      { numClasses: 10, propsPerClass: 50 },
    ];

    for (const { numClasses, propsPerClass } of schemaSizes) {
      const containerId = `perf-import-${Guid.createValue()}`;
      const containerProps = await initializeContainer(containerId);
      const iTwinId = Guid.createValue();

      HubMock.startup("perfSchemaImport", KnownTestLocations.outputDir);
      const version0 = IModelTestUtils.prepareOutputFile("schemaSyncPerf", `import-${numClasses}-${propsPerClass}.bim`);
      SnapshotDb.createEmpty(version0, { rootSubject: { name: "SchemaSyncPerfImport" } }).close();

      const iModelId = await HubMock.createNewIModel({ accessToken: "token1", iTwinId, version0, iModelName: "perfImportModel" });
      const b1 = await openBriefcase(iModelId, iTwinId, "token1");
      SchemaSync.setTestCache(b1, `import-b1-${numClasses}-${propsPerClass}`);

      await SchemaSync.initializeForIModel({ iModel: b1, containerProps });
      await b1.pushChanges({ accessToken: "token1", description: "enable schema sync" });

      const schemaXml = buildLargeSchema("PerfSchema", "ps", "01.00.00", numClasses, propsPerClass);

      const t0 = Date.now();
      await b1.importSchemaStrings([schemaXml]);
      const importMs = Date.now() - t0;

      // Verify the schema landed
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      assert.isDefined(b1.getMetaData("PerfSchema:Entity0"), "Imported schema should be visible on b1");

      reporter.addEntry("SchemaSyncPerf", "ImportSchema", "Execution time(ms)", importMs, {
        numClasses,
        propsPerClass,
        totalProps: numClasses * propsPerClass,
      });

      b1.close();
      HubMock.shutdown();
    }
  });

  /**
   * Imports a large schema on briefcase B1 (without pushing to hub) then measures
   * how long SchemaSync.pull() takes on briefcase B2 to acquire the same schema
   * directly from the shared container.
   */
  it("schema sync pull - measure propagation time to a second briefcase", async () => {
    const schemaSizes: Array<{ numClasses: number; propsPerClass: number }> = [
      { numClasses: 1, propsPerClass: 10 },
      { numClasses: 1, propsPerClass: 50 },
      { numClasses: 1, propsPerClass: 100 },
      { numClasses: 5, propsPerClass: 50 },
      { numClasses: 10, propsPerClass: 50 },
    ];

    for (const { numClasses, propsPerClass } of schemaSizes) {
      const containerId = `perf-pull-${Guid.createValue()}`;
      const containerProps = await initializeContainer(containerId);
      const iTwinId = Guid.createValue();

      HubMock.startup("perfSchemaPull", KnownTestLocations.outputDir);
      const version0 = IModelTestUtils.prepareOutputFile("schemaSyncPerf", `pull-${numClasses}-${propsPerClass}.bim`);
      SnapshotDb.createEmpty(version0, { rootSubject: { name: "SchemaSyncPerfPull" } }).close();

      const iModelId = await HubMock.createNewIModel({ accessToken: "token1", iTwinId, version0, iModelName: "perfPullModel" });

      const b1 = await openBriefcase(iModelId, iTwinId, "token1");
      const b2 = await openBriefcase(iModelId, iTwinId, "token2");
      SchemaSync.setTestCache(b1, `pull-b1-${numClasses}-${propsPerClass}`);
      SchemaSync.setTestCache(b2, `pull-b2-${numClasses}-${propsPerClass}`);

      await SchemaSync.initializeForIModel({ iModel: b1, containerProps });
      await b1.pushChanges({ accessToken: "token1", description: "enable schema sync" });
      await b2.pullChanges({ accessToken: "token2" });

      // B1 imports the large schema — visible in the container but not yet pushed to hub
      const schemaXml = buildLargeSchema("PullSchema", "pls", "01.00.00", numClasses, propsPerClass);
      await b1.importSchemaStrings([schemaXml]);

      // Measure the time for B2 to pull the schema from the container
      const t0 = Date.now();
      await SchemaSync.pull(b2);
      const pullMs = Date.now() - t0;

      // Verify that B2 now sees the schema
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      assert.isDefined(b2.getMetaData("PullSchema:Entity0"), "B2 should see the synced schema after SchemaSync.pull");

      reporter.addEntry("SchemaSyncPerf", "SchemaPull", "Execution time(ms)", pullMs, {
        numClasses,
        propsPerClass,
        totalProps: numClasses * propsPerClass,
      });

      b1.close();
      b2.close();
      HubMock.shutdown();
    }
  });

  /**
   * Repeatedly expands a single schema across multiple rounds (5 → 10 → 20 → 40 → 80 → 100 props)
   * and measures both the per-round import cost on B1 and the per-round pull cost on B2.
   * This simulates a real workflow where a schema evolves over time and collaborators
   * continuously sync the latest version.
   */
  it("incremental schema expansion - measure cumulative import and pull time", async () => {
    const containerId = `perf-incremental-${Guid.createValue()}`;
    const containerProps = await initializeContainer(containerId);
    const iTwinId = Guid.createValue();

    HubMock.startup("perfSchemaIncremental", KnownTestLocations.outputDir);
    const version0 = IModelTestUtils.prepareOutputFile("schemaSyncPerf", "incremental.bim");
    SnapshotDb.createEmpty(version0, { rootSubject: { name: "SchemaSyncPerfIncremental" } }).close();

    const iModelId = await HubMock.createNewIModel({ accessToken: "token1", iTwinId, version0, iModelName: "perfIncrementalModel" });

    const b1 = await openBriefcase(iModelId, iTwinId, "token1");
    const b2 = await openBriefcase(iModelId, iTwinId, "token2");
    SchemaSync.setTestCache(b1, "inc-b1");
    SchemaSync.setTestCache(b2, "inc-b2");

    await SchemaSync.initializeForIModel({ iModel: b1, containerProps });
    await b1.pushChanges({ accessToken: "token1", description: "enable schema sync" });
    await b2.pullChanges({ accessToken: "token2" });

    const propRounds = [5, 10, 20, 40, 80, 100];
    let prevProps = 0;
    let roundIdx = 0;

    for (const totalProps of propRounds) {
      const verMinor = String(roundIdx).padStart(2, "0");
      const schemaXml = buildLargeSchema("IncrSchema", "ics", `01.00.${verMinor}`, 1, totalProps);

      const t1 = Date.now();
      await b1.importSchemaStrings([schemaXml]);
      const importMs = Date.now() - t1;

      const t2 = Date.now();
      await SchemaSync.pull(b2);
      const pullMs = Date.now() - t2;

      const addedProps = totalProps - prevProps;
      reporter.addEntry("SchemaSyncPerf", "IncrementalImport", "Import time(ms)", importMs, {
        totalProps,
        addedProps,
        round: roundIdx + 1,
      });
      reporter.addEntry("SchemaSyncPerf", "IncrementalPull", "Pull time(ms)", pullMs, {
        totalProps,
        addedProps,
        round: roundIdx + 1,
      });

      prevProps = totalProps;
      roundIdx++;
    }

    b1.close();
    b2.close();
    HubMock.shutdown();
  });

  /**
   * Two briefcases (B1 and B2) independently import large schemas into the same
   * SchemaSync container.  B3 then pulls once and should see both schemas.
   * Measures the import time for each briefcase and the single-pull convergence
   * time for B3 (the "catch-up" scenario).
   */
  it("multi-briefcase schema convergence - measure pull catch-up time", async () => {
    const numClasses = 5;
    const propsPerClass = 40;

    const containerId = `perf-convergence-${Guid.createValue()}`;
    const containerProps = await initializeContainer(containerId);
    const iTwinId = Guid.createValue();

    HubMock.startup("perfSchemaConverge", KnownTestLocations.outputDir);
    const version0 = IModelTestUtils.prepareOutputFile("schemaSyncPerf", "convergence.bim");
    SnapshotDb.createEmpty(version0, { rootSubject: { name: "SchemaSyncPerfConverge" } }).close();

    const iModelId = await HubMock.createNewIModel({ accessToken: "token1", iTwinId, version0, iModelName: "perfConvergeModel" });

    const b1 = await openBriefcase(iModelId, iTwinId, "token1");
    const b2 = await openBriefcase(iModelId, iTwinId, "token2");
    const b3 = await openBriefcase(iModelId, iTwinId, "token3");

    SchemaSync.setTestCache(b1, "conv-b1");
    SchemaSync.setTestCache(b2, "conv-b2");
    SchemaSync.setTestCache(b3, "conv-b3");

    await SchemaSync.initializeForIModel({ iModel: b1, containerProps });
    await b1.pushChanges({ accessToken: "token1", description: "enable schema sync" });
    await b2.pullChanges({ accessToken: "token2" });
    await b3.pullChanges({ accessToken: "token3" });

    // B1 imports schema A
    const schemaA = buildLargeSchema("ConvSchemaA", "csa", "01.00.00", numClasses, propsPerClass);
    const tB1Import0 = Date.now();
    await b1.importSchemaStrings([schemaA]);
    const b1ImportMs = Date.now() - tB1Import0;

    // B2 imports schema B (different schema, same size)
    const schemaB = buildLargeSchema("ConvSchemaB", "csb", "01.00.00", numClasses, propsPerClass);
    const tB2Import0 = Date.now();
    await b2.importSchemaStrings([schemaB]);
    const b2ImportMs = Date.now() - tB2Import0;

    // B3 catches up with a single SchemaSync.pull — should see both schemas
    const tB3Pull0 = Date.now();
    await SchemaSync.pull(b3);
    const b3PullMs = Date.now() - tB3Pull0;

    // B1 pulls to pick up B2's schema
    const tB1Pull0 = Date.now();
    await SchemaSync.pull(b1);
    const b1PullMs = Date.now() - tB1Pull0;

    // Verify full convergence
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    assert.isDefined(b3.getMetaData("ConvSchemaA:Entity0"), "B3 should see ConvSchemaA after pull");
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    assert.isDefined(b3.getMetaData("ConvSchemaB:Entity0"), "B3 should see ConvSchemaB after pull");
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    assert.isDefined(b1.getMetaData("ConvSchemaB:Entity0"), "B1 should see ConvSchemaB after pull");

    const meta = { numClasses, propsPerClass, totalPropsPerSchema: numClasses * propsPerClass };
    reporter.addEntry("SchemaSyncPerf", "ConvergenceImportB1", "Execution time(ms)", b1ImportMs, meta);
    reporter.addEntry("SchemaSyncPerf", "ConvergenceImportB2", "Execution time(ms)", b2ImportMs, meta);
    reporter.addEntry("SchemaSyncPerf", "ConvergencePullB3", "Execution time(ms)", b3PullMs, meta);
    reporter.addEntry("SchemaSyncPerf", "ConvergencePullB1", "Execution time(ms)", b1PullMs, meta);

    b1.close();
    b2.close();
    b3.close();
    HubMock.shutdown();
  });

  /**
   * Pushes a large schema from B1 to hub and measures the full end-to-end time for
   * B2 to receive it via pullChanges() (which internally triggers SchemaSync.pull).
   * This is the most realistic scenario — schema changes flow through the hub
   * change set pipeline.
   */
  it("end-to-end schema propagation via pullChanges - measure hub round-trip", async () => {
    const schemaSizes: Array<{ numClasses: number; propsPerClass: number }> = [
      { numClasses: 1, propsPerClass: 20 },
      { numClasses: 5, propsPerClass: 20 },
      { numClasses: 10, propsPerClass: 20 },
      { numClasses: 10, propsPerClass: 50 },
    ];

    for (const { numClasses, propsPerClass } of schemaSizes) {
      const containerId = `perf-e2e-${Guid.createValue()}`;
      const containerProps = await initializeContainer(containerId);
      const iTwinId = Guid.createValue();

      HubMock.startup("perfSchemaE2E", KnownTestLocations.outputDir);
      const version0 = IModelTestUtils.prepareOutputFile("schemaSyncPerf", `e2e-${numClasses}-${propsPerClass}.bim`);
      SnapshotDb.createEmpty(version0, { rootSubject: { name: "SchemaSyncPerfE2E" } }).close();

      const iModelId = await HubMock.createNewIModel({ accessToken: "token1", iTwinId, version0, iModelName: "perfE2EModel" });

      const b1 = await openBriefcase(iModelId, iTwinId, "token1");
      const b2 = await openBriefcase(iModelId, iTwinId, "token2");
      SchemaSync.setTestCache(b1, `e2e-b1-${numClasses}-${propsPerClass}`);
      SchemaSync.setTestCache(b2, `e2e-b2-${numClasses}-${propsPerClass}`);

      await SchemaSync.initializeForIModel({ iModel: b1, containerProps });
      await b1.pushChanges({ accessToken: "token1", description: "enable schema sync" });

      // B1 imports schema and pushes the resulting changeset to hub
      const schemaXml = buildLargeSchema("E2ESchema", "e2e", "01.00.00", numClasses, propsPerClass);
      await b1.importSchemaStrings([schemaXml]);

      const tPush0 = Date.now();
      await b1.pushChanges({ accessToken: "token1", description: "schema push" });
      const pushMs = Date.now() - tPush0;

      // B2 receives the schema via the normal hub pull path (includes SchemaSync.pull internally)
      const tPull0 = Date.now();
      await b2.pullChanges({ accessToken: "token2" });
      const pullMs = Date.now() - tPull0;

      // eslint-disable-next-line @typescript-eslint/no-deprecated
      assert.isDefined(b2.getMetaData("E2ESchema:Entity0"), "B2 should see E2ESchema after pullChanges");

      const meta = { numClasses, propsPerClass, totalProps: numClasses * propsPerClass };
      reporter.addEntry("SchemaSyncPerf", "E2EPushChanges", "Execution time(ms)", pushMs, meta);
      reporter.addEntry("SchemaSyncPerf", "E2EPullChanges", "Execution time(ms)", pullMs, meta);

      b1.close();
      b2.close();
      HubMock.shutdown();
    }
  });
});
