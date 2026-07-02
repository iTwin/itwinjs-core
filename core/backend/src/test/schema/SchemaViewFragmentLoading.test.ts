/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Guid, Logger, LogLevel, OpenMode } from "@itwin/core-bentley";
import { GenericSchema, IModelHost, IModelJsFs, StandaloneDb } from "../../core-backend";
import { type SchemaView, SchemaViewPrimitiveType } from "@itwin/ecschema-metadata";
import { expect } from "chai";
import * as path from "path";
import * as sinon from "sinon";
import { KnownTestLocations } from "../KnownTestLocations";
import { TestUtils } from "../TestUtils";

/** Categories of native log messages worth treating as a test failure. Native code routes through
 * `Logger`, so a C++ `warningv`/`errorv` surfaces here once the category level is raised. */
const monitoredNativeCategories = ["ECDb", "ECObjectsNative"];

/** A captured native log message. */
interface CapturedNativeLog {
  level: "Warning" | "Error";
  category: string;
  message: string;
}

/** Run `body` while capturing native warnings and errors from the monitored categories.
 *
 * The test harness initializes the logger with all categories off, so native warnings/errors are
 * dropped before they ever reach JS. To observe them we must (1) raise each monitored category to
 * Warning - which fires onLogLevelChanged, prompting the native side to re-read levels and start
 * emitting (Warning and anything more severe, i.e. Error too) - and (2) install sinks to collect
 * what arrives. Returns the captured logs so the caller can assert none were produced.
 */
async function captureNativeLogs(body: () => Promise<void>): Promise<CapturedNativeLog[]> {
  const logs: CapturedNativeLog[] = [];
  const previousLevels = new Map(monitoredNativeCategories.map((category) => [category, Logger.getLevel(category)]));

  const warningStub = sinon.stub(Logger, "logWarning").callsFake((category: string, message: string) => {
    if (monitoredNativeCategories.includes(category))
      logs.push({ level: "Warning", category, message });
  });
  const errorStub = sinon.stub(Logger, "logError").callsFake((category: string, messageOrError: unknown) => {
    if (monitoredNativeCategories.includes(category))
      logs.push({ level: "Error", category, message: typeof messageOrError === "string" ? messageOrError : String(messageOrError) });
  });

  for (const category of monitoredNativeCategories)
    Logger.setLevel(category, LogLevel.Warning);

  try {
    await body();
  } finally {
    warningStub.restore();
    errorStub.restore();
    for (const [category, previousLevel] of previousLevels)
      Logger.setLevel(category, previousLevel ?? LogLevel.None);
  }
  return logs;
}

/** SchemaB references BisCore and defines BElement deriving from a BisCore class. */
const schemaB = `<?xml version="1.0" encoding="UTF-8"?>
  <ECSchema schemaName="FragB" alias="fb" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
    <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
    <ECEntityClass typeName="BElement">
      <BaseClass>bis:PhysicalElement</BaseClass>
      <ECProperty propertyName="BProp" typeName="string"/>
    </ECEntityClass>
  </ECSchema>`;

/** SchemaA references FragB and derives AElement from FragB:BElement.
 * So loading FragA must transitively pull FragB (and, through it, BisCore). */
const schemaA = `<?xml version="1.0" encoding="UTF-8"?>
  <ECSchema schemaName="FragA" alias="fa" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
    <ECSchemaReference name="FragB" version="01.00.00" alias="fb"/>
    <ECEntityClass typeName="AElement">
      <BaseClass>fb:BElement</BaseClass>
      <ECProperty propertyName="AProp" typeName="int"/>
    </ECEntityClass>
  </ECSchema>`;

/** A third schema imported after the first load, to exercise cache invalidation. */
const schemaC = `<?xml version="1.0" encoding="UTF-8"?>
  <ECSchema schemaName="FragC" alias="fc" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
    <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
    <ECEntityClass typeName="CElement">
      <BaseClass>bis:PhysicalElement</BaseClass>
      <ECProperty propertyName="CProp" typeName="string"/>
    </ECEntityClass>
  </ECSchema>`;

/**
 * Tests the incremental ("husk") schema-view path: `getSchemaView({ schemas: [...] })` loads only
 * the requested schemas plus their references via `PRAGMA schema_view_fragment`, accumulating
 * across calls. These run against a real iModel - the blob is exercised end to end (native writer ->
 * TS reader/merge), which is where the fragment mechanism actually has to work. The blob format
 * itself is an internal C++-writer-to-TS-reader contract.
 */
