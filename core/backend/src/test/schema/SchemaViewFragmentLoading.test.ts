/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Guid, Logger, LogLevel } from "@itwin/core-bentley";
import { GenericSchema, IModelHost, SnapshotDb } from "../../core-backend";
import { SchemaViewPrimitiveType } from "@itwin/ecschema-metadata";
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
 * what arrives. Returns the captured logs so the caller can assert none were produced. This makes
 * the SchemaViewWriter SafeU8/SafeU16 saturation warnings (and any other native warning/error
 * during the body) a hard test signal instead of silently vanishing into a disabled log.
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

  // Warning is the least-severe level we care about; raising to it also lets Errors through.
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
 * the requested schemas plus their reference closure via `PRAGMA schema_view_fragment`, accumulating
 * across calls. These run against a real iModel - the blob is exercised end to end (native writer ->
 * TS reader/merge), which is where the fragment mechanism actually has to work. The blob format
 * itself is an internal C++-writer-to-TS-reader contract and is intentionally not probed directly.
 */
describe("SchemaView fragment loading", () => {
  before(async () => {
    if (!IModelHost.isValid)
      await TestUtils.startBackend();
  });

  /** Create a fresh writable snapshot with FragA + FragB (and BisCore) imported. */
  async function createIModelWithFragSchemas(): Promise<SnapshotDb> {
    const filePath = path.join(KnownTestLocations.outputDir, `SchemaViewFragment-${Guid.createValue()}.bim`);
    const iModel = SnapshotDb.createEmpty(filePath, { rootSubject: { name: "SchemaViewFragmentLoading" } });
    // importSchemaStrings persists the schema changes to this connection, so the PRAGMA reads see
    // them without an explicit saveChanges (which the implicit-transaction policy now disallows).
    await iModel.importSchemaStrings([schemaB, schemaA]);
    return iModel;
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
      // The request resolved to an empty closure; the view is a valid, empty husk.
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
    const iModel = await createIModelWithFragSchemas();
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

  it("loads a real domain schema's reference closure, dropping references that are excluded", async () => {
    // Walk against real schemas rather than synthetic ones. Generic
    // references BisCore plus three schemas that are all on SchemaView's exclusion list
    // (CoreCustomAttributes, BisCustomAttributes, ECDbMap); BisCore in turn references four schemas
    // that are ALL excluded (CoreCustomAttributes, BisCustomAttributes, ECDbMap, ECDbSchemaPolicies).
    // So requesting Generic must yield a view containing exactly Generic + BisCore - the closure walk
    // pulls BisCore, and every excluded reference contributes no rows. See SchemaView.md "What is excluded".
    GenericSchema.registerSchema();
    const filePath = path.join(KnownTestLocations.outputDir, `SchemaViewFragmentGeneric-${Guid.createValue()}.bim`);
    const iModel = SnapshotDb.createEmpty(filePath, { rootSubject: { name: "SchemaViewFragmentGeneric" } });
    try {
      await iModel.importSchemas([GenericSchema.schemaFilePath]);

      // Capture native warnings and errors while the fragment blob is written + parsed. A
      // SafeU8/SafeU16 saturation in SchemaViewWriter (e.g. a re-introduced PrimitiveType
      // truncation) would warn here; assert nothing was logged as a safeguard against regressions.
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
      // each ancestor. Binary (0x101), String (0x901) and Integer (0x501) all truncate to 0x01 if a
      // PrimitiveType is ever written through a too-narrow byte, so asserting these are distinct is a
      // direct regression guard for the kind of narrowing bug we fixed in the enum primitiveType.
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
      // Navigation properties contributed by the chain - present, but carry no primitive type.
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
