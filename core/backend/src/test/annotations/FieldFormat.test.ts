/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import { Code, FieldRun, PhysicalElementProps, SubCategoryAppearance, TextBlock } from "@itwin/core-common";
import { FormatSet, SchemaFormatsProvider } from "@itwin/ecschema-metadata";
import { FormattingSpecArgs } from "@itwin/core-quantity";
import { Id64String } from "@itwin/core-bentley";
import { Point3d, XYAndZ, YawPitchRollAngles } from "@itwin/core-geometry";
import { StandaloneDb } from "../../IModelDb";
import { IModelTestUtils } from "../IModelTestUtils";
import { SpatialCategory } from "../../Category";
import { Schema, Schemas } from "../../Schema";
import { ClassRegistry } from "../../ClassRegistry";
import { PhysicalElement } from "../../Element";
import { ElementDrivesTextAnnotation } from "../../annotations/ElementDrivesTextAnnotation";
import { FieldFormattingSpecProvider } from "../../annotations/FieldFormattingSpecProvider";
import { decimalFormat, toFormatSet } from "../AnnotationTestUtils";
import { withEditTxn } from "../../EditTxn";

/**
 * How a [FieldRun]'s quantity format is resolved.
 *
 * Each test varies the three inputs on `formatOptions.quantity` -- `formatSet`,
 * `kindOfQuantity`, and `persistenceUnit` -- and applies them to properties chosen so that some
 * carry their own KindOfQuantity and some do not. That split is the dominant axis: a failed
 * override is silently rescued by the property-side candidate when the property carries a KoQ,
 * and only falls through to the raw string when it does not.
 *
 * Formats resolve in this order, and the tests below walk it from the bottom up: the FormatSet a
 * field names, then the FormatSet adopted for the iModel, then the schema's own presentation
 * format for the property's KindOfQuantity, then the raw value.
 *
 * Each test registers the FormatSets it depends on inline, so what produced a given string is
 * visible without cross-referencing a table.
 */

// cspell: ignore koqs

const ADOPTED_SET = "adopted-set";
const ALT_SET = "alternate-set";
/** Deliberately never registered, so `getProviderFor` falls back to the adopted bucket. */
const UNREGISTERED_SET = "unregistered-set";

// ---------------------------------------------------------------------------------------------
// Test schema
// ---------------------------------------------------------------------------------------------

/**
 * Two families of KindOfQuantity live here:
 *
 *  - `*_PROP` are attached to properties. They give the property-side candidate something to
 *    resolve, and are deliberately never defined by a FormatSet in any test below, so a field
 *    that names nothing exercises the schema.
 *  - `SCHEMA_*` are declared but never attached. Tests name them to force the
 *    FormatSet -> SchemaFormatsProvider fallthrough.
 *
 * Anything else a field names (`Example.LENGTH`, `Example.AREA`, ...) is defined by the FormatSet
 * that test registers, and exists nowhere in the schema.
 */
const exampleSchemaXml = `<?xml version="1.0" encoding="UTF-8"?>
<ECSchema schemaName="FieldExample" alias="fex" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
  <ECSchemaReference name="BisCore" version="01.00.04" alias="bis"/>
  <ECSchemaReference name="Formats" version="01.00.00" alias="f"/>
  <ECSchemaReference name="Units" version="01.00.09" alias="u"/>

  <KindOfQuantity typeName="LENGTH_PROP" displayLabel="Length" persistenceUnit="u:M" relativeError="0.0001" presentationUnits="f:DefaultRealU(4)[u:M]"/>
  <KindOfQuantity typeName="AREA_PROP" displayLabel="Area" persistenceUnit="u:SQ_M" relativeError="0.0001" presentationUnits="f:DefaultRealU(4)[u:SQ_M]"/>
  <KindOfQuantity typeName="SLOPE_PROP" displayLabel="Slope" persistenceUnit="u:M_PER_M" relativeError="0.0001" presentationUnits="f:DefaultRealU(4)[u:M_PER_M]"/>

  <KindOfQuantity typeName="SCHEMA_LENGTH" displayLabel="Schema Length" persistenceUnit="u:M" relativeError="0.0001" presentationUnits="f:DefaultRealU(2)[u:M]"/>
  <KindOfQuantity typeName="SCHEMA_AREA" displayLabel="Schema Area" persistenceUnit="u:SQ_M" relativeError="0.0001" presentationUnits="f:DefaultRealU(2)[u:SQ_M]"/>
  <KindOfQuantity typeName="SCHEMA_ANGLE" displayLabel="Schema Angle" persistenceUnit="u:ARC_DEG" relativeError="0.0001" presentationUnits="f:DefaultRealU(2)[u:ARC_DEG]"/>
  <KindOfQuantity typeName="SCHEMA_SLOPE" displayLabel="Schema Slope" persistenceUnit="u:M_PER_M" relativeError="0.0001" presentationUnits="f:DefaultRealU(2)[u:M_PER_M]"/>
  <KindOfQuantity typeName="SCHEMA_RATIO" displayLabel="Schema Ratio" persistenceUnit="u:ONE" relativeError="0.0001" presentationUnits="f:DefaultRealU(2)[u:ONE]"/>

  <ECEntityClass typeName="ExampleElement" modifier="None">
    <BaseClass>bis:PhysicalElement</BaseClass>
    <ECProperty propertyName="lengthProp" typeName="double" kindOfQuantity="LENGTH_PROP"/>
    <ECProperty propertyName="areaProp" typeName="double" kindOfQuantity="AREA_PROP"/>
    <ECProperty propertyName="slopeProp" typeName="double" kindOfQuantity="SLOPE_PROP"/>
    <ECProperty propertyName="angleProp" typeName="double"/>
    <ECProperty propertyName="ratioProp" typeName="double"/>
    <ECProperty propertyName="point" typeName="point3d"/>
  </ECEntityClass>
</ECSchema>
`;

interface ExampleElementProps extends PhysicalElementProps {
  lengthProp: number;
  areaProp: number;
  slopeProp: number;
  angleProp: number;
  ratioProp: number;
  point: XYAndZ;
}