describe("SchemaView fragment loading", () => {
  // Building an empty iModel and importing schemas into it dominates this suite's runtime, so each
  // seed below is created once in `before`. Each test then just needs a writable file of its own -
  // a raw file copy plus `StandaloneDb.openFile` - rather than paying for createEmpty + schema import
  // again, or for the checkpoint/vacuum overhead that `SnapshotDb.createFrom` adds on top of the copy.
  let fragSeedDb: StandaloneDb;
  let genericSeedDb: StandaloneDb;

  before(async () => {
    if (!IModelHost.isValid)
      await TestUtils.startBackend();

    const fragSeedPath = path.join(KnownTestLocations.outputDir, `SchemaViewFragmentSeed-${Guid.createValue()}.bim`);
    fragSeedDb = StandaloneDb.createEmpty(fragSeedPath, { rootSubject: { name: "SchemaViewFragmentLoadingSeed" } });
    await fragSeedDb.importSchemaStrings([schemaB, schemaA]);
    fragSeedDb.performCheckpoint(); // flush + truncate the WAL so the raw file copy below is consistent

    GenericSchema.registerSchema();
    const genericSeedPath = path.join(KnownTestLocations.outputDir, `SchemaViewFragmentGenericSeed-${Guid.createValue()}.bim`);
    genericSeedDb = StandaloneDb.createEmpty(genericSeedPath, { rootSubject: { name: "SchemaViewFragmentGenericSeed" } });
    await genericSeedDb.importSchemas([GenericSchema.schemaFilePath]);
    genericSeedDb.performCheckpoint();
  });

  after(() => {
    fragSeedDb.close();
    genericSeedDb.close();
  });

  /** Clone a writable iModel from a seed's file via a raw file copy - no checkpoint/vacuum. Only
   * needed by the handful of tests that mutate the iModel (e.g. importing another schema); every
   * other test just opens a second read-only connection directly onto the seed's file below. */
  function cloneSeed(seedDb: StandaloneDb, namePrefix: string): StandaloneDb {
    const filePath = path.join(KnownTestLocations.outputDir, `${namePrefix}-${Guid.createValue()}.bim`);
    IModelJsFs.copySync(seedDb.pathName, filePath);
    return StandaloneDb.openFile(filePath, OpenMode.ReadWrite);
  }

  /** Get an iModel backed by the FragA/FragB (and BisCore) seed. Read-only by default - just another
   * connection onto the same file, no copy - since most tests only read a `SchemaView` off it. Pass
   * `writable: true` for the rare test that needs to mutate the iModel (e.g. import another schema),
   * which gets its own private copy so it can't affect the shared seed or other tests. */
  async function createIModelWithFragSchemas(options?: { writable?: boolean }): Promise<StandaloneDb> {
    if (options?.writable)
      return cloneSeed(fragSeedDb, "SchemaViewFragment");
    return StandaloneDb.openFile(fragSeedDb.pathName, OpenMode.Readonly);
  }

  /** Every schema name in the iModel, straight from ECDbMeta - the same source the schema manifest
   * is built from - so tests never hardcode the schema inventory of an empty snapshot. */
  async function queryAllSchemaNames(iModel: StandaloneDb): Promise<string[]> {
    const schemaNames: string[] = [];
    for await (const row of iModel.createQueryReader("SELECT Name FROM meta.ECSchemaDef"))
      schemaNames.push(row[0] as string);
    return schemaNames;
  }

  /** The sorted names of every schema present in a view. */
  function getSortedViewSchemaNames(view: SchemaView): string[] {
    return [...view.getSchemas()].map((schema) => schema.name).sort();
  }

  it("loads a requested schema and its reference closure, leaving unrequested schemas absent", async () => {
    const iModel = await createIModelWithFragSchemas();
    try {
      // Request only FragB. It references BisCore, so both must be present; FragA must not be.
      const view = await iModel.getSchemaView({ schemas: ["FragB"] });

      expect(view.getSchema("FragB"), "FragB was requested").to.not.be.undefined;
      expect(view.getSchema("BisCore"), "BisCore is in FragB's closure").to.not.be.undefined;
      expect(view.getSchema("FragA"), "FragA was not requested and nothing pulled it in").to.be.undefined;

      expect(view.findClass("FragB:BElement")).to.not.be.undefined;
      expect(view.findClass("FragA:AElement")).to.be.undefined;
    } finally {
      iModel.close();
    }
  });

  it("pulls transitive dependencies when loading a dependent schema", async () => {
    const iModel = await createIModelWithFragSchemas();
    try {
      // FragA -> FragB -> BisCore. Requesting FragA alone must make the whole chain resolvable.
      const view = await iModel.getSchemaView({ schemas: ["FragA"] });

      expect(view.getSchema("FragA")).to.not.be.undefined;
      expect(view.getSchema("FragB")).to.not.be.undefined;
      expect(view.getSchema("BisCore")).to.not.be.undefined;

      const aElement = view.findClass("FragA:AElement");
      expect(aElement).to.not.be.undefined;
      // Cross-schema base class resolves across the closure.
      expect(aElement!.baseClass?.fullName).to.equal("FragB:BElement");
      // And transitively up into BisCore.
      expect(aElement!.is("BisCore:PhysicalElement")).to.be.true;
    } finally {
      iModel.close();
    }
  });

  it("accumulates schemas across calls into one view", async () => {
    const iModel = await createIModelWithFragSchemas();
    try {
      const view1 = await iModel.getSchemaView({ schemas: ["FragB"] });
      expect(view1.getSchema("FragA")).to.be.undefined;

      // A second call for FragA merges into the same accumulating view.
      const view2 = await iModel.getSchemaView({ schemas: ["FragA"] });
      expect(view2, "subset view is a single accumulating instance").to.equal(view1);

      // Both schemas are now resolvable on the one view.
      expect(view2.findClass("FragA:AElement")).to.not.be.undefined;
      expect(view2.findClass("FragB:BElement")).to.not.be.undefined;
    } finally {
      iModel.close();
    }
  });

  it("is idempotent when re-requesting an already-loaded schema", async () => {
    const iModel = await createIModelWithFragSchemas();
    try {
      const view1 = await iModel.getSchemaView({ schemas: ["FragA"] });
      const aElement1 = view1.findClass("FragA:AElement");
      expect(aElement1).to.not.be.undefined;

      // Re-requesting loads nothing new and returns the same instance with stable indices.
      const view2 = await iModel.getSchemaView({ schemas: ["FragA", "FragB"] });
      expect(view2).to.equal(view1);
      expect(view2.findClass("FragA:AElement")!.idx).to.equal(aElement1!.idx);
    } finally {
      iModel.close();
    }
  });

  it("ignores schema names the iModel does not contain", async () => {
    const iModel = await createIModelWithFragSchemas();
    try {
      const view = await iModel.getSchemaView({ schemas: ["DoesNotExist"] });
      expect(view.getSchema("DoesNotExist")).to.be.undefined;
      // No real schemas requested; the view is a valid, empty husk.
      expect(view.schemaCount).to.equal(0);
    } finally {
      iModel.close();
    }
  });

  it("serializes overlapping concurrent loads without double-merging", async () => {
    const iModel = await createIModelWithFragSchemas();
    try {
      // Fire overlapping requests whose closures share BisCore. The merge queue must coalesce so no
      // schema is merged twice (which would surface as duplicate classes).
      const [v1, v2] = await Promise.all([
        iModel.getSchemaView({ schemas: ["FragA"] }),
        iModel.getSchemaView({ schemas: ["FragB"] }),
      ]);
      expect(v2).to.equal(v1);

      // Exactly one BElement and one AElement - no duplicates from a double merge.
      let bElementCount = 0;
      let aElementCount = 0;
      for (const schema of v1.getSchemas()) {
        for (const cls of schema.getClasses()) {
          if (cls.fullName === "FragB:BElement") bElementCount++;
          if (cls.fullName === "FragA:AElement") aElementCount++;
        }
      }
      expect(bElementCount, "BElement merged exactly once").to.equal(1);
      expect(aElementCount, "AElement merged exactly once").to.equal(1);
    } finally {
      iModel.close();
    }
  });

  it("invalidates the subset husk after a schema import", async () => {
    const iModel = await createIModelWithFragSchemas({ writable: true });
    try {
      const view1 = await iModel.getSchemaView({ schemas: ["FragB"] });
      expect(view1.getSchema("FragB")).to.not.be.undefined;
      expect(view1.isOutdated).to.be.false;

      // Importing a schema calls clearCaches, which drops the husk and its loaded-set.
      await iModel.importSchemaStrings([schemaC]);
      expect(view1.isOutdated, "the old husk is marked outdated").to.be.true;

      // A fresh request rebuilds against the new schema state - a different instance that can now
      // load the newly imported schema.
      const view2 = await iModel.getSchemaView({ schemas: ["FragC"] });
      expect(view2, "a new husk is built after invalidation").to.not.equal(view1);
      expect(view2.findClass("FragC:CElement")).to.not.be.undefined;
    } finally {
      iModel.close();
    }
  });

  it("the full view (no args) still contains everything the subset path can load", async () => {
    const iModel = await createIModelWithFragSchemas();
    try {
      const full = await iModel.getSchemaView();
      expect(full.findClass("FragA:AElement"), "full view has the domain class").to.not.be.undefined;
      expect(full.findClass("FragB:BElement")).to.not.be.undefined;
    } finally {
      iModel.close();
    }
  });

  it("an unfiltered call after a filtered one merges the remaining schemas into the same view and collapses to full mode", async () => {
    const iModel = await createIModelWithFragSchemas();
    try {
      // Start incremental: only FragB (+ BisCore) is loaded.
      const subsetView = await iModel.getSchemaView({ schemas: ["FragB"] });
      expect(subsetView.getSchema("FragA")).to.be.undefined;

      // The unfiltered call means "I need everything": it must merge the rest into the SAME instance.
      const fullView = await iModel.getSchemaView();
      expect(fullView, "the husk accumulates; no new instance").to.equal(subsetView);
      expect(fullView.findClass("FragA:AElement"), "previously missing schema is now merged").to.not.be.undefined;
      expect(fullView.findClass("FragB:BElement"), "earlier schemas remain available").to.not.be.undefined;

      // The unfiltered merge must have collapsed the incremental bookkeeping into full mode: any
      // further request - filtered or not - is a synchronous no-op that issues no queries.
      const queryReaderSpy = sinon.spy(iModel, "createQueryReader");
      try {
        const filteredAgain = await iModel.getSchemaView({ schemas: ["FragA"] });
        const unfilteredAgain = await iModel.getSchemaView();
        expect(filteredAgain).to.equal(fullView);
        expect(unfilteredAgain).to.equal(fullView);
        expect(queryReaderSpy.notCalled, "fully loaded view is served without any queries").to.be.true;
      } finally {
        queryReaderSpy.restore();
      }
    } finally {
      iModel.close();
    }
  });

  it("filling the view schema-by-schema via filters collapses to full mode and matches a full load", async () => {
    const iModel = await createIModelWithFragSchemas();
    try {
      // Request every schema the iModel contains, one filtered call at a time. The names come from
      // ECDbMeta (the manifest's own source), so nothing about the snapshot's schema inventory is
      // hardcoded - this also exercises requesting excluded schemas (e.g. CoreCustomAttributes)
      // directly, which must be tolerated and contribute nothing.
      const allSchemaNames = await queryAllSchemaNames(iModel);
      expect(allSchemaNames.length, "snapshot contains more schemas than the two imported ones").to.be.greaterThan(2);

      let accumulatingView: SchemaView | undefined;
      for (const schemaName of allSchemaNames) {
        const view = await iModel.getSchemaView({ schemas: [schemaName] });
        if (accumulatingView === undefined)
          accumulatingView = view;
        else
          expect(view, "every filtered call returns the one accumulating instance").to.equal(accumulatingView);
      }
      if (accumulatingView === undefined)
        expect.fail("no schema view was obtained");

      // Once every schema has been requested, the view must have collapsed to full mode: an
      // unfiltered request is a synchronous no-op on the same instance, with no queries issued.
      const queryReaderSpy = sinon.spy(iModel, "createQueryReader");
      try {
        const fullRequest = await iModel.getSchemaView();
        expect(fullRequest).to.equal(accumulatingView);
        expect(queryReaderSpy.notCalled, "collapsed view is served without any queries").to.be.true;
      } finally {
        queryReaderSpy.restore();
      }

      // The fragment-filled view must be equivalent to a from-scratch full load of the same iModel:
      // same schemas present (both paths apply the same exclusion list in the native writer).
      const rebuiltFullView = await iModel.getSchemaView({ forceReload: true });
      expect(rebuiltFullView).to.not.equal(accumulatingView);
      expect(getSortedViewSchemaNames(accumulatingView), "fragment fill and full load agree on the schema set")
        .to.deep.equal(getSortedViewSchemaNames(rebuiltFullView));
    } finally {
      iModel.close();
    }
  });

  describe("forceReload", () => {
    it("discards an accumulated husk and rebuilds from scratch", async () => {
      const iModel = await createIModelWithFragSchemas();
      try {
        // Accumulate FragA + FragB into one husk.
        const view1 = await iModel.getSchemaView({ schemas: ["FragA"] });
        expect(view1.getSchema("FragB")).to.not.be.undefined;
        expect(view1.isOutdated).to.be.false;

        // forceReload with a narrower filter: the old husk is dropped and marked outdated, and the
        // rebuilt view contains only the newly requested closure - FragA is gone.
        const view2 = await iModel.getSchemaView({ schemas: ["FragB"], forceReload: true });
        expect(view2).to.not.equal(view1);
        expect(view1.isOutdated, "the discarded husk is marked outdated").to.be.true;
        expect(view2.isOutdated).to.be.false;
        expect(view2.getSchema("FragB")).to.not.be.undefined;
        expect(view2.getSchema("FragA"), "rebuild starts from scratch; earlier schemas are not carried over").to.be.undefined;
      } finally {
        iModel.close();
      }
    });

    it("rebuilds a fully loaded view", async () => {
      const iModel = await createIModelWithFragSchemas();
      try {
        const view1 = await iModel.getSchemaView();
        const view2 = await iModel.getSchemaView({ forceReload: true });
        expect(view2).to.not.equal(view1);
        expect(view1.isOutdated).to.be.true;
        expect(view2.isOutdated).to.be.false;
        // The rebuilt view is complete again.
        expect(getSortedViewSchemaNames(view2)).to.deep.equal(getSortedViewSchemaNames(view1));
      } finally {
        iModel.close();
      }
    });

    it("is serialized behind an in-flight load", async () => {
      const iModel = await createIModelWithFragSchemas();
      try {
        // Fire a load and a forceReload without awaiting in between. The reload must wait for the
        // first load to finish, then discard its result - never tearing down state mid-load.
        const [view1, view2] = await Promise.all([
          iModel.getSchemaView({ schemas: ["FragA"] }),
          iModel.getSchemaView({ schemas: ["FragA"], forceReload: true }),
        ]);
        expect(view2).to.not.equal(view1);
        expect(view1.isOutdated, "the first load's view was discarded by the reload").to.be.true;
        expect(view2.isOutdated).to.be.false;
        expect(view2.findClass("FragA:AElement"), "the rebuilt view is fully usable").to.not.be.undefined;
      } finally {
        iModel.close();
      }
    });
  });

  it("loads a real domain schema's reference closure, dropping references that are excluded", async () => {
    // Walk against real schemas. Generic references BisCore plus three schemas that are all on SchemaView's
    // exclusion list. BisCore in turn references four schemas that are ALL excluded.
    // So requesting Generic must yield a view containing exactly Generic + BisCore - the walk
    // pulls BisCore, and every excluded reference contributes no rows.
    const iModel = StandaloneDb.openFile(genericSeedDb.pathName, OpenMode.Readonly);
    try {
      // Capture native warnings and errors while the fragment blob is written + parsed.
      // assert nothing was logged as a safeguard against regressions.
      let schemaView: Awaited<ReturnType<typeof iModel.getSchemaView>> | undefined;
      const nativeLogs = await captureNativeLogs(async () => {
        schemaView = await iModel.getSchemaView({ schemas: ["Generic"] });
      });
      expect(
        nativeLogs,
        `native warnings/errors during getSchemaView:\n${nativeLogs.map((l) => `${l.level} | ${l.category} | ${l.message}`).join("\n")}`,
      ).to.be.empty;
      expect(schemaView, "schema view was obtained").to.not.be.undefined;
      if (!schemaView)
        return;

      // The requested schema and its one non-excluded reference are present.
      expect(schemaView.getSchema("Generic"), "Generic was requested").to.not.be.undefined;
      expect(schemaView.getSchema("BisCore"), "BisCore is Generic's only non-excluded reference").to.not.be.undefined;

      // Every excluded reference in the closure contributes nothing to the view.
      for (const excluded of ["CoreCustomAttributes", "BisCustomAttributes", "ECDbMap", "ECDbSchemaPolicies"])
        expect(schemaView.getSchema(excluded), `${excluded} is excluded from SchemaView`).to.be.undefined;

      // The view contains exactly the two non-excluded schemas - nothing leaked in from the closure.
      expect(schemaView.schemaCount, "view holds exactly Generic + BisCore").to.equal(2);

      // A cross-schema base-class reference resolves across the loaded closure.
      const physicalObject = schemaView.findClass("Generic:PhysicalObject");
      expect(physicalObject, "Generic:PhysicalObject is loaded").to.not.be.undefined;
      expect(physicalObject!.is("BisCore:PhysicalElement"), "resolves up into BisCore").to.be.true;

      // PhysicalObject's immediate base is bis:PhysicalElement, resolved across the schema boundary.
      const baseClass = physicalObject!.baseClass;
      expect(baseClass, "PhysicalObject has a base class").to.not.be.undefined;
      expect(baseClass!.fullName, "base class is bis:PhysicalElement").to.equal("BisCore:PhysicalElement");

      // PhysicalObject defines no own properties, so walking its properties must surface only the
      // ones inherited from the BisCore ancestor chain (PhysicalElement -> ... -> Element). This
      // proves the cross-schema property inheritance walk is hydrated correctly.
      expect(physicalObject!.getOwnProperties(), "PhysicalObject has no own properties").to.have.lengthOf(0);

      // Expected primitive type for a sampling of inherited primitive properties, one (or more) from
      // each ancestor.
      const expectedPrimitiveTypes = new Map<string, SchemaViewPrimitiveType>([
        ["FederationGuid", SchemaViewPrimitiveType.Binary],   // Element, binary
        ["CodeValue", SchemaViewPrimitiveType.String],        // Element, string
        ["UserLabel", SchemaViewPrimitiveType.String],        // Element, string
        ["LastMod", SchemaViewPrimitiveType.DateTime],        // Element, dateTime
        ["InSpatialIndex", SchemaViewPrimitiveType.Boolean],  // GeometricElement3d, boolean
        ["Origin", SchemaViewPrimitiveType.Point3d],          // GeometricElement3d, point3d
        ["Yaw", SchemaViewPrimitiveType.Double],              // GeometricElement3d, double
        ["GeometryStream", SchemaViewPrimitiveType.Binary],   // GeometricElement3d, binary
      ]);
      // Navigation properties contributed by the chain
      const expectedNavProperties = ["Model", "CodeSpec", "Category", "PhysicalMaterial"];

      // First walk: getProperties() returns the full inherited set. Verify each expected property is
      // present and, for primitives, that its primitive type survived hydration intact.
      const propertiesByName = new Map(physicalObject!.getProperties().map((p) => [p.name, p]));
      for (const [name, primitiveType] of expectedPrimitiveTypes) {
        const property = propertiesByName.get(name);
        expect(property, `inherited property "${name}" is present`).to.not.be.undefined;
        if (!property) continue; // narrows for the type checker; expect already failed if undefined
        if (!property.isPrimitive())
          expect.fail(`inherited property "${name}" should be primitive`);
        expect(property.primitiveType, `"${name}" primitive type`).to.equal(primitiveType);
      }
      for (const name of expectedNavProperties) {
        const property = propertiesByName.get(name);
        expect(property, `inherited navigation property "${name}" is present`).to.not.be.undefined;
        if (!property) continue;
        expect(property.isNavigation(), `"${name}" is a navigation property`).to.be.true;
      }

      // Second walk: the single getProperty(name) accessor resolves the same inherited properties
      // (case-insensitively) and reports the same primitive types.
      for (const [name, primitiveType] of expectedPrimitiveTypes) {
        const property = physicalObject!.getProperty(name);
        expect(property, `getProperty("${name}") resolves`).to.not.be.undefined;
        if (!property) continue;
        if (!property.isPrimitive())
          expect.fail(`getProperty("${name}") should be primitive`);
        expect(property.primitiveType, `getProperty("${name}") primitive type`).to.equal(primitiveType);
      }
    } finally {
      iModel.close();
    }
  });
});
