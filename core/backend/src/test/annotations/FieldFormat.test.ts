/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Code, FieldPropertyPath, FieldRun, PhysicalElementProps, SubCategoryAppearance, TextBlock } from "@itwin/core-common";
import { FormatDefinition } from "@itwin/core-quantity";
import { FormatSet } from "@itwin/ecschema-metadata";
import { Id64String } from "@itwin/core-bentley";
import { Point3d, XYAndZ, YawPitchRollAngles } from "@itwin/core-geometry";
import { StandaloneDb } from "../../IModelDb";
import { IModelTestUtils } from "../IModelTestUtils";
import { SpatialCategory } from "../../Category";
import { Schema, Schemas } from "../../Schema";
import { ClassRegistry } from "../../ClassRegistry";
import { PhysicalElement } from "../../Element";
import { ElementDrivesTextAnnotation } from "../../annotations/ElementDrivesTextAnnotation";
import { withEditTxn } from "../../EditTxn";

/**
 * The format-resolution example.
 *
 * Every row varies exactly three inputs on a [FieldRun]'s `formatOptions.quantity` --
 * `formatSet`, `kindOfQuantity`, and `persistenceUnit` -- and applies them to six properties
 * chosen so that three carry their own KindOfQuantity and three do not. That split is the
 * dominant axis: a failed override is silently rescued by the property-side candidate when the
 * property carries a KoQ, and only falls through to the raw string when it does not.
 *
 * Cases 1-7 omit `formatSet` entirely, 8-14 name the adopted set explicitly, 15-24 exercise
 * FormatSet routing against a second registered set, and 25 pairs a format with a persistence
 * unit from a different phenomenon.
 *
 * Most rows are twins of an earlier row rather than new behavior, so the bulk of the value here
 * is in the equivalence assertions -- they need no captured literals and fail loudly if a
 * fallback path changes. Literal expectations are layered on top for every row; see EXPECTED
 * below for how to recapture them.
 */

// cspell: ignore koqs

// TODO: might want to remove this when I'm closer to being finished
/** Set `FIELD_EXAMPLE_CAPTURE=1` to print every rendered case as a paste-ready EXPECTED literal. */
const CAPTURE = !!process.env.FIELD_EXAMPLE_CAPTURE;

const ADOPTED_SET: Id64String = "0x111";
const ALT_SET: Id64String = "0x222";
/** Deliberately never registered, so `getProviderFor` falls back to the adopted bucket. */
const UNREGISTERED_SET: Id64String = "0x999";

const BAD_UNIT = "Units.NOT_A_UNIT";
const MISSING_KOQ = "Example.DOES_NOT_EXIST";
const ALT_ONLY_KOQ = "Example.ALT_ONLY_LENGTH";

// ---------------------------------------------------------------------------------------------
// Test schema
// ---------------------------------------------------------------------------------------------

/**
 * Three families of KindOfQuantity live here:
 *
 *  - `*_PROP` are attached to properties. They give the property-side candidate something to
 *    resolve, and are deliberately absent from both FormatSets so case 1 exercises the schema.
 *  - `SCHEMA_*` are declared but never attached and never appear in a FormatSet. They are what
 *    cases 2/3/5 name to force the FormatSet -> SchemaFormatsProvider fallthrough.
 *  - Everything else the fields name (`Example.LENGTH`, `Example.AREA`, ...) exists only inside a
 *    FormatSet, never in the schema.
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

function decimalFormat(unitName: string, unitLabel: string, precision = 4): FormatDefinition {
  return {
    composite: { includeZero: true, units: [{ label: unitLabel, name: unitName }] },
    formatTraits: ["keepSingleZero", "showUnitLabel"],
    precision,
    type: "Decimal",
    uomSeparator: " ",
  };
}

function toFormatSet(name: string, formats: Record<string, FormatDefinition>): FormatSet {
  return { name, label: name, unitSystem: "metric", formats };
}

/**
 * The adopted set. Each phenomenon contributes two keys: one the alternate set also redefines
 * (`Example.<PHENOMENON>`) and one it omits (`Example.<PHENOMENON>_ALT_OMITS`). Cases distinguish
 * the two to separate "the alternate bucket answered" from "the alternate bucket fell through".
 */
