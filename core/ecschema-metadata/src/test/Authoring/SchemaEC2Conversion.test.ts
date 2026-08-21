/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/naming-convention */ // EC property names are PascalCase.
import { describe, expect, it } from "vitest";
import { PrimitiveType, SchemaItemType } from "../../ECObjects";
import { convertEC2CustomAttributes, convertToEC2CustomAttributes } from "../../Authoring/SchemaEC2Conversion";
import { SchemaDocument } from "../../Authoring/SchemaDocument";
import { ECSpec } from "../../Authoring/SchemaDocumentIO";
import { SchemaXmlReader } from "../../Authoring/SchemaXmlReader";
import { SchemaXmlWriter } from "../../Authoring/SchemaXmlWriter";

async function readEC2(body: string, references = `<ECSchemaReference name="EditorCustomAttributes" version="01.03" prefix="beca"/>`) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ECSchema schemaName="Legacy" nameSpacePrefix="lg" version="01.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.2.0">
    ${references}
${body}
</ECSchema>`;
  const { document, issues } = await new SchemaXmlReader().readDocument(xml);
  expect(document, [...issues].map((i) => i.message).join("\n")).toBeDefined();
  return document!;
}

function standardValues(entries: Array<[number, string]>, mustBeFromList?: boolean): string {
  const list = entries.map(([value, display]) => `<ValueMap><Value>${value}</Value><DisplayString>${display}</DisplayString></ValueMap>`).join("");
  const strict = mustBeFromList === undefined ? "" : `<MustBeFromList>${mustBeFromList ? "True" : "False"}</MustBeFromList>`;
  return `<ECCustomAttributes><StandardValues xmlns="EditorCustomAttributes.01.03">${strict}<ValueMap>${list}</ValueMap></StandardValues></ECCustomAttributes>`;
}

describe("StandardValues to enumeration", () => {
  it("creates an enumeration named for the declaring class and points the property at it", async () => {
    const doc = await readEC2(`
    <ECClass typeName="Widget" isDomainClass="True">
        <ECProperty propertyName="Status" typeName="int">${standardValues([[0, "None"], [1, "Some"]])}</ECProperty>
    </ECClass>`);
    convertEC2CustomAttributes(doc);

    const enumeration = doc.getItemOfType("Widget_Status", SchemaItemType.Enumeration)!;
    expect(enumeration).toBeDefined();
    expect(enumeration.backingType).toBe("int");
    expect(enumeration.enumerators.map((e) => [e.name, e.value, e.label])).toEqual([
      ["Widget_Status0", 0, "None"],
      ["Widget_Status1", 1, "Some"],
    ]);
    const property = doc.getEntity("Widget")!.getProperty("Status")!;
    expect(property.isPrimitive() && property.typeName).toBe("Widget_Status");
    expect(property.customAttributes.size).toBe(0);
  });

  it("takes strictness from MustBeFromList, defaulting to strict", async () => {
    const doc = await readEC2(`
    <ECClass typeName="A" isDomainClass="True">
        <ECProperty propertyName="P" typeName="int">${standardValues([[1, "One"]])}</ECProperty>
    </ECClass>
    <ECClass typeName="B" isDomainClass="True">
        <ECProperty propertyName="P" typeName="int">${standardValues([[2, "Two"]], false)}</ECProperty>
    </ECClass>`);
    convertEC2CustomAttributes(doc);
    expect(doc.getItemOfType("A_P", SchemaItemType.Enumeration)!.isStrict).toBe(true);
    expect(doc.getItemOfType("B_P", SchemaItemType.Enumeration)!.isStrict).toBe(false);
  });

  it("shares one enumeration between properties whose value maps agree", async () => {
    const doc = await readEC2(`
    <ECClass typeName="A" isDomainClass="True">
        <ECProperty propertyName="First" typeName="int">${standardValues([[1, "One"]])}</ECProperty>
        <ECProperty propertyName="Second" typeName="int">${standardValues([[1, "One"]])}</ECProperty>
    </ECClass>`);
    convertEC2CustomAttributes(doc);
    expect([...doc.getItemsOfType(SchemaItemType.Enumeration)].map((e) => e.name)).toEqual(["A_First"]);
    const properties = doc.getEntity("A")!.properties;
    expect(properties.map((p) => p.isPrimitive() && p.typeName)).toEqual(["A_First", "A_First"]);
  });

  it("keeps a conflicting display string on its own enumeration", async () => {
    const doc = await readEC2(`
    <ECClass typeName="A" isDomainClass="True">
        <ECProperty propertyName="First" typeName="int">${standardValues([[1, "One"]])}</ECProperty>
        <ECProperty propertyName="Second" typeName="int">${standardValues([[1, "Uno"]])}</ECProperty>
    </ECClass>`);
    convertEC2CustomAttributes(doc);
    expect([...doc.getItemsOfType(SchemaItemType.Enumeration)].map((e) => e.name)).toEqual(["A_First", "A_Second"]);
  });

  it("names an overriding property's enumeration after the class that introduced it, and shares it", async () => {
    const doc = await readEC2(`
    <ECClass typeName="Base" isDomainClass="True">
        <ECProperty propertyName="P" typeName="int">${standardValues([[1, "One"], [2, "Two"]], false)}</ECProperty>
    </ECClass>
    <ECClass typeName="Derived" isDomainClass="True">
        <BaseClass>Base</BaseClass>
        <ECProperty propertyName="P" typeName="int">${standardValues([[1, "One"]])}</ECProperty>
    </ECClass>`);
    convertEC2CustomAttributes(doc);
    expect([...doc.getItemsOfType(SchemaItemType.Enumeration)].map((e) => e.name)).toEqual(["Base_P"]);
    const derived = doc.getEntity("Derived")!.getProperty("P")!;
    expect(derived.isPrimitive() && derived.typeName).toBe("Base_P");
  });

  it("absorbs new values into a non-strict enumeration", async () => {
    const doc = await readEC2(`
    <ECClass typeName="A" isDomainClass="True">
        <ECProperty propertyName="First" typeName="int">${standardValues([[1, "One"]], false)}</ECProperty>
        <ECProperty propertyName="Second" typeName="int">${standardValues([[1, "One"], [2, "Two"]], false)}</ECProperty>
    </ECClass>`);
    convertEC2CustomAttributes(doc);
    const enumerations = [...doc.getItemsOfType(SchemaItemType.Enumeration)];
    expect(enumerations.map((e) => e.name)).toEqual(["A_First"]);
    expect(enumerations[0].enumerators.map((e) => e.value)).toEqual([1, 2]);
  });

  it("drops the attribute from a non-integer property without creating an enumeration", async () => {
    const doc = await readEC2(`
    <ECClass typeName="A" isDomainClass="True">
        <ECProperty propertyName="Name" typeName="string">${standardValues([[1, "One"]])}</ECProperty>
    </ECClass>`);
    convertEC2CustomAttributes(doc);
    expect([...doc.getItemsOfType(SchemaItemType.Enumeration)]).toHaveLength(0);
    expect(doc.getEntity("A")!.getProperty("Name")!.customAttributes.size).toBe(0);
  });

  it("sidesteps a name already taken by another item", async () => {
    const doc = await readEC2(`
    <ECClass typeName="A_P" isDomainClass="True"/>
    <ECClass typeName="A" isDomainClass="True">
        <ECProperty propertyName="P" typeName="int">${standardValues([[1, "One"]])}</ECProperty>
    </ECClass>`);
    convertEC2CustomAttributes(doc);
    expect([...doc.getItemsOfType(SchemaItemType.Enumeration)].map((e) => e.name)).toEqual(["A_P_1"]);
  });
});

describe("Category and PropertyPriority", () => {
  it("creates a property category and points the property at it", async () => {
    const doc = await readEC2(`
    <ECClass typeName="A" isDomainClass="True">
        <ECProperty propertyName="P" typeName="string">
            <ECCustomAttributes>
                <Category xmlns="EditorCustomAttributes.01.03">
                    <Name>Geometry</Name>
                    <DisplayLabel>Geometry</DisplayLabel>
                    <Description>Shape data</Description>
                    <Priority>300</Priority>
                    <Expand>True</Expand>
                </Category>
            </ECCustomAttributes>
        </ECProperty>
    </ECClass>`);
    convertEC2CustomAttributes(doc);
    const category = doc.getItemOfType("Geometry", SchemaItemType.PropertyCategory)!;
    expect([category.label, category.description, category.priority]).toEqual(["Geometry", "Shape data", 300]);
    expect(doc.getEntity("A")!.getProperty("P")!.category).toBe("Geometry");
  });

  it("shares a category of the same name rather than rewriting the first one's fields", async () => {
    const category = (label: string) => `<ECCustomAttributes><Category xmlns="EditorCustomAttributes.01.03"><Name>Shared</Name><DisplayLabel>${label}</DisplayLabel></Category></ECCustomAttributes>`;
    const doc = await readEC2(`
    <ECClass typeName="A" isDomainClass="True">
        <ECProperty propertyName="P" typeName="string">${category("First")}</ECProperty>
        <ECProperty propertyName="Q" typeName="string">${category("Second")}</ECProperty>
    </ECClass>`);
    convertEC2CustomAttributes(doc);
    expect([...doc.getItemsOfType(SchemaItemType.PropertyCategory)].map((c) => c.label)).toEqual(["First"]);
  });

  it("suffixes a category whose name is taken by another item", async () => {
    const doc = await readEC2(`
    <ECClass typeName="Banana" isDomainClass="True"/>
    <ECClass typeName="A" isDomainClass="True">
        <ECProperty propertyName="P" typeName="string">
            <ECCustomAttributes><Category xmlns="EditorCustomAttributes.01.03"><Name>Banana</Name></Category></ECCustomAttributes>
        </ECProperty>
    </ECClass>`);
    convertEC2CustomAttributes(doc);
    expect(doc.getEntity("A")!.getProperty("P")!.category).toBe("Banana_Category");
  });

  it("reports a category with no name and creates nothing", async () => {
    const doc = await readEC2(`
    <ECClass typeName="A" isDomainClass="True">
        <ECProperty propertyName="P" typeName="string">
            <ECCustomAttributes><Category xmlns="EditorCustomAttributes.01.03"><Priority>1</Priority></Category></ECCustomAttributes>
        </ECProperty>
    </ECClass>`);
    const issues = convertEC2CustomAttributes(doc);
    expect([...doc.getItemsOfType(SchemaItemType.PropertyCategory)]).toHaveLength(0);
    expect([...issues].map((i) => i.code)).toContain("SchemaEC2-0001");
  });

  it("moves PropertyPriority onto the property", async () => {
    const doc = await readEC2(`
    <ECClass typeName="A" isDomainClass="True">
        <ECProperty propertyName="P" typeName="string">
            <ECCustomAttributes><PropertyPriority xmlns="EditorCustomAttributes.01.03"><Priority>-40</Priority></PropertyPriority></ECCustomAttributes>
        </ECProperty>
    </ECClass>`);
    convertEC2CustomAttributes(doc);
    const property = doc.getEntity("A")!.getProperty("P")!;
    expect(property.priority).toBe(-40);
    expect(property.customAttributes.size).toBe(0);
  });
});

describe("HideProperty and DisplayOptions", () => {
  it("turns HideProperty into HiddenProperty, keeping only the 3D flag", async () => {
    const hide = (if3d: string) => `<ECCustomAttributes><HideProperty xmlns="EditorCustomAttributes.01.03"><If2D>True</If2D><If3D>${if3d}</If3D></HideProperty></ECCustomAttributes>`;
    const doc = await readEC2(`
    <ECClass typeName="A" isDomainClass="True">
        <ECProperty propertyName="Hidden" typeName="string">${hide("True")}</ECProperty>
        <ECProperty propertyName="Shown" typeName="string">${hide("False")}</ECProperty>
    </ECClass>`);
    convertEC2CustomAttributes(doc);
    const shownValue = (name: string) => doc.getEntity("A")!.getProperty(name)!.customAttributes.get("CoreCustomAttributes:HiddenProperty")!.getValue("Show");
    expect(shownValue("Hidden")).toBe(false);
    expect(shownValue("Shown")).toBe(true);
    expect(doc.getSchemaReference("CoreCustomAttributes")).toBeDefined();
  });

  it("maps DisplayOptions onto HiddenClass, where Hidden alone hides but an explicit HideInstances=False wins", async () => {
    const options = (body: string) => `<ECCustomAttributes><DisplayOptions xmlns="Bentley_Standard_CustomAttributes.01.14">${body}</DisplayOptions></ECCustomAttributes>`;
    const doc = await readEC2(`
    <ECClass typeName="HiddenOnly" isDomainClass="True">${options("<Hidden>True</Hidden>")}</ECClass>
    <ECClass typeName="Overridden" isDomainClass="True">${options("<Hidden>True</Hidden><HideInstances>False</HideInstances>")}</ECClass>
    <ECClass typeName="InstancesOnly" isDomainClass="True">${options("<HideInstances>True</HideInstances>")}</ECClass>`,
    `<ECSchemaReference name="Bentley_Standard_CustomAttributes" version="01.14" prefix="bsca"/>`);
    convertEC2CustomAttributes(doc);
    const show = (name: string) => doc.getEntity(name)!.customAttributes.get("CoreCustomAttributes:HiddenClass")!.getValue("Show");
    expect(show("HiddenOnly")).toBe(false);
    expect(show("Overridden")).toBe(true);
    expect(show("InstancesOnly")).toBe(false);
  });

  it("turns DisplayOptions on the schema into HiddenSchema, and adds nothing when it does not hide", async () => {
    const hidden = await readEC2(`<ECCustomAttributes><DisplayOptions xmlns="Bentley_Standard_CustomAttributes.01.14"><HideInstances>True</HideInstances></DisplayOptions></ECCustomAttributes>`,
      `<ECSchemaReference name="Bentley_Standard_CustomAttributes" version="01.14" prefix="bsca"/>`);
    convertEC2CustomAttributes(hidden);
    expect(hidden.customAttributes.has("CoreCustomAttributes:HiddenSchema")).toBe(true);

    const shown = await readEC2(`<ECCustomAttributes><DisplayOptions xmlns="Bentley_Standard_CustomAttributes.01.14"><Hidden>True</Hidden><HideInstances>False</HideInstances></DisplayOptions></ECCustomAttributes>`,
      `<ECSchemaReference name="Bentley_Standard_CustomAttributes" version="01.14" prefix="bsca"/>`);
    convertEC2CustomAttributes(shown);
    expect(shown.customAttributes.size).toBe(0);
  });
});

describe("relocations to CoreCustomAttributes", () => {
  const bscaReference = `<ECSchemaReference name="Bentley_Standard_CustomAttributes" version="01.14" prefix="bsca"/>`;

  it("moves DateTimeInfo and ClassHasCurrentTimeStampProperty with their values", async () => {
    const doc = await readEC2(`
    <ECClass typeName="A" isDomainClass="True">
        <ECCustomAttributes>
            <ClassHasCurrentTimeStampProperty xmlns="Bentley_Standard_CustomAttributes.01.14"><PropertyName>LastMod</PropertyName></ClassHasCurrentTimeStampProperty>
        </ECCustomAttributes>
        <ECProperty propertyName="LastMod" typeName="dateTime">
            <ECCustomAttributes>
                <DateTimeInfo xmlns="Bentley_Standard_CustomAttributes.01.14"><DateTimeKind>Utc</DateTimeKind><DateTimeComponent>DateTime</DateTimeComponent></DateTimeInfo>
            </ECCustomAttributes>
        </ECProperty>
    </ECClass>`, bscaReference);
    convertEC2CustomAttributes(doc);

    const ecClass = doc.getEntity("A")!;
    expect(ecClass.customAttributes.get("CoreCustomAttributes:ClassHasCurrentTimeStampProperty")!.getValue("PropertyName")).toBe("LastMod");
    const dateTimeInfo = ecClass.getProperty("LastMod")!.customAttributes.get("CoreCustomAttributes:DateTimeInfo")!;
    expect(dateTimeInfo.values).toEqual({ DateTimeKind: "Utc", DateTimeComponent: "DateTime" });
  });

  it("folds the supplemental schema's primary version fields into the struct the new class uses", async () => {
    const doc = await readEC2(`
    <ECCustomAttributes>
        <SupplementalSchemaMetaData xmlns="Bentley_Standard_CustomAttributes.01.14">
            <PrimarySchemaName>Primary</PrimarySchemaName>
            <PrimarySchemaMajorVersion>2</PrimarySchemaMajorVersion>
            <PrimarySchemaMinorVersion>7</PrimarySchemaMinorVersion>
            <Precedence>200</Precedence>
            <Purpose>Mapping</Purpose>
            <IsUserSpecific>False</IsUserSpecific>
        </SupplementalSchemaMetaData>
    </ECCustomAttributes>`, bscaReference);
    convertEC2CustomAttributes(doc);
    expect(doc.customAttributes.get("CoreCustomAttributes:SupplementalSchema")!.values).toEqual({
      PrimarySchemaReference: { SchemaName: "Primary", MajorVersion: 2, MinorVersion: 7 },
      Precedence: 200,
      Purpose: "Mapping",
    });
  });

  it("drops the legacy schema reference once nothing names it any more", async () => {
    const doc = await readEC2(`
    <ECCustomAttributes><DynamicSchema xmlns="Bentley_Standard_CustomAttributes.01.14"/></ECCustomAttributes>`, bscaReference);
    convertEC2CustomAttributes(doc);
    expect(doc.customAttributes.has("CoreCustomAttributes:DynamicSchema")).toBe(true);
    expect(doc.getSchemaReference("Bentley_Standard_CustomAttributes")).toBeUndefined();
    expect(doc.getSchemaReference("CoreCustomAttributes")).toBeDefined();
  });

  it("keeps the legacy reference while an unconverted attribute still needs it", async () => {
    const doc = await readEC2(`
    <ECCustomAttributes>
        <DynamicSchema xmlns="Bentley_Standard_CustomAttributes.01.14"/>
        <SystemSchema xmlns="Bentley_Standard_CustomAttributes.01.14"/>
    </ECCustomAttributes>`, bscaReference);
    convertEC2CustomAttributes(doc);
    expect(doc.getSchemaReference("Bentley_Standard_CustomAttributes")).toBeDefined();
  });
});


describe("legacy unit attributes to kinds of quantity", () => {
  const unitReference = `<ECSchemaReference name="Unit_Attributes" version="01.00" prefix="units_attribs"/>`;

  function unitSpecification(body: string): string {
    return `<UnitSpecification xmlns="Unit_Attributes.01.00">${body}</UnitSpecification>`;
  }

  it("turns a property's unit into a kind of quantity naming the mapped EC unit", async () => {
    const doc = await readEC2(`
    <ECClass typeName="Pipe" isDomainClass="True">
        <ECProperty propertyName="Length" typeName="double">
            <ECCustomAttributes>${unitSpecification("<KindOfQuantityName>LENGTH</KindOfQuantityName><DimensionName>L</DimensionName><UnitName>FOOT</UnitName>")}</ECCustomAttributes>
        </ECProperty>
    </ECClass>`, unitReference);
    const issues = convertEC2CustomAttributes(doc);
    expect([...issues].filter((i) => i.severity === "error")).toHaveLength(0);

    const koq = doc.getItemOfType("LENGTH", SchemaItemType.KindOfQuantity)!;
    expect(koq.persistenceUnit).toBe("Units:FT");
    expect(koq.relativeError).toBe(1e-4);
    const property = doc.getEntity("Pipe")!.getProperty("Length")!;
    expect(property.kindOfQuantity).toBe("LENGTH");
    expect(property.customAttributes.size).toBe(0);
    expect(doc.getSchemaReference("Units")).toBeDefined();
    expect(doc.getSchemaReference("Unit_Attributes")).toBeUndefined();
  });

  it("falls back to the schema-level defaults when the property names only a kind or dimension", async () => {
    const doc = await readEC2(`
    <ECCustomAttributes>
        <UnitSpecifications xmlns="Unit_Attributes.01.00">
            <UnitSpecificationList>
                <UnitSpecification><DimensionName>L</DimensionName><KindOfQuantityName>LENGTH</KindOfQuantityName><UnitName>METRE</UnitName></UnitSpecification>
                <UnitSpecification><DimensionName>L2</DimensionName><KindOfQuantityName>AREA</KindOfQuantityName><UnitName>METRE_SQUARED</UnitName></UnitSpecification>
            </UnitSpecificationList>
        </UnitSpecifications>
    </ECCustomAttributes>
    <ECClass typeName="Slab" isDomainClass="True">
        <ECProperty propertyName="Span" typeName="double">
            <ECCustomAttributes>${unitSpecification("<KindOfQuantityName>LENGTH</KindOfQuantityName>")}</ECCustomAttributes>
        </ECProperty>
        <ECProperty propertyName="Surface" typeName="double">
            <ECCustomAttributes>${unitSpecification("<DimensionName>L2</DimensionName>")}</ECCustomAttributes>
        </ECProperty>
    </ECClass>`, unitReference);
    convertEC2CustomAttributes(doc);

    const slab = doc.getEntity("Slab")!;
    expect(doc.getItemOfType(slab.getProperty("Span")!.kindOfQuantity!, SchemaItemType.KindOfQuantity)!.persistenceUnit).toBe("Units:M");
    expect(doc.getItemOfType(slab.getProperty("Surface")!.kindOfQuantity!, SchemaItemType.KindOfQuantity)!.persistenceUnit).toBe("Units:SQ_M");
    // The schema-level defaults have no EC 3.2 equivalent and are gone once consulted.
    expect(doc.customAttributes.size).toBe(0);
  });

  it("turns a display unit into a presentation format and adds the Formats reference", async () => {
    const doc = await readEC2(`
    <ECClass typeName="Pipe" isDomainClass="True">
        <ECProperty propertyName="Length" typeName="double">
            <ECCustomAttributes>
                ${unitSpecification("<KindOfQuantityName>LENGTH</KindOfQuantityName><UnitName>METRE</UnitName>")}
                <DisplayUnitSpecification xmlns="Unit_Attributes.01.00"><DisplayUnitName>KILOMETRE</DisplayUnitName><DisplayFormatString>0.##</DisplayFormatString></DisplayUnitSpecification>
            </ECCustomAttributes>
        </ECProperty>
    </ECClass>`, unitReference);
    convertEC2CustomAttributes(doc);

    const koq = doc.getItemOfType("LENGTH", SchemaItemType.KindOfQuantity)!;
    expect(koq.persistenceUnit).toBe("Units:M");
    expect(koq.presentationFormats).toEqual(["Formats:DefaultRealU[Units:KM]"]);
    expect(doc.getSchemaReference("Formats")).toBeDefined();
  });

  it("shares one kind of quantity between properties that agree, and separates those that do not", async () => {
    const doc = await readEC2(`
    <ECClass typeName="Pipe" isDomainClass="True">
        <ECProperty propertyName="A" typeName="double"><ECCustomAttributes>${unitSpecification("<KindOfQuantityName>LENGTH</KindOfQuantityName><UnitName>METRE</UnitName>")}</ECCustomAttributes></ECProperty>
        <ECProperty propertyName="B" typeName="double"><ECCustomAttributes>${unitSpecification("<KindOfQuantityName>LENGTH</KindOfQuantityName><UnitName>METRE</UnitName>")}</ECCustomAttributes></ECProperty>
        <ECProperty propertyName="C" typeName="double"><ECCustomAttributes>${unitSpecification("<KindOfQuantityName>LENGTH</KindOfQuantityName><UnitName>FOOT</UnitName>")}</ECCustomAttributes></ECProperty>
    </ECClass>`, unitReference);
    convertEC2CustomAttributes(doc);

    const pipe = doc.getEntity("Pipe")!;
    expect(pipe.getProperty("A")!.kindOfQuantity).toBe("LENGTH");
    expect(pipe.getProperty("B")!.kindOfQuantity).toBe("LENGTH");
    // A second unit for the same legacy name cannot share, so it falls to the class-qualified name.
    expect(pipe.getProperty("C")!.kindOfQuantity).toBe("LENGTH_Pipe");
    expect([...doc.getItemsOfType(SchemaItemType.KindOfQuantity)]).toHaveLength(2);
  });

  it("reports a legacy unit with no EC equivalent rather than inventing one", async () => {
    const doc = await readEC2(`
    <ECClass typeName="Pipe" isDomainClass="True">
        <ECProperty propertyName="Length" typeName="double">
            <ECCustomAttributes>${unitSpecification("<KindOfQuantityName>BANANAS</KindOfQuantityName><UnitName>BANANA</UnitName>")}</ECCustomAttributes>
        </ECProperty>
    </ECClass>`, unitReference);
    const issues = convertEC2CustomAttributes(doc);
    expect([...doc.getItemsOfType(SchemaItemType.KindOfQuantity)]).toHaveLength(0);
    expect([...issues].map((i) => i.code)).toContain("SchemaEC2-0021");
  });

  it("drops the unit-system markers, which have no EC 3.2 equivalent", async () => {
    const doc = await readEC2(`
    <ECCustomAttributes>
        <IsUnitSystemSchema xmlns="Unit_Attributes.01.00"/>
        <SI_UnitSystem xmlns="Unit_Attributes.01.00"/>
    </ECCustomAttributes>`, unitReference);
    convertEC2CustomAttributes(doc);
    expect(doc.customAttributes.size).toBe(0);
    expect(doc.getSchemaReference("Unit_Attributes")).toBeUndefined();
  });

  it("round-trips a kind of quantity down to the legacy attributes and back", async () => {
    const original = new SchemaDocument("Round", "rd", 1, 0, 0);
    original.setSchemaReference({ name: "Units", readVersion: 1, writeVersion: 0, minorVersion: 0, alias: "u" });
    original.setSchemaReference({ name: "Formats", readVersion: 1, writeVersion: 0, minorVersion: 0, alias: "f" });
    original.createKindOfQuantity("LENGTH", "Units:M", 1e-4, { presentationFormats: ["Formats:DefaultRealU[Units:FT]"] });
    original.createEntity("Pipe").createPrimitive("Length", PrimitiveType.Double, { kindOfQuantity: "LENGTH" });

    convertToEC2CustomAttributes(original);
    const property = original.getEntity("Pipe")!.getProperty("Length")!;
    expect(property.customAttributes.get("Unit_Attributes:UnitSpecification")!.values).toEqual({ KindOfQuantityName: "LENGTH", UnitName: "METRE" });
    expect(property.customAttributes.get("Unit_Attributes:DisplayUnitSpecification")!.values).toEqual({ DisplayUnitName: "FOOT", DisplayFormatString: "0.######" });

    const text = new SchemaXmlWriter().writeDocument(original, { spec: ECSpec.V2_0 }).text!;
    const reread = (await new SchemaXmlReader().readDocument(text)).document!;
    convertEC2CustomAttributes(reread);

    const recovered = reread.getItemOfType("LENGTH", SchemaItemType.KindOfQuantity)!;
    expect(recovered.persistenceUnit).toBe("Units:M");
    expect(recovered.presentationFormats).toEqual(["Formats:DefaultRealU[Units:FT]"]);
    expect(reread.getEntity("Pipe")!.getProperty("Length")!.kindOfQuantity).toBe("LENGTH");
  });
});

describe("conversion back to EC2 custom attributes", () => {
  function buildDocument(): SchemaDocument {
    const doc = new SchemaDocument("Down", "dn", 1, 0, 0);
    const status = doc.createEnumeration("Status", "int", { isStrict: false });
    status.createEnumerator("Status1", 1, { label: "One" });
    status.createEnumerator("Status2", 2, { label: "Two" });
    const base = doc.createEntity("Base");
    base.createEnumeration("State", "Status");
    const derived = doc.createEntity("Derived", { baseClass: "Base" });
    derived.createEnumeration("State", "Status");
    doc.createEntity("Other").createPrimitive("Name", PrimitiveType.String);
    return doc;
  }

  it("adds StandardValues where the type is declared, not on the override", () => {
    const doc = buildDocument();
    convertToEC2CustomAttributes(doc);
    const standardValuesOf = (className: string) => doc.getEntity(className)!.getProperty("State")!.customAttributes.get("EditorCustomAttributes:StandardValues");
    expect(standardValuesOf("Base")!.values).toEqual({
      MustBeFromList: false,
      ValueMap: [{ Value: 1, DisplayString: "One" }, { Value: 2, DisplayString: "Two" }],
    });
    expect(standardValuesOf("Derived")).toBeUndefined();
    expect(doc.getSchemaReference("EditorCustomAttributes")).toBeDefined();
  });

  it("round-trips an enumeration through 2.0 and back", async () => {
    const doc = buildDocument();
    convertToEC2CustomAttributes(doc);
    const text = new SchemaXmlWriter().writeDocument(doc, { spec: ECSpec.V2_0 }).text!;

    const reread = (await new SchemaXmlReader().readDocument(text)).document!;
    convertEC2CustomAttributes(reread);
    const enumeration = doc.getItemOfType("Status", SchemaItemType.Enumeration)!;
    const recovered = [...reread.getItemsOfType(SchemaItemType.Enumeration)][0];
    // The name comes back derived from the class and property, since 2.0 carries no enumeration name.
    expect(recovered.name).toBe("Base_State");
    expect(recovered.isStrict).toBe(enumeration.isStrict);
    expect(recovered.enumerators.map((e) => [e.value, e.label])).toEqual(enumeration.enumerators.map((e) => [e.value, e.label]));
    // The override carries no StandardValues of its own, so it lands on the same enumeration.
    const derivedState = reread.getEntity("Derived")!.getProperty("State")!;
    expect(derivedState.isPrimitive() && derivedState.typeName).toBe("int");
  });

  it("reports a persistence unit with no legacy equivalent", () => {
    const doc = new SchemaDocument("Down", "dn", 1, 0, 0);
    doc.createKindOfQuantity("WEIRD", "Units:NOT_A_UNIT", 0.0001);
    doc.createEntity("C").createPrimitive("P", PrimitiveType.Double, { kindOfQuantity: "WEIRD" });
    expect([...convertToEC2CustomAttributes(doc)].map((i) => i.code)).toEqual(["SchemaEC2-0022"]);
  });
});
