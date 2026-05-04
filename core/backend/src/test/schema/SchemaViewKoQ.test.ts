/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelHost, SnapshotDb } from "../../core-backend";
import { Format, KindOfQuantity, SchemaUnitProvider, type SchemaView, Unit } from "@itwin/ecschema-metadata";
import { QueryBinder, QueryRowFormat } from "@itwin/core-common";
import { assert, expect } from "chai";
import * as path from "path";
import { KnownTestLocations } from "../KnownTestLocations";
import { TestUtils } from "../TestUtils";

/**
 * Example-style tests showing how to access KindOfQuantity presentation formats
 * through SchemaView and resolve the alias-qualified format/unit names
 * into full schema items via ecschema-metadata or ECSQL.
 *
 * Uses sim-master.bim which contains schemas with rich KoQ definitions
 * (AecUnits, RoadRailUnits, LinearReferencing, etc.).
 */
describe("SchemaView KindOfQuantity presentation formats", () => {
  let iModel: SnapshotDb;
  let schemaView: SchemaView;

  before(async () => {
    if (!IModelHost.isValid)
      await TestUtils.startBackend();
    iModel = SnapshotDb.openFile(path.join(KnownTestLocations.assetsDir, "sim-master.bim"));
    schemaView = await iModel.getSchemaView();
  });

  after(() => {
    iModel.close();
  });

  /**
   * Example: get a property's KoQ from SchemaView, then resolve the
   * alias-qualified format and unit names to full ecschema-metadata objects via
   * IModelDb.schemaContext.
   *
   * SchemaView uses alias-qualified names (e.g. "f:DefaultRealU", "u:M")
   * because the Units and Formats schemas are excluded from the SchemaView blob.
   * The alias ("f" -> "Formats", "u" -> "Units") is stored in ec_Schema, so we
   * can resolve it using the schema context that has the full schema set.
   */
  it("should resolve KoQ format and unit names via ecschema-metadata", async () => {
    // --- Step 1: find a property with a KoQ via SchemaView ---
    const rClass = schemaView.findClass("LinearReferencing:DistanceExpression");
    assert.isDefined(rClass, "DistanceExpression class not found");

    const rProp = rClass!.getProperty("DistanceAlongFromStart");
    assert.isDefined(rProp, "DistanceAlongFromStart property not found");

    const prop = rProp!;
    if (!prop.isPrimitive())
      throw new Error("expected primitive");
    const rKoq = prop.kindOfQuantity;
    assert.isDefined(rKoq, "property should have a KoQ");

    // --- Step 2: inspect parsed presentation formats ---
    const formats: readonly SchemaView.PresentationFormat[] = rKoq!.presentationFormats;
    expect(formats.length).to.be.greaterThan(0, "KoQ should have presentation formats");

    // LinearReferencing:LENGTH has: f:DefaultRealU(2)[u:M], f:DefaultRealU(2)[u:FT]
    const first = formats[0];
    expect(first.name).to.equal("f:DefaultRealU");
    expect(first.precision).to.equal(2);
    expect(first.unitAndLabels).to.have.length(1);
    expect(first.unitAndLabels![0][0]).to.equal("u:M");

    // --- Step 3: resolve alias names to full schema items via schemaContext ---
    // The Formats and Units schemas are excluded from SchemaView,
    // but IModelDb.schemaContext (ecschema-metadata) has the full set.
    // Alias "f" -> "Formats", alias "u" -> "Units" - these are standard BIS aliases.

    // Resolve the format: "f:DefaultRealU" -> "Formats.DefaultRealU"
    const formatFullName = `Formats.${first.name.split(":")[1]}`;
    const metaFormat = iModel.schemaContext.getSchemaItemSync(formatFullName, Format);
    assert.isDefined(metaFormat, `Format '${formatFullName}' not found in ecschema-metadata`);
    expect(metaFormat!.precision).to.be.a("number");

    // Resolve the unit: "u:M" -> "Units.M"
    const unitFullName = `Units.${first.unitAndLabels![0][0].split(":")[1]}`;
    const metaUnit = iModel.schemaContext.getSchemaItemSync(unitFullName, Unit);
    assert.isDefined(metaUnit, `Unit '${unitFullName}' not found in ecschema-metadata`);
    expect(metaUnit!.fullName).to.equal("Units.M");

    // Access unit details like label and unit system
    const unitSystem = await metaUnit!.unitSystem;
    assert.isDefined(unitSystem, "unit should have a unit system");
    expect(unitSystem!.name).to.equal("SI");

    // --- Step 4: cross-validate against the KoQ in ecschema-metadata ---
    const metaKoq = iModel.schemaContext.getSchemaItemSync("LinearReferencing", "LENGTH", KindOfQuantity);
    assert.isDefined(metaKoq, "KoQ not found in ecschema-metadata");
    expect(metaKoq!.relativeError).to.equal(rKoq!.relativeError);

    const metaFormats = metaKoq!.presentationFormats;
    expect(metaFormats.length).to.equal(formats.length);

    // ecschema-metadata resolves the formats fully - cross-check the format names
    for (let i = 0; i < formats.length; i++) {
      const rtItemName = formats[i].name.split(":")[1];
      const metaItemName = metaFormats[i].fullName.split(/[:.]/).pop();
      expect(rtItemName).to.equal(metaItemName, `format name mismatch at index ${i}`);
    }

    // The SchemaUnitProvider bridges ecschema-metadata units to the @itwin/core-quantity package.
    // Use it to build a FormatterSpec for quantity formatting:
    const unitsProvider = new SchemaUnitProvider(iModel.schemaContext);
    const persistenceUnitProps = await unitsProvider.findUnitByName("Units.M");
    expect(persistenceUnitProps.name).to.equal("Units.M");
  });

  /**
   * Example: get a KoQ from SchemaView, then query ECDbMeta via ECSQL
   * to resolve the referenced format and unit definitions.
   *
   * This approach avoids loading the full ecschema-metadata schema set and works
   * well for targeted lookups - e.g. "I have a format name, give me its NumericSpec."
   */
  it("should resolve KoQ format and unit names via ECSQL", async () => {
    // --- Step 1: find a KoQ via SchemaView ---
    const rKoq = schemaView.findKindOfQuantity("LinearReferencing:LENGTH");
    assert.isDefined(rKoq, "KoQ not found in SchemaView");

    const formats = rKoq!.presentationFormats;
    expect(formats.length).to.be.greaterThan(0);

    // --- Step 2: resolve the format name via meta.FormatDef ---
    // "f:DefaultRealU" -> format name is "DefaultRealU" in the "Formats" schema
    const first = formats[0];
    const formatItemName = first.name.split(":")[1]; // "DefaultRealU"

    // Query FormatDef to get the format's NumericSpec (= FormatProps JSON)
    let formatNumericSpec: any;
    for await (const row of iModel.createQueryReader(
      `SELECT NumericSpec, CompositeSpec FROM meta.FormatDef WHERE Name = ? AND Schema.Name = 'Formats'`,
      QueryBinder.from([formatItemName]),
      { rowFormat: QueryRowFormat.UseJsPropertyNames },
    )) {
      formatNumericSpec = row.toRow();
    }
    assert.isDefined(formatNumericSpec, `FormatDef '${formatItemName}' not found via ECSQL`);

    // NumericSpec is a JSON string with the format properties (type, precision, traits, etc.)
    const numericSpec = JSON.parse(formatNumericSpec.numericSpec);
    expect(numericSpec.type).to.equal("Decimal");
    expect(numericSpec.precision).to.be.a("number");

    // The presentation format can override precision - e.g. the override "(2)" means precision 2
    if (first.precision !== undefined)
      expect(first.precision).to.equal(2); // our override

    // --- Step 3: resolve the unit name via meta.UnitDef ---
    // "u:M" -> unit name is "M" in the "Units" schema
    const unitItemName = first.unitAndLabels![0][0].split(":")[1]; // "M"

    let unitRow: any;
    for await (const row of iModel.createQueryReader(
      `SELECT Name, DisplayLabel, UnitSystem.Name AS unitSystemName FROM meta.UnitDef WHERE Name = ? AND Schema.Name = 'Units'`,
      QueryBinder.from([unitItemName]),
      { rowFormat: QueryRowFormat.UseJsPropertyNames },
    )) {
      unitRow = row.toRow();
    }
    assert.isDefined(unitRow, `UnitDef '${unitItemName}' not found via ECSQL`);
    expect(unitRow.name).to.equal("M");
    expect(unitRow.unitSystemName).to.equal("SI");

    // --- Step 4: query the format's composite units (base format units, before overrides) ---
    // DefaultRealU has no composite units (it's a single-unit format), but AngleDMS does.
    // Let's also check the second KoQ format which might have composite units.
    const angleKoq = schemaView.findKindOfQuantity("RoadRailUnits:ANGLE");
    if (angleKoq) {
      const angleFormats = angleKoq.presentationFormats;
      // The AngleDMS format has composite units: ARC_DEG, ARC_MINUTE, ARC_SECOND
      const dmsFormat = angleFormats.find((f) => f.name.split(":")[1] === "AngleDMS");
      if (dmsFormat) {
        const compositeUnits: Array<{ ordinal: number; unitName: string; label: string }> = [];
        for await (const row of iModel.createQueryReader(
          `SELECT cu.Ordinal, cu.Unit.Name AS unitName, cu.Label
           FROM meta.FormatCompositeUnitDef cu
           WHERE cu.Format.Name = 'AngleDMS' AND cu.Format.Schema.Name = 'Formats'
           ORDER BY cu.Ordinal`,
          undefined,
          { rowFormat: QueryRowFormat.UseJsPropertyNames },
        )) {
          compositeUnits.push(row.toRow());
        }
        expect(compositeUnits.length).to.equal(3, "AngleDMS should have 3 composite units");
        expect(compositeUnits[0].unitName).to.equal("ARC_DEG");
        expect(compositeUnits[1].unitName).to.equal("ARC_MINUTE");
        expect(compositeUnits[2].unitName).to.equal("ARC_SECOND");
      }
    }
  });
});