const ADOPTED_FORMATS: Record<string, FormatDefinition> = {
  "Example.LENGTH": decimalFormat("Units.MM", "mm", 2),
  "Example.LENGTH_ALT_OMITS": decimalFormat("Units.CM", "cm", 2),
  "Example.AREA": decimalFormat("Units.SQ_M", "m2", 2),
  "Example.AREA_ALT_OMITS": decimalFormat("Units.SQ_FT", "ft2", 2),
  "Example.ANGLE": decimalFormat("Units.ARC_DEG", "deg", 2),
  "Example.ANGLE_ALT_OMITS": decimalFormat("Units.RAD", "rad", 4),
  "Example.SLOPE": decimalFormat("Units.M_PER_M", "m/m", 4),
  "Example.SLOPE_ALT_OMITS": decimalFormat("Units.HORIZONTAL_PER_VERTICAL", ":1", 2),
  "Example.RATIO": decimalFormat("Units.ONE", "ratio", 2),
  "Example.RATIO_ALT_OMITS": decimalFormat("Units.ONE", "r", 4),
};

/**
 * The alternate set. It redefines a handful of adopted keys with an `[alt]` label, omits the
 * `*_ALT_OMITS` keys entirely so those fall through to the adopted set, and contributes one key
 * (`ALT_ONLY_KOQ`) that exists nowhere else.
 */
const ALT_FORMATS: Record<string, FormatDefinition> = {
  "Example.LENGTH": decimalFormat("Units.FT", "[alt]ft", 3),
  "Example.AREA": decimalFormat("Units.SQ_FT", "[alt]ft2", 3),
  "Example.ANGLE": decimalFormat("Units.ARC_DEG", "[alt]deg", 1),
  "Example.SLOPE": decimalFormat("Units.HORIZONTAL_PER_VERTICAL", "[alt]:1", 2),
  "Example.RATIO": decimalFormat("Units.ONE", "[alt]ratio", 1),
  [ALT_ONLY_KOQ]: decimalFormat("Units.IN", "[alt-only]in", 2),
};

// ---------------------------------------------------------------------------------------------
// Phenomena
// ---------------------------------------------------------------------------------------------

interface Phenomenon {
  /** Stable key used in the expectation tables. */
  readonly key: string;
  readonly propertyPath: FieldPropertyPath;
  readonly persistenceUnit: string;
  /** Whether the property declares its own KindOfQuantity. The dominant axis of the example. */
  readonly hasKoq: boolean;
  /** A KoQ the adopted set defines and the alternate set does not. */
  readonly koqAdoptedOnly: string;
  /** A KoQ both sets define, the alternate overriding the adopted. */
  readonly koqInBothSets: string;
  /** A KoQ present in the schema but in neither FormatSet. */
  readonly schemaKoq: string;
  /** A KoQ whose format belongs to a different phenomenon than `persistenceUnit`. */
  readonly crossPhenomenonKoq: string;
}

