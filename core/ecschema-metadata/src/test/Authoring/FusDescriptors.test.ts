/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";
import { SchemaItemType } from "../../ECObjects";
import { SchemaDocument } from "../../Authoring/SchemaDocument";
import { ECSpec } from "../../Authoring/SchemaDocumentIO";
import { SchemaIssueList } from "../../Authoring/SchemaIssues";
import { formatStringFromFus, fusFromFormatString, splitFusDescriptor } from "../../Authoring/LegacyFormatNames";
import { SchemaXmlReader } from "../../Authoring/SchemaXmlReader";
import { SchemaXmlWriter } from "../../Authoring/SchemaXmlWriter";

function names(issues: SchemaIssueList): string[] {
  return [...issues].map((issue) => issue.name);
}

function schema31(koq: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ECSchema schemaName="TestSchema" alias="ts" version="01.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
  ${koq}
</ECSchema>`;
}

describe("FUS descriptor grammar", () => {
  it("takes a trailing parenthesized group as the format only when it is not a unit expression", () => {
    expect(splitFusDescriptor("M")).toEqual({ unit: "M" });
    expect(splitFusDescriptor("CM(real4u)")).toEqual({ unit: "CM", format: "real4u" });
    // The unit expression is itself parenthesized and holds operators, so the trailing group is
    // still the format - and the leading group is not mistaken for one.
    expect(splitFusDescriptor("W/(M*K)(real4u)")).toEqual({ unit: "W/(M*K)", format: "real4u" });
    expect(splitFusDescriptor("(SQ.M*KELVIN)/WATT(real4u)")).toEqual({ unit: "(SQ.M*KELVIN)/WATT", format: "real4u" });
    expect(splitFusDescriptor("(N*M)/DEG")).toEqual({ unit: "(N*M)/DEG" });
  });
});

describe("FUS to unit and format references", () => {
  it("makes the descriptor's unit an input override on a non-composite format", () => {
    expect(formatStringFromFus("CM(real4u)")).toBe("Formats:DefaultRealU(4)[Units:CM]");
    expect(formatStringFromFus("FT(real4)")).toBe("Formats:DefaultReal(4)[Units:FT]");
    expect(formatStringFromFus("M^4(realu)")).toBe("Formats:DefaultRealU[Units:M_TO_THE_FOURTH]");
  });

  it("drops the descriptor's unit when the format supplies its own", () => {
    // AmerFI is FT+IN, so the descriptor's unit is not an override - and two different units in
    // front of the same composite format therefore give the same result.
    expect(formatStringFromFus("IN(fi8)")).toBe("Formats:AmerFI");
    expect(formatStringFromFus("DM(fi8)")).toBe("Formats:AmerFI");
  });

  it("does not widen a mapping that already carries an override", () => {
    expect(formatStringFromFus("M(meters4u)")).toBe(`Formats:DefaultRealUNS(4)[Units:M|m]`);
  });

  it("uses the given default when the descriptor names no format", () => {
    expect(formatStringFromFus("CM", "Formats:DefaultReal")).toBe("Formats:DefaultReal[Units:CM]");
    expect(formatStringFromFus("CM")).toBeUndefined();
  });

  it("returns undefined for an unknown unit or format", () => {
    expect(formatStringFromFus("NOTAUNIT(real)")).toBeUndefined();
    expect(formatStringFromFus("M(notaformat)")).toBeUndefined();
  });
});

describe("Unit and format references back to FUS", () => {
  it("writes the alias spelling, taking the unit from the format's override", () => {
    expect(fusFromFormatString("Formats:DefaultRealU(4)[Units:CM|centimeters]")).toBe("CM(real4u)");
    expect(fusFromFormatString("Formats:DefaultReal(4)[Units:FT]")).toBe("FT(real4)");
  });

  it("takes the major unit of a composite format", () => {
    expect(fusFromFormatString("Formats:AmerFI")).toBe("FT(fi8)");
    expect(fusFromFormatString("Formats:AngleDMS")).toBe("ARC_DEG(dms)");
  });

  it("rejects a format with no unit to write, which is what a FUS has to lead with", () => {
    expect(fusFromFormatString("Formats:DefaultReal")).toBeUndefined();
    expect(fusFromFormatString("Formats:Fractional(8)")).toBeUndefined();
    expect(fusFromFormatString("Formats:NotAFormat[Units:M]")).toBeUndefined();
  });

  it("round-trips a descriptor through the reference form and back", () => {
    for (const descriptor of ["CM(real4u)", "FT(real4)", "IN(fi8)", "M^4(realu)"]) {
      const formatString = formatStringFromFus(descriptor)!;
      expect(formatStringFromFus(fusFromFormatString(formatString)!)).toBe(formatString);
    }
  });
});

describe("Kinds of quantity across the 3.2 boundary", () => {
  it("upgrades FUS descriptors on read and adds the standard schema references", async () => {
    const result = await new SchemaXmlReader().readDocument(schema31(
      `<KindOfQuantity typeName="LENGTH" persistenceUnit="M" relativeError="0.0001" presentationUnits="FT(real4);IN(fi8)" />`));
    const koq = result.document!.getItemOfType("LENGTH", SchemaItemType.KindOfQuantity)!;
    expect(koq.persistenceUnit).toBe("Units:M");
    expect(koq.presentationFormats).toEqual(["Formats:DefaultReal(4)[Units:FT]", "Formats:AmerFI"]);
    expect(result.document!.references.map((r) => r.name)).toEqual(["Units", "Formats"]);
  });

  it("promotes the persistence format when there is nothing else to present by", async () => {
    const result = await new SchemaXmlReader().readDocument(schema31(
      `<KindOfQuantity typeName="LENGTH" persistenceUnit="CM(real4u)" relativeError="0.0001" />`));
    const koq = result.document!.getItemOfType("LENGTH", SchemaItemType.KindOfQuantity)!;
    expect(koq.persistenceUnit).toBe("Units:CM");
    expect(koq.presentationFormats).toEqual(["Formats:DefaultRealU(4)[Units:CM]"]);
  });

  it("reports a descriptor it cannot map instead of dropping it silently", async () => {
    const dropped = await new SchemaXmlReader().readDocument(schema31(
      `<KindOfQuantity typeName="LENGTH" persistenceUnit="M" relativeError="0.0001" presentationUnits="FT(notaformat)" />`));
    expect(names(dropped.issues)).toContain("kind-of-quantity-format-unmapped");

    const skipped = await new SchemaXmlReader().readDocument(schema31(
      `<KindOfQuantity typeName="LENGTH" persistenceUnit="NOTAUNIT" relativeError="0.0001" />`));
    expect(names(skipped.issues)).toContain("kind-of-quantity-unit-unmapped");
    expect(skipped.document!.getItemOfType("LENGTH", SchemaItemType.KindOfQuantity)).toBeUndefined();
  });

  it("writes FUS descriptors below 3.2 and references at 3.2", () => {
    const doc = new SchemaDocument("TestSchema", "ts", 1, 0, 0, {
      references: [
        { name: "Units", readVersion: 1, writeVersion: 0, minorVersion: 0, alias: "u" },
        { name: "Formats", readVersion: 1, writeVersion: 0, minorVersion: 0, alias: "f" },
      ],
    });
    doc.createKindOfQuantity("LENGTH", "Units:M", 0.0001, {
      presentationFormats: ["Formats:DefaultRealU(4)[Units:CM]", "Formats:AmerFI"],
    });

    expect(new SchemaXmlWriter().writeDocument(doc, { spec: ECSpec.V3_1 }).text)
      .toContain(`persistenceUnit="M" relativeError="0.0001" presentationUnits="CM(real4u);FT(fi8)"`);
    expect(new SchemaXmlWriter().writeDocument(doc, { spec: ECSpec.V3_2 }).text)
      .toContain(`persistenceUnit="u:M"`);
  });

  it("drops a presentation format with no legacy counterpart, and the item when its unit has none", () => {
    const doc = new SchemaDocument("TestSchema", "ts", 1, 0, 0);
    doc.createKindOfQuantity("LENGTH", "Units:M", 0.0001, { presentationFormats: ["Formats:DefaultReal"] });
    doc.createKindOfQuantity("ODD", "Units:NOT_A_UNIT", 0.0001);

    const result = new SchemaXmlWriter().writeDocument(doc, { spec: ECSpec.V3_1 });
    expect(names(result.issues)).toContain("kind-of-quantity-format-unmapped");
    expect(names(result.issues)).toContain("kind-of-quantity-persistence-unit-unmapped");
    expect(result.text).toContain(`typeName="LENGTH"`);
    expect(result.text).not.toContain("presentationUnits");
    expect(result.text).not.toContain(`typeName="ODD"`);
  });

  it("survives a 3.1 read, 3.1 write, 3.1 read cycle unchanged", async () => {
    const original = schema31(
      `<KindOfQuantity typeName="LENGTH" persistenceUnit="M" relativeError="0.0001" presentationUnits="CM(real4u);FT(fi8)" />`);
    const once = (await new SchemaXmlReader().readDocument(original)).document!;
    const text = new SchemaXmlWriter().writeDocument(once, { spec: ECSpec.V3_1 }).text!;
    const twice = (await new SchemaXmlReader().readDocument(text)).document!;
    expect(twice.getItemOfType("LENGTH", SchemaItemType.KindOfQuantity)!.presentationFormats)
      .toEqual(once.getItemOfType("LENGTH", SchemaItemType.KindOfQuantity)!.presentationFormats);
  });
});
