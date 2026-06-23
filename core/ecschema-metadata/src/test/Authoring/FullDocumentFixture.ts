/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { DecimalPrecision, FormatTraits, FormatType } from "@itwin/core-quantity";
import { CustomAttributeContainerType, ECClassModifier, PrimitiveType, StrengthDirection, StrengthType } from "../../ECObjects";
import { Multiplicity, SchemaDocument } from "../../Authoring/SchemaDocument";

/** Composes a document exercising every schema item kind, property kind, and CA placement.
 * Shared by the XML and JSON round-trip tests. */
export function composeFullDocument(): SchemaDocument {
  const doc = new SchemaDocument("TestDomain", "td", 1, 2, 3, {
    label: "Test Domain",
    description: "Round-trip fixture",
    references: [
      { name: "BisCore", readVersion: 1, writeVersion: 0, minorVersion: 0, alias: "bis" },
      { name: "CoreCustomAttributes", readVersion: 1, writeVersion: 0, minorVersion: 3, alias: "CoreCA" },
    ],
  });
  doc.customAttributes.add({ className: "CoreCustomAttributes.DynamicSchema" });
  // eslint-disable-next-line @typescript-eslint/naming-convention
  doc.customAttributes.add({ className: "TestDomain:Tagged", json: { Note: "hello & <welcome>", Tags: ["a", "b"] } });

  // Units / formats family.
  doc.createUnitSystem("METRIC", { label: "Metric" });
  doc.createPhenomenon("LENGTH", "LENGTH");
  doc.createUnit("M", "LENGTH", "METRIC", "M", { label: "m" });
  doc.createUnit("MM", "LENGTH", "METRIC", "MILLI*M", { numerator: 1, denominator: 1000 });
  doc.createInvertedUnit("INV_M", "M", "METRIC");
  doc.createConstant("PI", "LENGTH", "ONE", { numerator: 3.14159 });
  doc.createFormat("DefaultReal", FormatType.Decimal, {
    precision: DecimalPrecision.Four,
    formatTraits: FormatTraits.KeepSingleZero | FormatTraits.ShowUnitLabel,
    uomSeparator: "",
    composite: { includeZero: true, spacer: "", units: [{ name: "M", label: "m" }] },
  });
  doc.createKindOfQuantity("LENGTH_KOQ", "M", 0.001, {
    label: "Length",
    presentationFormats: ["f:DefaultReal(4)[u:M]"],
  });

  doc.createPropertyCategory("Main", { priority: 100 });

  const status = doc.createEnumeration("Status", "int", { isStrict: false });
  status.createEnumerator("On", 1, { label: "On" });
  status.createEnumerator("Off", 2);
  const codes = doc.createEnumeration("Codes", "string");
  codes.createEnumerator("A", "a-value", { description: "the a" });

  doc.createCustomAttributeClass("Tagged", CustomAttributeContainerType.Schema | CustomAttributeContainerType.AnyClass);

  const partInfo = doc.createStructClass("PartInfo");
  partInfo.createPrimitive("PartNumber", PrimitiveType.String);

  const pump = doc.createEntity("Pump", { label: "Pump", baseClass: "BisCore:PhysicalElement", mixins: ["IMonitored"] });
  const serial = pump.createPrimitive("SerialNumber", PrimitiveType.String, { priority: 50, category: "Main" });
  serial.customAttributes.add({ className: "CoreCustomAttributes.HiddenProperty" });
  pump.createPrimitive("Length", PrimitiveType.Double, { kindOfQuantity: "LENGTH_KOQ" });
  pump.createEnumeration("State", "Status");
  pump.createPrimitiveArray("Readings", PrimitiveType.Double, { minOccurs: 0, maxOccurs: 10 });
  pump.createPrimitiveArray("Notes", PrimitiveType.String); // unbounded
  pump.createStruct("MainPart", "PartInfo");
  pump.createStructArray("Parts", "PartInfo", { minOccurs: 1 });
  pump.createNavigation("PartsRel", "PumpOwnsParts", StrengthDirection.Forward, { description: "nav" });

  doc.createMixin("IMonitored", "Pump", { description: "monitoring mixin" });

  // The modifier is set explicitly even though None is the spec default. ECXML 3.1+ requires the
  // modifier attribute on relationship classes (native rejects a relationship without it, default or
  // not), so the XML writer always emits it and the reader always reads it back as an explicit
  // value. strength and strengthDirection are set explicitly for the matching reason on the JSON
  // side: native ECJSON always materializes a relationship's strength and strengthDirection (even at
  // their defaults), so a relationship that round-trips through JSON always carries them explicitly.
  // A relationship that round-trips through either format therefore carries all three explicitly;
  // setting them here keeps the XML-read and JSON-read documents identical (the round-trip tests
  // assert byte-identical output across both formats).
  doc.createRelationship("PumpOwnsParts", { strength: StrengthType.Embedding, strengthDirection: StrengthDirection.Forward, modifier: ECClassModifier.None,
    source: { multiplicity: Multiplicity.OneOne, roleLabel: "owns", constraintClasses: ["Pump"] },
    target: { multiplicity: Multiplicity.ZeroMany, roleLabel: "is owned by", polymorphic: false, constraintClasses: ["PartInfo"] },
   });
  return doc;
}