const PHENOMENA: readonly Phenomenon[] = [
  {
    key: "length", propertyPath: { propertyName: "lengthProp" }, persistenceUnit: "Units.M", hasKoq: true,
    koqAdoptedOnly: "Example.LENGTH_ALT_OMITS", koqInBothSets: "Example.LENGTH",
    schemaKoq: "FieldExample.SCHEMA_LENGTH", crossPhenomenonKoq: "Example.ANGLE",
  },
  {
    key: "area", propertyPath: { propertyName: "areaProp" }, persistenceUnit: "Units.SQ_M", hasKoq: true,
    koqAdoptedOnly: "Example.AREA_ALT_OMITS", koqInBothSets: "Example.AREA",
    schemaKoq: "FieldExample.SCHEMA_AREA", crossPhenomenonKoq: "Example.LENGTH",
  },
  {
    key: "slope", propertyPath: { propertyName: "slopeProp" }, persistenceUnit: "Units.M_PER_M", hasKoq: true,
    koqAdoptedOnly: "Example.SLOPE_ALT_OMITS", koqInBothSets: "Example.SLOPE",
    schemaKoq: "FieldExample.SCHEMA_SLOPE", crossPhenomenonKoq: "Example.LENGTH",
  },
  {
    key: "angle", propertyPath: { propertyName: "angleProp" }, persistenceUnit: "Units.ARC_DEG", hasKoq: false,
    koqAdoptedOnly: "Example.ANGLE_ALT_OMITS", koqInBothSets: "Example.ANGLE",
    schemaKoq: "FieldExample.SCHEMA_ANGLE", crossPhenomenonKoq: "Example.LENGTH",
  },
  {
    key: "dimensionless", propertyPath: { propertyName: "ratioProp" }, persistenceUnit: "Units.ONE", hasKoq: false,
    koqAdoptedOnly: "Example.RATIO_ALT_OMITS", koqInBothSets: "Example.RATIO",
    schemaKoq: "FieldExample.SCHEMA_RATIO", crossPhenomenonKoq: "Example.LENGTH",
  },
  {
    key: "coordinate", propertyPath: { propertyName: "point" }, persistenceUnit: "Units.M", hasKoq: false,
    koqAdoptedOnly: "Example.LENGTH_ALT_OMITS", koqInBothSets: "Example.LENGTH",
    schemaKoq: "FieldExample.SCHEMA_LENGTH", crossPhenomenonKoq: "Example.ANGLE",
  },
];

const KOQ_BEARING = PHENOMENA.filter((p) => p.hasKoq).map((p) => p.key);
const KOQ_LESS = PHENOMENA.filter((p) => !p.hasKoq).map((p) => p.key);

// ---------------------------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------------------------

type QuantityOptions = NonNullable<NonNullable<FieldRun["formatOptions"]>["quantity"]>;

interface Case {
  readonly id: string;
  readonly title: string;
  /** `undefined` means the field carries no `formatOptions` at all. */
  readonly options: (p: Phenomenon) => QuantityOptions | undefined;
}