class ExampleElement extends PhysicalElement {
  public static override get className() { return "ExampleElement"; }
  declare public lengthProp: number;
  declare public areaProp: number;
  declare public slopeProp: number;
  declare public angleProp: number;
  declare public ratioProp: number;
  declare public point: XYAndZ;
}

class FieldExampleSchema extends Schema {
  public static override get schemaName() { return "FieldExample"; }
}

// ---------------------------------------------------------------------------------------------
// FormatSets
// ---------------------------------------------------------------------------------------------

type QuantityOptions = NonNullable<NonNullable<FieldRun["formatOptions"]>["quantity"]>;

describe("Field format resolution example", () => {
  let imodel: StandaloneDb;
  let elementId: Id64String;

  before(async () => {
    const iModelPath = IModelTestUtils.prepareOutputFile("FieldFormatExample", "test.bim");
    imodel = StandaloneDb.createEmpty(iModelPath, { rootSubject: { name: "FieldFormatExample" }, enableTransactions: true });

    if (!Schemas.getRegisteredSchema("FieldExample")) {
      Schemas.registerSchema(FieldExampleSchema);
      ClassRegistry.register(ExampleElement, FieldExampleSchema);
    }
    await imodel.importSchemaStrings([exampleSchemaXml]);

    await withEditTxn(imodel, async (txn) => {
      const model = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(txn, Code.createEmpty(), true)[1];
      const category = SpatialCategory.insert(txn, StandaloneDb.dictionaryId, "FieldFormatExampleCategory", new SubCategoryAppearance());

      const props: ExampleElementProps = {
        classFullName: "FieldExample:ExampleElement",
        model,
        category,
        code: Code.createEmpty(),
        // Seed values chosen to convert cleanly, so a wrong conversion is obvious by inspection.
        // Every test restates the properties it uses in a "Persisted on the element:" comment, so its
        // expected strings can be checked without scrolling back here. Changing a value below
        // means updating those comments too -- grep "Persisted on the element" to find them all.
        lengthProp: 2.5,          // m    -> 2500 mm, 250 cm, 8.202 ft
        areaProp: 100,            // m2   -> 1076.391 ft2
        slopeProp: 0.01,          // m/m  -> 100 :1
        angleProp: 90,            // deg  -> 1.5708 rad
        ratioProp: 0.9,           // one
        point: { x: 1, y: 2, z: 3 },
        placement: { origin: new Point3d(0, 0, 0), angles: new YawPitchRollAngles() },
      };
      elementId = txn.insertElement(props);
    });
  });

  after(() => {
    ElementDrivesTextAnnotation.unregisterFieldFormattingProvider(imodel);
    imodel.close();
  });

  /** Appends a field on `propertyName` of the seeded element, and hands it back so the test can
   * read its content after [[render]].
   */
  function appendField(block: TextBlock, propertyName: string, quantity?: QuantityOptions): FieldRun {
    const field = FieldRun.create({
      propertyHost: { elementId, schemaName: "FieldExample", className: "ExampleElement" },
      propertyPath: { propertyName },
      formatOptions: quantity ? { quantity } : undefined,
      cachedContent: "unevaluated",
    });
    block.appendRun(field);
    return field;
  }

  /** Registers a provider warmed for exactly `block`'s fields, then evaluates them in place --
   * the same collect -> warm -> evaluate pass an app performs. Each call replaces the previous
   * registration, so a test's FormatSets never leak into the next one.
   */
  async function render(
    block: TextBlock,
    formatSets: { readonly adopted?: FormatSet, readonly byId?: ReadonlyArray<{ id: string, formatSet: FormatSet }> } = {},
  ): Promise<void> {
    await ElementDrivesTextAnnotation.registerFieldFormattingProvider({
      iModel: imodel,
      formatSet: formatSets.adopted,
      formatSets: formatSets.byId,
      requirements: ElementDrivesTextAnnotation.collectFieldFormattingRequirements({ iModel: imodel, block }),
    });

    ElementDrivesTextAnnotation.evaluateFields({ iModel: imodel, block });
  }

  /** Registers a provider warmed for exactly `requirements` — not for what `block` needs — then
   * evaluates `block`. Lets a test create a deliberate pre-warm gap, which [[render]] cannot.
   */
  async function renderWarmedFor(block: TextBlock, requirements: FormattingSpecArgs[]): Promise<FieldFormattingSpecProvider> {
    const provider = await ElementDrivesTextAnnotation.registerFieldFormattingProvider({ iModel: imodel, requirements });
    ElementDrivesTextAnnotation.evaluateFields({ iModel: imodel, block });
    return provider;
  }

  it("renders a field with no format options from the property's own KindOfQuantity, and raw where it has none", async () => {
    // Persisted on the element: lengthProp 2.5 m, areaProp 100 m², slopeProp 0.01 m/m, angleProp 90°,
    // ratioProp 0.9 (dimensionless), point (1, 2, 3) m
    const block = TextBlock.create();
    const length = appendField(block, "lengthProp");
    const area = appendField(block, "areaProp");
    const slope = appendField(block, "slopeProp");
    const angle = appendField(block, "angleProp");
    const ratio = appendField(block, "ratioProp");
    const point = appendField(block, "point");

    await render(block);

    // lengthProp, areaProp and slopeProp each declare a KindOfQuantity, so with no FormatSet
    // adopted the schema's own presentation format supplies the unit and precision.
    expect(length.cachedContent).to.equal("2.5 m");
    expect(area.cachedContent).to.equal("100.0 m²");
    expect(slope.cachedContent).to.equal("0.01 m/m");

    // angleProp, ratioProp and point declare none, and the field names none either, so there is
    // nothing to resolve against and the persisted value is rendered as-is.
    expect(angle.cachedContent).to.equal("90");
    expect(ratio.cachedContent).to.equal("0.9");
    expect(point.cachedContent).to.equal("(1, 2, 3)");
  });

  it("resolves a schema-defined KindOfQuantity for every property when the field supplies both the format and the unit", async () => {
    // The only row in this group that resolves anything the baseline did not. Naming a KoQ the
    // schema declares but no FormatSet defines reaches the SchemaFormatsProvider, and because the
    // field also names the persistence unit, the properties that carry no KoQ of their own
    // resolve too -- both halves of the key came from the field.
    // Persisted on the element: lengthProp 2.5 m, areaProp 100 m², slopeProp 0.01 m/m, angleProp 90°,
    // ratioProp 0.9 (dimensionless), point (1, 2, 3) m
    const block = TextBlock.create();
    const length = appendField(block, "lengthProp", { kindOfQuantity: "FieldExample.SCHEMA_LENGTH", persistenceUnit: "Units.M" });
    const area = appendField(block, "areaProp", { kindOfQuantity: "FieldExample.SCHEMA_AREA", persistenceUnit: "Units.SQ_M" });
    const slope = appendField(block, "slopeProp", { kindOfQuantity: "FieldExample.SCHEMA_SLOPE", persistenceUnit: "Units.M_PER_M" });
    const angle = appendField(block, "angleProp", { kindOfQuantity: "FieldExample.SCHEMA_ANGLE", persistenceUnit: "Units.ARC_DEG" });
    const ratio = appendField(block, "ratioProp", { kindOfQuantity: "FieldExample.SCHEMA_RATIO", persistenceUnit: "Units.ONE" });
    const point = appendField(block, "point", { kindOfQuantity: "FieldExample.SCHEMA_LENGTH", persistenceUnit: "Units.M" });

    await render(block);

    // The SCHEMA_* KoQs declare the same units as the properties do, at precision 2 rather than 4,
    // so the KoQ-bearing properties look unchanged from the baseline.
    expect(length.cachedContent).to.equal("2.5 m");
    expect(area.cachedContent).to.equal("100.0 m²");
    expect(slope.cachedContent).to.equal("0.01 m/m");

    // These three are the ones that moved: raw in the baseline, formatted here.
    expect(angle.cachedContent).to.equal("90.0 °");
    expect(ratio.cachedContent).to.equal("0.9 one");
    expect(point.cachedContent).to.equal("(1.0 m, 2.0 m, 3.0 m)");
  });

  it("ignores a KindOfQuantity named without a persistence unit unless the property supplies one", async () => {
    // Same KoQs as above with the unit leg dropped. A format alone cannot be bound to a value --
    // something has to say what unit the persisted number is in. The property's own KoQ answers
    // that for the first three; nothing answers it for the rest.
    // Persisted on the element: lengthProp 2.5 m, areaProp 100 m², slopeProp 0.01 m/m, angleProp 90°,
    // ratioProp 0.9 (dimensionless), point (1, 2, 3) m
    const block = TextBlock.create();
    const length = appendField(block, "lengthProp", { kindOfQuantity: "FieldExample.SCHEMA_LENGTH" });
    const area = appendField(block, "areaProp", { kindOfQuantity: "FieldExample.SCHEMA_AREA" });
    const slope = appendField(block, "slopeProp", { kindOfQuantity: "FieldExample.SCHEMA_SLOPE" });
    const angle = appendField(block, "angleProp", { kindOfQuantity: "FieldExample.SCHEMA_ANGLE" });
    const ratio = appendField(block, "ratioProp", { kindOfQuantity: "FieldExample.SCHEMA_RATIO" });
    const point = appendField(block, "point", { kindOfQuantity: "FieldExample.SCHEMA_LENGTH" });

    await render(block);

    expect(length.cachedContent).to.equal("2.5 m");
    expect(area.cachedContent).to.equal("100.0 m²");
    expect(slope.cachedContent).to.equal("0.01 m/m");

    // Back to raw, unlike the test above -- dropping the unit cost these three their formatting.
    expect(angle.cachedContent).to.equal("90");
    expect(ratio.cachedContent).to.equal("0.9");
    expect(point.cachedContent).to.equal("(1, 2, 3)");
  });

  it("ignores a persistence unit named without a KindOfQuantity", async () => {
    // The mirror image: a unit with no format to apply to it. Nothing names a format, so the
    // property-side candidate is all that is left and the result is the baseline exactly.
    // Persisted on the element: lengthProp 2.5 m, areaProp 100 m², slopeProp 0.01 m/m, angleProp 90°,
    // ratioProp 0.9 (dimensionless), point (1, 2, 3) m
    const block = TextBlock.create();
    const length = appendField(block, "lengthProp", { persistenceUnit: "Units.M" });
    const area = appendField(block, "areaProp", { persistenceUnit: "Units.SQ_M" });
    const slope = appendField(block, "slopeProp", { persistenceUnit: "Units.M_PER_M" });
    const angle = appendField(block, "angleProp", { persistenceUnit: "Units.ARC_DEG" });
    const ratio = appendField(block, "ratioProp", { persistenceUnit: "Units.ONE" });
    const point = appendField(block, "point", { persistenceUnit: "Units.M" });

    await render(block);

    expect(length.cachedContent).to.equal("2.5 m");
    expect(area.cachedContent).to.equal("100.0 m²");
    expect(slope.cachedContent).to.equal("0.01 m/m");
    expect(angle.cachedContent).to.equal("90");
    expect(ratio.cachedContent).to.equal("0.9");
    expect(point.cachedContent).to.equal("(1, 2, 3)");
  });

  it("renders raw and records a miss when the persistence unit override does not exist", async () => {
    // The format leg is fine and the unit leg is garbage. The override is a claim about what the
    // stored magnitude means, so an unresolvable unit is not silently replaced by the property's
    // own -- that would ignore the claim and, for a *valid* wrong-phenomenon unit, render a number
    // off by the conversion factor. The field goes raw and the shortfall is reported instead.
    // Persisted on the element: lengthProp 2.5 m, areaProp 100 m², slopeProp 0.01 m/m, angleProp 90°,
    // ratioProp 0.9 (dimensionless), point (1, 2, 3) m
    const block = TextBlock.create();
    const length = appendField(block, "lengthProp", { kindOfQuantity: "FieldExample.SCHEMA_LENGTH", persistenceUnit: "Units.NOT_A_UNIT" });
    const area = appendField(block, "areaProp", { kindOfQuantity: "FieldExample.SCHEMA_AREA", persistenceUnit: "Units.NOT_A_UNIT" });
    const slope = appendField(block, "slopeProp", { kindOfQuantity: "FieldExample.SCHEMA_SLOPE", persistenceUnit: "Units.NOT_A_UNIT" });
    const angle = appendField(block, "angleProp", { kindOfQuantity: "FieldExample.SCHEMA_ANGLE", persistenceUnit: "Units.NOT_A_UNIT" });
    const ratio = appendField(block, "ratioProp", { kindOfQuantity: "FieldExample.SCHEMA_RATIO", persistenceUnit: "Units.NOT_A_UNIT" });
    const point = appendField(block, "point", { kindOfQuantity: "FieldExample.SCHEMA_LENGTH", persistenceUnit: "Units.NOT_A_UNIT" });

    await render(block);

    expect(length.cachedContent).to.equal("2.5");
    expect(area.cachedContent).to.equal("100");
    expect(slope.cachedContent).to.equal("0.01");
    expect(angle.cachedContent).to.equal("90");
    expect(ratio.cachedContent).to.equal("0.9");
    expect(point.cachedContent).to.equal("(1, 2, 3)");

    const provider = ElementDrivesTextAnnotation.getFieldFormattingProvider(imodel)!;
    expect(provider.misses.some((m) => m.persistenceUnitName === "Units.NOT_A_UNIT")).to.be.true;
  });

  it("does not format a valid persistence-unit override through the property's unit when it was never warmed", async () => {
    // The sharp edge this whole rule exists for. The field says the 2.5 stored on lengthProp is
    // 2.5 *feet*. Only the property's own (LENGTH_PROP, Units.M) pair is warmed. Formatting the
    // 2.5 through that metre pair would render "2.5 m" -- a plausible-looking, durable, 3.28x
    // wrong answer that the caller has no way to detect. It must go raw and be reported instead.
    // Persisted on the element: lengthProp 2.5 m
    const block = TextBlock.create();
    const claimsFeet = appendField(block, "lengthProp", { persistenceUnit: "Units.FT" });

    const provider = await renderWarmedFor(block, [{ name: "FieldExample.LENGTH_PROP", persistenceUnitName: "Units.M" }]);

    expect(claimsFeet.cachedContent).to.equal("2.5");
    expect(claimsFeet.cachedContent).to.not.equal("2.5 m");
    expect(provider.misses.some((m) => m.name === "FieldExample.LENGTH_PROP" && m.persistenceUnitName === "Units.FT")).to.be.true;
    // ...and specifically not as the property pair, which is the fallback that must not have run.
    expect(provider.misses.some((m) => m.persistenceUnitName === "Units.M")).to.be.false;
  });

  it("formats a valid persistence-unit override through the requested unit once it is warmed", async () => {
    // The complement: the same field, with the pair it asked for actually warmed. 2.5 ft renders
    // through a feet-based spec, confirming the miss above was a pre-warm gap and not a refusal
    // to honor the override at all.
    // Persisted on the element: lengthProp 2.5 m (reinterpreted by the field as 2.5 ft)
    const block = TextBlock.create();
    const claimsFeet = appendField(block, "lengthProp", { persistenceUnit: "Units.FT" });

    const provider = await renderWarmedFor(block, [{ name: "FieldExample.LENGTH_PROP", persistenceUnitName: "Units.FT" }]);

    // LENGTH_PROP presents in metres to 4 places, so 2.5 ft renders as its metre equivalent.
    expect(claimsFeet.cachedContent).to.equal("0.762 m");
    expect(provider.misses).to.be.empty;
  });

  it("falls back to the property's own format when the KindOfQuantity does not exist", async () => {
    // The other leg fails this time -- a KoQ no FormatSet and no schema defines, paired with a
    // perfectly good unit. Indistinguishable in output from the failed-unit case above.
    // Persisted on the element: lengthProp 2.5 m, areaProp 100 m², slopeProp 0.01 m/m, angleProp 90°,
    // ratioProp 0.9 (dimensionless), point (1, 2, 3) m
    const block = TextBlock.create();
    const length = appendField(block, "lengthProp", { kindOfQuantity: "Example.DOES_NOT_EXIST", persistenceUnit: "Units.M" });
    const area = appendField(block, "areaProp", { kindOfQuantity: "Example.DOES_NOT_EXIST", persistenceUnit: "Units.SQ_M" });
    const slope = appendField(block, "slopeProp", { kindOfQuantity: "Example.DOES_NOT_EXIST", persistenceUnit: "Units.M_PER_M" });
    const angle = appendField(block, "angleProp", { kindOfQuantity: "Example.DOES_NOT_EXIST", persistenceUnit: "Units.ARC_DEG" });
    const ratio = appendField(block, "ratioProp", { kindOfQuantity: "Example.DOES_NOT_EXIST", persistenceUnit: "Units.ONE" });
    const point = appendField(block, "point", { kindOfQuantity: "Example.DOES_NOT_EXIST", persistenceUnit: "Units.M" });

    await render(block);

    expect(length.cachedContent).to.equal("2.5 m");
    expect(area.cachedContent).to.equal("100.0 m²");
    expect(slope.cachedContent).to.equal("0.01 m/m");
    expect(angle.cachedContent).to.equal("90");
    expect(ratio.cachedContent).to.equal("0.9");
    expect(point.cachedContent).to.equal("(1, 2, 3)");
  });

  it("renders raw when both legs of the override fail, matching a no-KoQ property's baseline", async () => {
    // The most degenerate row: nothing the field says can be resolved. Because the failing leg
    // includes a persistence unit that contradicts the property's, there is no property-side
    // rescue -- every field here goes raw, including the three whose properties do carry a KoQ.
    // Asserted against the KoQ-less baselines rendered in the same pass rather than against
    // captured literals, so the claim survives any change to the seed values or the schema.
    // Persisted on the element: lengthProp 2.5 m, areaProp 100 m², slopeProp 0.01 m/m, angleProp 90°,
    // ratioProp 0.9 (dimensionless), point (1, 2, 3) m
    const block = TextBlock.create();
    const bothLegsFail = { kindOfQuantity: "Example.DOES_NOT_EXIST", persistenceUnit: "Units.NOT_A_UNIT" };

    const length = appendField(block, "lengthProp", bothLegsFail);
    const area = appendField(block, "areaProp", bothLegsFail);
    const slope = appendField(block, "slopeProp", bothLegsFail);
    const angle = appendField(block, "angleProp", bothLegsFail);
    const ratio = appendField(block, "ratioProp", bothLegsFail);
    const point = appendField(block, "point", bothLegsFail);

    // These three properties carry no KoQ, so they render raw with or without formatOptions --
    // the shape a fully-failed override must now also produce.
    const angleBaseline = appendField(block, "angleProp");
    const ratioBaseline = appendField(block, "ratioProp");
    const pointBaseline = appendField(block, "point");

    await render(block);

    expect(angle.cachedContent).to.equal(angleBaseline.cachedContent);
    expect(ratio.cachedContent).to.equal(ratioBaseline.cachedContent);
    expect(point.cachedContent).to.equal(pointBaseline.cachedContent);

    // The KoQ-carrying three no longer fall back to their property format.
    expect(length.cachedContent).to.equal("2.5");
    expect(area.cachedContent).to.equal("100");
    expect(slope.cachedContent).to.equal("0.01");
  });

  it("prefers the adopted FormatSet's format over the property's own schema format", async () => {
    // The happy path. Every field names a KoQ the adopted set defines and the unit its value is
    // persisted in, so the FormatSet answers for all six -- including the three properties that
    // carry no KoQ of their own, which the field has now supplied both halves of the key for.
    // Persisted on the element: lengthProp 2.5 m, areaProp 100 m², slopeProp 0.01 m/m, angleProp 90°,
    // ratioProp 0.9 (dimensionless), point (1, 2, 3) m
    const block = TextBlock.create();
    const length = appendField(block, "lengthProp", { kindOfQuantity: "Example.LENGTH", persistenceUnit: "Units.M" });
    const area = appendField(block, "areaProp", { kindOfQuantity: "Example.AREA", persistenceUnit: "Units.SQ_M" });
    const slope = appendField(block, "slopeProp", { kindOfQuantity: "Example.SLOPE", persistenceUnit: "Units.M_PER_M" });
    const angle = appendField(block, "angleProp", { kindOfQuantity: "Example.ANGLE", persistenceUnit: "Units.ARC_DEG" });
    const ratio = appendField(block, "ratioProp", { kindOfQuantity: "Example.RATIO", persistenceUnit: "Units.ONE" });
    const point = appendField(block, "point", { kindOfQuantity: "Example.LENGTH", persistenceUnit: "Units.M" });

    await render(block, {
      adopted: toFormatSet("Adopted", {
        "Example.LENGTH": decimalFormat("Units.CM", "cm", 2),
        "Example.AREA": decimalFormat("Units.SQ_FT", "ft2", 2),
        "Example.SLOPE": decimalFormat("Units.HORIZONTAL_PER_VERTICAL", ":1", 2),
        "Example.ANGLE": decimalFormat("Units.RAD", "rad", 4),
        "Example.RATIO": decimalFormat("Units.ONE", "r", 4),
      }),
    });

    // Each value is converted out of its persistence unit into the adopted format's unit -- the
    // schema's own metre/square-metre/degree presentations no longer apply.
    expect(length.cachedContent).to.equal("250 cm");
    expect(area.cachedContent).to.equal("1076.39 ft2");
    expect(slope.cachedContent).to.equal("100 :1");
    expect(angle.cachedContent).to.equal("1.5708 rad");
    expect(ratio.cachedContent).to.equal("0.9 r");
    expect(point.cachedContent).to.equal("(100 cm, 200 cm, 300 cm)");
  });

  it("applies an adopted FormatSet format without a persistence unit only where the property declares one", async () => {
    // Same adopted set, unit leg dropped. The property's KoQ supplies the missing half for the
    // first three; the rest have nothing to convert from and stay raw. Note this is not the
    // schema's *format* being used -- only its persistence unit, with the FormatSet's format.
    // Persisted on the element: lengthProp 2.5 m, areaProp 100 m², slopeProp 0.01 m/m, angleProp 90°,
    // ratioProp 0.9 (dimensionless), point (1, 2, 3) m
    const block = TextBlock.create();
    const length = appendField(block, "lengthProp", { kindOfQuantity: "Example.LENGTH" });
    const area = appendField(block, "areaProp", { kindOfQuantity: "Example.AREA" });
    const slope = appendField(block, "slopeProp", { kindOfQuantity: "Example.SLOPE" });
    const angle = appendField(block, "angleProp", { kindOfQuantity: "Example.ANGLE" });
    const ratio = appendField(block, "ratioProp", { kindOfQuantity: "Example.RATIO" });
    const point = appendField(block, "point", { kindOfQuantity: "Example.LENGTH" });

    await render(block, {
      adopted: toFormatSet("Adopted", {
        "Example.LENGTH": decimalFormat("Units.CM", "cm", 2),
        "Example.AREA": decimalFormat("Units.SQ_FT", "ft2", 2),
        "Example.SLOPE": decimalFormat("Units.HORIZONTAL_PER_VERTICAL", ":1", 2),
        "Example.ANGLE": decimalFormat("Units.RAD", "rad", 4),
        "Example.RATIO": decimalFormat("Units.ONE", "r", 4),
      }),
    });

    expect(length.cachedContent).to.equal("250 cm");
    expect(area.cachedContent).to.equal("1076.39 ft2");
    expect(slope.cachedContent).to.equal("100 :1");

    // Unchanged from the baseline: no persistence unit from either side.
    expect(angle.cachedContent).to.equal("90");
    expect(ratio.cachedContent).to.equal("0.9");
    expect(point.cachedContent).to.equal("(1, 2, 3)");
  });

  it("routes to the adopted FormatSet whether the field names its id, names nothing, or names an id that was never registered", async () => {
    // Three ways of addressing the default bucket, which must be indistinguishable: the adopted
    // set is what a field gets when it asks for nothing, and an id absent from the registration
    // falls back to it rather than failing or searching the other buckets. Asserted against each
    // other rather than against literals so it cannot drift with the formats above.
    // Persisted on the element: lengthProp 2.5 m, angleProp 90°
    const block = TextBlock.create();
    const namesNothing = appendField(block, "lengthProp", { kindOfQuantity: "Example.LENGTH", persistenceUnit: "Units.M" });
    const namesAdopted = appendField(block, "lengthProp", { formatSet: ADOPTED_SET, kindOfQuantity: "Example.LENGTH", persistenceUnit: "Units.M" });
    const namesUnregistered = appendField(block, "lengthProp", { formatSet: UNREGISTERED_SET, kindOfQuantity: "Example.LENGTH", persistenceUnit: "Units.M" });

    // Repeated on a property with no KoQ of its own, where a routing failure would fall all the
    // way to raw rather than being masked by the property-side format.
    const koqLessNamesNothing = appendField(block, "angleProp", { kindOfQuantity: "Example.ANGLE", persistenceUnit: "Units.ARC_DEG" });
    const koqLessNamesAdopted = appendField(block, "angleProp", { formatSet: ADOPTED_SET, kindOfQuantity: "Example.ANGLE", persistenceUnit: "Units.ARC_DEG" });
    const koqLessNamesUnregistered = appendField(block, "angleProp", { formatSet: UNREGISTERED_SET, kindOfQuantity: "Example.ANGLE", persistenceUnit: "Units.ARC_DEG" });

    const adopted = toFormatSet("Adopted", {
      "Example.LENGTH": decimalFormat("Units.CM", "cm", 2),
      "Example.ANGLE": decimalFormat("Units.RAD", "rad", 4),
    });
    await render(block, { adopted, byId: [{ id: ADOPTED_SET, formatSet: adopted }] });

    expect(namesNothing.cachedContent).to.equal("250 cm");
    expect(namesAdopted.cachedContent).to.equal(namesNothing.cachedContent);
    expect(namesUnregistered.cachedContent).to.equal(namesNothing.cachedContent);

    expect(koqLessNamesNothing.cachedContent).to.equal("1.5708 rad");
    expect(koqLessNamesAdopted.cachedContent).to.equal(koqLessNamesNothing.cachedContent);
    expect(koqLessNamesUnregistered.cachedContent).to.equal(koqLessNamesNothing.cachedContent);
  });

  it("uses an alternate FormatSet's format when the field names it, in preference to the adopted one", async () => {
    // Mixing presentations within one iModel -- imperial callouts on an otherwise metric drawing.
    // Both sets define every key here, so the alternate's redefinition is what must win.
    // Persisted on the element: lengthProp 2.5 m, areaProp 100 m², slopeProp 0.01 m/m, angleProp 90°,
    // ratioProp 0.9 (dimensionless), point (1, 2, 3) m
    const block = TextBlock.create();
    const length = appendField(block, "lengthProp", { formatSet: ALT_SET, kindOfQuantity: "Example.LENGTH", persistenceUnit: "Units.M" });
    const area = appendField(block, "areaProp", { formatSet: ALT_SET, kindOfQuantity: "Example.AREA", persistenceUnit: "Units.SQ_M" });
    const slope = appendField(block, "slopeProp", { formatSet: ALT_SET, kindOfQuantity: "Example.SLOPE", persistenceUnit: "Units.M_PER_M" });
    const angle = appendField(block, "angleProp", { formatSet: ALT_SET, kindOfQuantity: "Example.ANGLE", persistenceUnit: "Units.ARC_DEG" });
    const ratio = appendField(block, "ratioProp", { formatSet: ALT_SET, kindOfQuantity: "Example.RATIO", persistenceUnit: "Units.ONE" });
    const point = appendField(block, "point", { formatSet: ALT_SET, kindOfQuantity: "Example.LENGTH", persistenceUnit: "Units.M" });

    // The same field routed to the default bucket, to prove the alternate set actually displaced
    // the adopted one rather than both happening to agree.
    const adoptedLength = appendField(block, "lengthProp", { kindOfQuantity: "Example.LENGTH", persistenceUnit: "Units.M" });

    await render(block, {
      adopted: toFormatSet("Adopted", {
        "Example.LENGTH": decimalFormat("Units.CM", "cm", 2),
        "Example.AREA": decimalFormat("Units.SQ_M", "m2", 2),
        "Example.SLOPE": decimalFormat("Units.M_PER_M", "m/m", 4),
        "Example.ANGLE": decimalFormat("Units.ARC_DEG", "deg", 2),
        "Example.RATIO": decimalFormat("Units.ONE", "ratio", 2),
      }),
      byId: [{
        id: ALT_SET, formatSet: toFormatSet("Alternate", {
          "Example.LENGTH": decimalFormat("Units.FT", "[alt]ft", 3),
          "Example.AREA": decimalFormat("Units.SQ_FT", "[alt]ft2", 3),
          "Example.SLOPE": decimalFormat("Units.HORIZONTAL_PER_VERTICAL", "[alt]:1", 2),
          "Example.ANGLE": decimalFormat("Units.ARC_DEG", "[alt]deg", 1),
          "Example.RATIO": decimalFormat("Units.ONE", "[alt]ratio", 1),
        }),
      }],
    });

    expect(length.cachedContent).to.equal("8.202 [alt]ft");
    expect(area.cachedContent).to.equal("1076.391 [alt]ft2");
    expect(slope.cachedContent).to.equal("100 [alt]:1");
    expect(angle.cachedContent).to.equal("90 [alt]deg");
    expect(ratio.cachedContent).to.equal("0.9 [alt]ratio");
    expect(point.cachedContent).to.equal("(3.281 [alt]ft, 6.562 [alt]ft, 9.843 [alt]ft)");

    expect(adoptedLength.cachedContent).to.equal("250 cm");
  });

  it("falls through from the named alternate FormatSet to the adopted one when the alternate omits the key", async () => {
    // The alternate set is a partial overlay, not a replacement: a field routed to it still sees
    // every key the adopted set defines.
    // Persisted on the element: lengthProp 2.5 m, areaProp 100 m²
    const block = TextBlock.create();
    const redefined = appendField(block, "lengthProp", { formatSet: ALT_SET, kindOfQuantity: "Example.LENGTH", persistenceUnit: "Units.M" });
    const omitted = appendField(block, "areaProp", { formatSet: ALT_SET, kindOfQuantity: "Example.AREA", persistenceUnit: "Units.SQ_M" });

    await render(block, {
      adopted: toFormatSet("Adopted", {
        "Example.LENGTH": decimalFormat("Units.CM", "cm", 2),
        "Example.AREA": decimalFormat("Units.SQ_FT", "ft2", 2),
      }),
      byId: [{
        id: ALT_SET, formatSet: toFormatSet("Alternate", {
          // Redefines the length key and says nothing about area.
          "Example.LENGTH": decimalFormat("Units.FT", "[alt]ft", 3),
        }),
      }],
    });

    expect(redefined.cachedContent).to.equal("8.202 [alt]ft");
    expect(omitted.cachedContent).to.equal("1076.39 ft2");
  });

  it("routes a colon-separated KindOfQuantity name to the FormatSet that defines it in dot-separated form", async () => {
    // Pins an agreement between two packages. Warming a bucket asks "does this FormatSet define
    // the key" and looking a format up asks "give me the format for the key" -- the first is
    // answered by `FieldSpecBucket.definesOwnFormat`, the second by
    // `FormatSetFormatsProvider.getFormat` in ecschema-metadata, and each normalizes the name
    // itself. `SchemaItem.parseFullName` accepts `schemaName:itemName` (the form the node addon
    // emits) as well as `schemaName.itemName`, so a set keyed in dot form must answer a field
    // that names its KoQ in colon form.
    //
    // If those two normalizations ever diverge, the bucket skips warming a key its own set does
    // define, and the field silently resolves through the *default* bucket instead -- no throw,
    // and nothing on `misses`, because a spec did resolve. This test is the tripwire: it fails
    // with the adopted set's "250 cm" rather than the alternate's "[alt]ft".
    // Persisted on the element: lengthProp 2.5 m
    const block = TextBlock.create();
    const colonNamed = appendField(block, "lengthProp", { formatSet: ALT_SET, kindOfQuantity: "Example:LENGTH", persistenceUnit: "Units.M" });
    const dotNamed = appendField(block, "lengthProp", { formatSet: ALT_SET, kindOfQuantity: "Example.LENGTH", persistenceUnit: "Units.M" });

    await render(block, {
      // Defines the same key, so an under-warmed alternate bucket resolves here and produces a
      // plausible-looking string instead of an obvious failure.
      adopted: toFormatSet("Adopted", { "Example.LENGTH": decimalFormat("Units.CM", "cm", 2) }),
      byId: [{ id: ALT_SET, formatSet: toFormatSet("Alternate", { "Example.LENGTH": decimalFormat("Units.FT", "[alt]ft", 3) }) }],
    });

    expect(colonNamed.cachedContent).to.equal("8.202 [alt]ft");
    expect(colonNamed.cachedContent).to.equal(dotNamed.cachedContent);
  });

  it("resolves a key only the alternate FormatSet defines only when the field names that set", async () => {
    // The complement of the fallthrough above: the adopted bucket cannot see into the alternate
    // one. An unregistered id lands on the adopted bucket, so it fails the same way naming
    // nothing does -- the fallback is one specific bucket, not a search of every registered set.
    // Persisted on the element: lengthProp 2.5 m
    const block = TextBlock.create();
    const namesAlternate = appendField(block, "lengthProp", { formatSet: ALT_SET, kindOfQuantity: "Example.ALT_ONLY_LENGTH", persistenceUnit: "Units.M" });
    const namesNothing = appendField(block, "lengthProp", { kindOfQuantity: "Example.ALT_ONLY_LENGTH", persistenceUnit: "Units.M" });
    const namesUnregistered = appendField(block, "lengthProp", { formatSet: UNREGISTERED_SET, kindOfQuantity: "Example.ALT_ONLY_LENGTH", persistenceUnit: "Units.M" });

    await render(block, {
      adopted: toFormatSet("Adopted", { "Example.LENGTH": decimalFormat("Units.CM", "cm", 2) }),
      byId: [{
        id: ALT_SET, formatSet: toFormatSet("Alternate", {
          "Example.ALT_ONLY_LENGTH": decimalFormat("Units.IN", "[alt-only]in", 2),
        }),
      }],
    });

    expect(namesAlternate.cachedContent).to.equal("98.43 [alt-only]in");

    // Neither the adopted set nor the schema defines this key, so the property's own KoQ decides.
    expect(namesNothing.cachedContent).to.equal("2.5 m");
    expect(namesUnregistered.cachedContent).to.equal(namesNothing.cachedContent);
  });

  it("reaches the schema from a named alternate FormatSet when neither set defines the key", async () => {
    // The full chain in one field: alternate -> adopted -> SchemaFormatsProvider. Asserted on a
    // property with no KoQ of its own, so a break anywhere in the chain shows up as a raw value
    // rather than being masked by the property-side format.
    // Persisted on the element: angleProp 90°
    const block = TextBlock.create();
    const angle = appendField(block, "angleProp", { formatSet: ALT_SET, kindOfQuantity: "FieldExample.SCHEMA_ANGLE", persistenceUnit: "Units.ARC_DEG" });

    await render(block, {
      adopted: toFormatSet("Adopted", { "Example.LENGTH": decimalFormat("Units.CM", "cm", 2) }),
      byId: [{ id: ALT_SET, formatSet: toFormatSet("Alternate", { "Example.LENGTH": decimalFormat("Units.FT", "[alt]ft", 3) }) }],
    });

    expect(angle.cachedContent).to.equal("90.0 °");
  });

  it("warms a requirement once rather than once per FormatSet when no set defines it", async () => {
    // Pre-warming resolves a format for every bucket, but a FormatSet that does not define the
    // key resolves it by delegating to the same provider the default bucket uses -- producing a
    // duplicate of an entry lookup already reaches through the fallback chain. Warming it per
    // bucket would therefore re-walk the schema's presentation formats once per registered set,
    // which is the dominant cost of warming an iModel's worth of schema KindOfQuantities.
    //
    // Asserted on the *schema* provider because that is the expensive one: it rebuilds its
    // FormatDefinition on every call rather than returning a cached instance.
    const getFormat = sinon.spy(SchemaFormatsProvider.prototype, "getFormat");
    try {
      // Neither set defines this KoQ, so both buckets would fall through to the schema.
      const block = TextBlock.create();
      const angle = appendField(block, "angleProp", { kindOfQuantity: "FieldExample.SCHEMA_ANGLE", persistenceUnit: "Units.ARC_DEG" });

      await render(block, {
        adopted: toFormatSet("Adopted", { "Example.LENGTH": decimalFormat("Units.CM", "cm", 2) }),
        byId: [
          { id: ADOPTED_SET, formatSet: toFormatSet("Adopted", { "Example.LENGTH": decimalFormat("Units.CM", "cm", 2) }) },
          { id: ALT_SET, formatSet: toFormatSet("Alternate", { "Example.LENGTH": decimalFormat("Units.FT", "[alt]ft", 3) }) },
        ],
      });

      // Three buckets are registered (default + two sets); the requirement is resolved once.
      const schemaAngleLookups = getFormat.getCalls().filter((call) => call.args[0] === "FieldExample.SCHEMA_ANGLE");
      expect(schemaAngleLookups.length).to.equal(1);

      // ...and the field still renders, proving the fallback chain covers what was not warmed.
      expect(angle.cachedContent).to.equal("90.0 °");
    } finally {
      getFormat.restore();
    }
  });

  it("does nothing when a field names a FormatSet but no KindOfQuantity and no persistence unit", async () => {    // A FormatSet is only ever reached through a KoQ key, so naming one on its own is inert.
    // Persisted on the element: lengthProp 2.5 m
    const block = TextBlock.create();
    const namesAlternate = appendField(block, "lengthProp", { formatSet: ALT_SET });
    const noOptions = appendField(block, "lengthProp");

    await render(block, {
      adopted: toFormatSet("Adopted", { "Example.LENGTH": decimalFormat("Units.CM", "cm", 2) }),
      byId: [{ id: ALT_SET, formatSet: toFormatSet("Alternate", { "Example.LENGTH": decimalFormat("Units.FT", "[alt]ft", 3) }) }],
    });

    expect(namesAlternate.cachedContent).to.equal(noOptions.cachedContent);
    expect(namesAlternate.cachedContent).to.equal("2.5 m");
  });

  it("declines a format whose unit belongs to a different phenomenon than the persisted value", async () => {
    // A format can only be applied if its unit is convertible from the persistence unit. An angle
    // format cannot present a length, so the override is refused and the field falls back exactly
    // as it would for any other unresolved format -- here, to the schema's own presentation format.
    // Without that check the magnitude would be relabelled rather than converted ("2.5 deg"),
    // because UnitsProvider.getConversion reports the mismatch by returning the *identity*
    // conversion tagged `error: true`. See buildSpecEntry in FieldFormattingSpecProvider.ts.
    // Persisted on the element: lengthProp 2.5 m
    const block = TextBlock.create();
    const crossed = appendField(block, "lengthProp", { kindOfQuantity: "Example.ANGLE", persistenceUnit: "Units.M" });
    const baseline = appendField(block, "lengthProp");

    await render(block, {
      adopted: toFormatSet("Adopted", { "Example.ANGLE": decimalFormat("Units.ARC_DEG", "deg", 2) }),
    });

    expect(baseline.cachedContent).to.equal("2.5 m");
    expect(crossed.cachedContent).to.equal("2.5 m");
    // Stated as an equality too, so the test keeps meaning "fell back to the baseline" rather
    // than "happens to equal this literal" if the seed value ever changes.
    expect(crossed.cachedContent).to.equal(baseline.cachedContent);
  });

  it("degrades only the offending field when applying a format throws", async () => {
    // FormatterSpec.applyFormatting is a much larger exception surface than the `toString()` it
    // replaced. A throw used to escape updateField and updateFields, get swallowed by
    // doUpdateFields, and abandon the whole element -- earlier fields mutated in memory, nothing
    // persisted, one log line as the only trace. It must degrade this field alone.
    // Persisted on the element: lengthProp 2.5 m, areaProp 100 m², slopeProp 0.01 m/m
    const block = TextBlock.create();
    const before = appendField(block, "areaProp");
    const thrower = appendField(block, "lengthProp");
    const after = appendField(block, "slopeProp");

    const provider = await ElementDrivesTextAnnotation.registerFieldFormattingProvider({
      iModel: imodel,
      requirements: ElementDrivesTextAnnotation.collectFieldFormattingRequirements({ iModel: imodel, block }),
    });

    // Evaluation formats through the bucket, not the top-level provider, so stub the bucket.
    const bucket = provider.getProviderFor(undefined);
    sinon.stub(bucket, "formatQuantity").callsFake((magnitude: number, spec: any) => {
      if (2.5 === magnitude)
        throw new Error("malformed format");
      return spec.applyFormatting(magnitude);
    });

    expect(() => ElementDrivesTextAnnotation.evaluateFields({ iModel: imodel, block })).to.not.throw();

    expect(thrower.cachedContent).to.equal(FieldRun.invalidContentIndicator);
    // The fields on either side of the failure still resolved and still persisted.
    expect(before.cachedContent).to.equal("100.0 m²");
    expect(after.cachedContent).to.equal("0.01 m/m");
  });
});