const CASES: readonly Case[] = [
  { id: "1", title: "no format options", options: () => undefined },

  { id: "2", title: "schema KoQ + persistenceUnit, no formatSet named", options: (p) => ({ kindOfQuantity: p.schemaKoq, persistenceUnit: p.persistenceUnit }) },
  { id: "3", title: "schema KoQ only, no persistenceUnit and no formatSet named", options: (p) => ({ kindOfQuantity: p.schemaKoq }) },
  { id: "4", title: "persistenceUnit only, no formatSet named", options: (p) => ({ persistenceUnit: p.persistenceUnit }) },
  { id: "5", title: "schema KoQ + bad persistenceUnit, no formatSet named", options: (p) => ({ kindOfQuantity: p.schemaKoq, persistenceUnit: BAD_UNIT }) },
  { id: "6", title: "nonexistent KoQ + valid persistenceUnit, no formatSet named", options: (p) => ({ kindOfQuantity: MISSING_KOQ, persistenceUnit: p.persistenceUnit }) },
  { id: "7", title: "nonexistent KoQ + bad persistenceUnit, no formatSet named", options: () => ({ kindOfQuantity: MISSING_KOQ, persistenceUnit: BAD_UNIT }) },

  { id: "8", title: "adopted set + KoQ only, no persistenceUnit", options: (p) => ({ formatSet: ADOPTED_SET, kindOfQuantity: p.koqAdoptedOnly }) },
  { id: "9", title: "adopted set + persistenceUnit only, no KoQ", options: (p) => ({ formatSet: ADOPTED_SET, persistenceUnit: p.persistenceUnit }) },
  { id: "10", title: "adopted set + KoQ + persistenceUnit (happy path)", options: (p) => ({ formatSet: ADOPTED_SET, kindOfQuantity: p.koqAdoptedOnly, persistenceUnit: p.persistenceUnit }) },
  { id: "11", title: "adopted set + KoQ + bad persistenceUnit", options: (p) => ({ formatSet: ADOPTED_SET, kindOfQuantity: p.koqAdoptedOnly, persistenceUnit: BAD_UNIT }) },
  { id: "12", title: "adopted set + schema-only KoQ + persistenceUnit", options: (p) => ({ formatSet: ADOPTED_SET, kindOfQuantity: p.schemaKoq, persistenceUnit: p.persistenceUnit }) },
  { id: "13", title: "adopted set + nonexistent KoQ + persistenceUnit", options: (p) => ({ formatSet: ADOPTED_SET, kindOfQuantity: MISSING_KOQ, persistenceUnit: p.persistenceUnit }) },
  { id: "14", title: "adopted set + nonexistent KoQ + bad persistenceUnit", options: () => ({ formatSet: ADOPTED_SET, kindOfQuantity: MISSING_KOQ, persistenceUnit: BAD_UNIT }) },

  { id: "15", title: "alternate set redefines the key", options: (p) => ({ formatSet: ALT_SET, kindOfQuantity: p.koqInBothSets, persistenceUnit: p.persistenceUnit }) },
  { id: "16", title: "alternate set omits the key", options: (p) => ({ formatSet: ALT_SET, kindOfQuantity: p.koqAdoptedOnly, persistenceUnit: p.persistenceUnit }) },
  { id: "17", title: "key defined only in the alternate set, addressed correctly", options: (p) => ({ formatSet: ALT_SET, kindOfQuantity: ALT_ONLY_KOQ, persistenceUnit: p.persistenceUnit }) },
  { id: "18", title: "same alt-only key without naming the alternate set", options: (p) => ({ kindOfQuantity: ALT_ONLY_KOQ, persistenceUnit: p.persistenceUnit }) },
  { id: "19", title: "adopted-set key without naming any set", options: (p) => ({ kindOfQuantity: p.koqAdoptedOnly, persistenceUnit: p.persistenceUnit }) },
  { id: "20", title: "naming a FormatSet id that was never registered", options: (p) => ({ formatSet: UNREGISTERED_SET, kindOfQuantity: p.koqAdoptedOnly, persistenceUnit: p.persistenceUnit }) },
  { id: "21", title: "alternate set named, key exists only in the schema", options: (p) => ({ formatSet: ALT_SET, kindOfQuantity: p.schemaKoq, persistenceUnit: p.persistenceUnit }) },
  { id: "22", title: "unregistered id + a key only the alternate set defines", options: (p) => ({ formatSet: UNREGISTERED_SET, kindOfQuantity: ALT_ONLY_KOQ, persistenceUnit: p.persistenceUnit }) },
  { id: "23", title: "alternate set named with neither KoQ nor persistenceUnit", options: () => ({ formatSet: ALT_SET }) },
  { id: "24", title: "alternate set named, adopted-only key, bad persistenceUnit", options: (p) => ({ formatSet: ALT_SET, kindOfQuantity: p.koqAdoptedOnly, persistenceUnit: BAD_UNIT }) },

  { id: "25", title: "cross-phenomenon pairing (format and persistence unit disagree)", options: (p) => ({ formatSet: ADOPTED_SET, kindOfQuantity: p.crossPhenomenonKoq, persistenceUnit: p.persistenceUnit }) },
];

/**
 * Rows that must render identically to an earlier row, and why. These carry the bulk of the
 * suite's value: they assert the fallback chain without depending on any captured literal, so
 * they keep working when formats or seed values change.
 */
const EQUIVALENCES: ReadonlyArray<{ readonly of: string, readonly to: string, readonly why: string }> = [
  { of: "2", to: "12", why: "naming the adopted set explicitly is a no-op, so the schema fallthrough is reached either way" },
  { of: "4", to: "9", why: "with no KoQ to look up, naming a set changes nothing" },
  { of: "5", to: "11", why: "the unit leg fails in both, so the property-side candidate decides" },
  { of: "6", to: "13", why: "the format leg fails in both" },
  { of: "7", to: "14", why: "both legs fail in both" },
  { of: "16", to: "10", why: "the alternate set omits the key, so resolution falls through to the adopted set" },
  { of: "19", to: "10", why: "the default bucket is the adopted set, so naming it explicitly is a no-op" },
  { of: "20", to: "10", why: "an unregistered id silently falls back to the adopted bucket" },
  { of: "21", to: "12", why: "the alternate bucket must walk alternate -> adopted -> schema" },
  { of: "22", to: "18", why: "the unknown-id fallback is the adopted bucket, not a search of every bucket" },
  { of: "23", to: "1", why: "a bare formatSet with nothing to look up is inert" },
  { of: "24", to: "11", why: "the property-side rescue behaves the same while routed to a non-default bucket" },
];

/**
 * Literal expectations, keyed by case id then phenomenon key, captured from a run against the
 * schema and FormatSets above. The table must cover every (case, phenomenon) pair -- the
 * completeness guard below fails if any entry is missing, since `Fields.test.ts` no longer
 * duplicates these rows. Run with `FIELD_EXAMPLE_CAPTURE=1` to reprint this table after
 * changing a seed value or a format.
 */
const EXPECTED: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  "1": { // no format options
    length: "2.5 m",
    area: "100.0 m²",
    slope: "0.01 m/m",
    angle: "90",
    dimensionless: "0.9",
    coordinate: "(1, 2, 3)",
  },
  "2": { // schema KoQ + persistenceUnit, no formatSet named
    length: "2.5 m",
    area: "100.0 m²",
    slope: "0.01 m/m",
    angle: "90.0 °",
    dimensionless: "0.9 one",
    coordinate: "(1.0 m, 2.0 m, 3.0 m)",
  },
  "3": { // schema KoQ only, no persistenceUnit and no formatSet named
    length: "2.5 m",
    area: "100.0 m²",
    slope: "0.01 m/m",
    angle: "90",
    dimensionless: "0.9",
    coordinate: "(1, 2, 3)",
  },
  "4": { // persistenceUnit only, no formatSet named
    length: "2.5 m",
    area: "100.0 m²",
    slope: "0.01 m/m",
    angle: "90",
    dimensionless: "0.9",
    coordinate: "(1, 2, 3)",
  },
  "5": { // schema KoQ + bad persistenceUnit, no formatSet named
    length: "2.5 m",
    area: "100.0 m²",
    slope: "0.01 m/m",
    angle: "90",
    dimensionless: "0.9",
    coordinate: "(1, 2, 3)",
  },
  "6": { // nonexistent KoQ + valid persistenceUnit, no formatSet named
    length: "2.5 m",
    area: "100.0 m²",
    slope: "0.01 m/m",
    angle: "90",
    dimensionless: "0.9",
    coordinate: "(1, 2, 3)",
  },
  "7": { // nonexistent KoQ + bad persistenceUnit, no formatSet named
    length: "2.5 m",
    area: "100.0 m²",
    slope: "0.01 m/m",
    angle: "90",
    dimensionless: "0.9",
    coordinate: "(1, 2, 3)",
  },
  "8": { // adopted set + KoQ only, no persistenceUnit
    length: "250 cm",
    area: "1076.39 ft2",
    slope: "100 :1",
    angle: "90",
    dimensionless: "0.9",
    coordinate: "(1, 2, 3)",
  },
  "9": { // adopted set + persistenceUnit only, no KoQ
    length: "2.5 m",
    area: "100.0 m²",
    slope: "0.01 m/m",
    angle: "90",
    dimensionless: "0.9",
    coordinate: "(1, 2, 3)",
  },
  "10": { // adopted set + KoQ + persistenceUnit (happy path)
    length: "250 cm",
    area: "1076.39 ft2",
    slope: "100 :1",
    angle: "1.5708 rad",
    dimensionless: "0.9 r",
    coordinate: "(100 cm, 200 cm, 300 cm)",
  },
  "11": { // adopted set + KoQ + bad persistenceUnit
    length: "2.5 m",
    area: "100.0 m²",
    slope: "0.01 m/m",
    angle: "90",
    dimensionless: "0.9",
    coordinate: "(1, 2, 3)",
  },
  "12": { // adopted set + schema-only KoQ + persistenceUnit
    length: "2.5 m",
    area: "100.0 m²",
    slope: "0.01 m/m",
    angle: "90.0 °",
    dimensionless: "0.9 one",
    coordinate: "(1.0 m, 2.0 m, 3.0 m)",
  },
  "13": { // adopted set + nonexistent KoQ + persistenceUnit
    length: "2.5 m",
    area: "100.0 m²",
    slope: "0.01 m/m",
    angle: "90",
    dimensionless: "0.9",
    coordinate: "(1, 2, 3)",
  },
  "14": { // adopted set + nonexistent KoQ + bad persistenceUnit
    length: "2.5 m",
    area: "100.0 m²",
    slope: "0.01 m/m",
    angle: "90",
    dimensionless: "0.9",
    coordinate: "(1, 2, 3)",
  },
  "15": { // alternate set redefines the key
    length: "8.202 [alt]ft",
    area: "1076.391 [alt]ft2",
    slope: "100 [alt]:1",
    angle: "90 [alt]deg",
    dimensionless: "0.9 [alt]ratio",
    coordinate: "(3.281 [alt]ft, 6.562 [alt]ft, 9.843 [alt]ft)",
  },
  "16": { // alternate set omits the key
    length: "250 cm",
    area: "1076.39 ft2",
    slope: "100 :1",
    angle: "1.5708 rad",
    dimensionless: "0.9 r",
    coordinate: "(100 cm, 200 cm, 300 cm)",
  },
  // NOTE: only `length` and `coordinate` convert; the other four are the cross-phenomenon
  // bug below, applying an inch format to a non-length persistence unit.
  "17": { // key defined only in the alternate set, addressed correctly
    length: "98.43 [alt-only]in",
    area: "100 [alt-only]in",
    slope: "0.01 [alt-only]in",
    angle: "90 [alt-only]in",
    dimensionless: "0.9 [alt-only]in",
    coordinate: "(39.37 [alt-only]in, 78.74 [alt-only]in, 118.11 [alt-only]in)",
  },
  "18": { // same alt-only key without naming the alternate set
    length: "2.5 m",
    area: "100.0 m²",
    slope: "0.01 m/m",
    angle: "90",
    dimensionless: "0.9",
    coordinate: "(1, 2, 3)",
  },
  "19": { // adopted-set key without naming any set
    length: "250 cm",
    area: "1076.39 ft2",
    slope: "100 :1",
    angle: "1.5708 rad",
    dimensionless: "0.9 r",
    coordinate: "(100 cm, 200 cm, 300 cm)",
  },
  "20": { // naming a FormatSet id that was never registered
    length: "250 cm",
    area: "1076.39 ft2",
    slope: "100 :1",
    angle: "1.5708 rad",
    dimensionless: "0.9 r",
    coordinate: "(100 cm, 200 cm, 300 cm)",
  },
  "21": { // alternate set named, key exists only in the schema
    length: "2.5 m",
    area: "100.0 m²",
    slope: "0.01 m/m",
    angle: "90.0 °",
    dimensionless: "0.9 one",
    coordinate: "(1.0 m, 2.0 m, 3.0 m)",
  },
  "22": { // unregistered id + a key only the alternate set defines
    length: "2.5 m",
    area: "100.0 m²",
    slope: "0.01 m/m",
    angle: "90",
    dimensionless: "0.9",
    coordinate: "(1, 2, 3)",
  },
  "23": { // alternate set named with neither KoQ nor persistenceUnit
    length: "2.5 m",
    area: "100.0 m²",
    slope: "0.01 m/m",
    angle: "90",
    dimensionless: "0.9",
    coordinate: "(1, 2, 3)",
  },
  "24": { // alternate set named, adopted-only key, bad persistenceUnit
    length: "2.5 m",
    area: "100.0 m²",
    slope: "0.01 m/m",
    angle: "90",
    dimensionless: "0.9",
    coordinate: "(1, 2, 3)",
  },
  // KNOWN BUG: every magnitude below is unchanged from case 1 -- the value is relabelled,
  // not converted. When FormatterSpec stops pushing the identity conversion on a
  // phenomenon mismatch, these rows should fall back like any other failed override.
  "25": { // cross-phenomenon pairing (format and persistence unit disagree)
    length: "2.5 deg",
    area: "100 mm",
    slope: "0.01 mm",
    angle: "90 mm",
    dimensionless: "0.9 mm",
    coordinate: "(1 deg, 2 deg, 3 deg)",
  },
};

// ---------------------------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------------------------

function resultKey(caseId: string, phenomenonKey: string): string {
  return `${caseId}:${phenomenonKey}`;
}

describe("Field format resolution example", () => {
  let imodel: StandaloneDb;
  let elementId: Id64String;

  /** Rendered content for every (case, phenomenon) pair. */
  const rendered = new Map<string, string>();

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

    // One block holding every row, so a single collect -> warm -> evaluate pass covers every
    // case and the warm-up sees the union of all requirements -- exactly as an app would.
    const block = TextBlock.create();
    const fields = new Map<string, FieldRun>();

    for (const testCase of CASES) {
      for (const phenomenon of PHENOMENA) {
        const quantity = testCase.options(phenomenon);
        const field = FieldRun.create({
          propertyHost: { elementId, schemaName: "FieldExample", className: "ExampleElement" },
          propertyPath: phenomenon.propertyPath,
          formatOptions: quantity ? { quantity } : undefined,
          cachedContent: "unevaluated",
        });
        block.appendRun(field);
        fields.set(resultKey(testCase.id, phenomenon.key), field);
      }
    }

    await ElementDrivesTextAnnotation.registerFieldFormattingProvider({
      iModel: imodel,
      formatSet: toFormatSet("Adopted", ADOPTED_FORMATS),
      formatSets: [
        { id: ADOPTED_SET, formatSet: toFormatSet("Adopted", ADOPTED_FORMATS) },
        { id: ALT_SET, formatSet: toFormatSet("Alternate", ALT_FORMATS) },
      ],
      requirements: ElementDrivesTextAnnotation.collectFieldFormattingRequirements({ iModel: imodel, block }),
    });

    ElementDrivesTextAnnotation.evaluateFields({ iModel: imodel, block });

    for (const [key, field] of fields) {
      rendered.set(key, field.cachedContent);
    }

    if (CAPTURE) {
      const lines: string[] = ["const EXPECTED = {"];
      for (const testCase of CASES) {
        lines.push(`  "${testCase.id}": { // ${testCase.title}`);
        for (const phenomenon of PHENOMENA) {
          const value = rendered.get(resultKey(testCase.id, phenomenon.key)) ?? "";
          lines.push(`    ${phenomenon.key}: ${JSON.stringify(value)},`);
        }
        lines.push("  },");
      }
      lines.push("};");
      // eslint-disable-next-line no-console
      console.log(lines.join("\n"));
    }
  });

  after(() => {
    ElementDrivesTextAnnotation.unregisterFieldFormattingProvider(imodel);
    imodel.close();
  });

  function contentOf(caseId: string, phenomenonKey: string): string {
    const value = rendered.get(resultKey(caseId, phenomenonKey));
    expect(value, `no rendered content for case ${caseId} / ${phenomenonKey}`).not.to.be.undefined;
    return value!;
  }

  /** Every row of every case rendered to something. Guards the harness itself. */
  it("renders every case against every phenomenon", () => {
    expect(rendered.size).to.equal(CASES.length * PHENOMENA.length);
    for (const [key, value] of rendered) {
      expect(value, `case ${key} was never evaluated`).not.to.equal("unevaluated");
      expect(value, `case ${key} rendered empty`).not.to.equal("");
    }
  });

  /**
   * The literal table must stay complete. `Fields.test.ts` no longer duplicates the rows this
   * file owns, so a missing EXPECTED entry would silently drop coverage -- a pending test is
   * reported green. Fail loudly instead, unless we are capturing a fresh table.
   */
  it("has a literal expectation for every case and phenomenon", function () {
    if (CAPTURE) {
      this.skip();
    }

    const missing: string[] = [];
    for (const testCase of CASES) {
      for (const phenomenon of PHENOMENA) {
        if (EXPECTED[testCase.id]?.[phenomenon.key] === undefined) {
          missing.push(resultKey(testCase.id, phenomenon.key));
        }
      }
    }

    expect(missing, "EXPECTED is incomplete -- rerun with FIELD_EXAMPLE_CAPTURE=1 and paste the printed table into EXPECTED").to.deep.equal([]);
  });

  describe("literal expectations", () => {
    for (const testCase of CASES) {
      const expectations = EXPECTED[testCase.id];
      const captured = PHENOMENA.filter((p) => expectations?.[p.key] !== undefined);

      if (captured.length > 0) {
        it(`case ${testCase.id}: ${testCase.title}`, () => {
          for (const phenomenon of captured) {
            expect(contentOf(testCase.id, phenomenon.key), `case ${testCase.id} / ${phenomenon.key}`)
              .to.equal(expectations[phenomenon.key]);
          }
        });
      }
    }
  });

  describe("equivalences", () => {
    for (const { of, to, why } of EQUIVALENCES) {
      it(`case ${of} renders identically to case ${to} -- ${why}`, () => {
        for (const phenomenon of PHENOMENA) {
          expect(contentOf(of, phenomenon.key), `case ${of} vs ${to} / ${phenomenon.key}`)
            .to.equal(contentOf(to, phenomenon.key));
        }
      });
    }
  });

  describe("distinctions", () => {
    it("case 17 differs from case 18 -- identical options apart from formatSet, opposite outcomes", () => {
      // 17 names the alternate set and resolves its alt-only key; 18 omits `formatSet`, so
      // neither the adopted set nor the schema can supply that key.
      const differing = PHENOMENA.filter((p) => contentOf("17", p.key) !== contentOf("18", p.key));
      expect(differing.map((p) => p.key), "naming the alternate set made no difference anywhere").not.to.be.empty;
    });

    it("case 15 differs from case 10 -- the alternate set's override must win", () => {
      for (const phenomenon of PHENOMENA) {
        expect(contentOf("15", phenomenon.key), `case 15 / ${phenomenon.key} did not use the alternate format`)
          .not.to.equal(contentOf("10", phenomenon.key));
      }
    });
  });

  describe("property KindOfQuantity is the dominant axis", () => {
    it("case 3 resolves for KoQ-bearing properties and falls back for the rest", () => {
      // With a format named but no persistence unit, the unit must come from the property side.
      for (const key of KOQ_BEARING) {
        expect(contentOf("3", key), `case 3 / ${key} should have bound the schema format`)
          .to.equal(contentOf("12", key));
      }
      for (const key of KOQ_LESS) {
        expect(contentOf("3", key), `case 3 / ${key} had nothing to bind against`)
          .to.equal(contentOf("1", key));
      }
    });

    it("case 7 falls back to the property's own format where one exists, and to raw where it does not", () => {
      // Both legs of the override fail, so this is the most degenerate row: it must be
      // indistinguishable from the baseline everywhere.
      for (const phenomenon of PHENOMENA) {
        expect(contentOf("7", phenomenon.key), `case 7 / ${phenomenon.key}`)
          .to.equal(contentOf("1", phenomenon.key));
      }
    });
  });

  describe("cross-phenomenon pairing", () => {
    // KNOWN BUG: FormatterSpec.getUnitConversions logs a warning when the format's unit and the
    // persistence unit belong to different phenomena, but pushes the identity conversion anyway,
    // so the magnitude is relabelled rather than converted or rejected. Once fixed, these rows
    // should stop resolving and fall back like any other failed override.
    it("case 25 relabels the magnitude instead of converting it", () => {
      for (const phenomenon of PHENOMENA) {
        const baseline = contentOf("1", phenomenon.key);
        const crossed = contentOf("25", phenomenon.key);

        // The digits are identical to the baseline; only the unit label changed. Stated this way
        // the assertion needs no captured literal, so it keeps describing the bug precisely even
        // if the seed values or formats change.
        expect(numbersIn(crossed), `case 25 / ${phenomenon.key} converted the magnitude`)
          .to.deep.equal(numbersIn(baseline));
        expect(crossed, `case 25 / ${phenomenon.key} did not relabel`).not.to.equal(baseline);
      }
    });
  });
});

/** The numeric literals in a rendered field, ignoring unit labels and punctuation. */
function numbersIn(content: string): number[] {
  return (content.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
}
