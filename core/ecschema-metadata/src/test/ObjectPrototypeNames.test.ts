/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { afterEach, describe, expect, it } from "vitest";
import { XMLSerializer } from "@xmldom/xmldom";
import { ECSchemaNamespaceUris } from "../Constants";
import { SchemaContext } from "../Context";
import { SchemaProps } from "../Deserialization/JsonProps";
import { SchemaParser } from "../IncrementalLoading/SchemaParser";
import { Schema } from "../Metadata/Schema";
import { deserializeXml, deserializeXmlSync, ReferenceSchemaLocater } from "./TestUtils/DeserializationHelpers";
import { createEmptyXmlDocument } from "./TestUtils/SerializationHelper";

// Names such as __proto__ and constructor are valid ECNames but also members of Object.prototype.
// Every place that keys a plain object by a name from schema content must treat them as ordinary names.

const objectPrototypeMembers = Object.getOwnPropertyNames(Object.prototype);

afterEach(() => {
  expect(Object.getOwnPropertyNames(Object.prototype)).toEqual(objectPrototypeMembers);
});

// Parsing JSON text makes `__proto__` an own key, the same way schema JSON arrives from a file or the backend.
function parseSchemaJson(itemsJson: string, customAttributesJson?: string): object {
  const customAttributes = customAttributesJson ? `,"customAttributes":${customAttributesJson}` : "";
  return JSON.parse(`{"$schema":"${ECSchemaNamespaceUris.SCHEMAURL3_2_JSON}","name":"TestSchema","version":"1.0.0","alias":"ts","items":${itemsJson}${customAttributes}}`);
}

describe("Names that are members of Object.prototype", () => {
  it("reads and writes ECJSON items named __proto__, constructor and toString", async () => {
    const json = parseSchemaJson(`{
      "__proto__": { "schemaItemType": "EntityClass" },
      "constructor": { "schemaItemType": "EntityClass", "baseClass": "TestSchema.__proto__" },
      "toString": { "schemaItemType": "StructClass" }
    }`);

    const schema = await Schema.fromJson(json, new SchemaContext());

    expect([...schema.getItems()].map((item) => item.name).sort()).toEqual(["__proto__", "constructor", "toString"]);
    const items = schema.toJSON().items!;
    expect(Object.getPrototypeOf(items)).toBe(Object.prototype);
    expect(Object.keys(items).sort()).toEqual(["__proto__", "constructor", "toString"]);
    expect(Object.getOwnPropertyDescriptor(items, "constructor")?.value).toHaveProperty("baseClass", "TestSchema.__proto__");
  });

  it("does not resolve an inherited member as a schema item", async () => {
    const json = parseSchemaJson(`{ "Pump": { "schemaItemType": "EntityClass", "baseClass": "TestSchema.toString" } }`);

    await expect(Schema.fromJson(json, new SchemaContext())).rejects.toThrow("Unable to locate SchemaItem TestSchema.toString.");
  });

  it("keeps custom attribute values named __proto__ through ECJSON and ECXML", async () => {
    const json = parseSchemaJson(`{
      "Mapping": {
        "schemaItemType": "CustomAttributeClass",
        "appliesTo": "Schema",
        "properties": [
          { "name": "__proto__", "type": "PrimitiveProperty", "typeName": "string" },
          { "name": "constructor", "type": "PrimitiveProperty", "typeName": "string" }
        ]
      }
    }`, `[{ "className": "TestSchema.Mapping", "__proto__": "first" }]`);

    const schema = await Schema.fromJson(json, new SchemaContext());

    const attribute = schema.toJSON().customAttributes![0];
    expect(Object.getPrototypeOf(attribute)).toBe(Object.prototype);
    expect(Object.keys(attribute)).toEqual(["className", "__proto__"]);
    expect(Object.getOwnPropertyDescriptor(attribute, "__proto__")?.value).toBe("first");

    const xml = new XMLSerializer().serializeToString(await schema.toXml(createEmptyXmlDocument()));
    expect(xml).toContain("<__proto__>first</__proto__>");
    expect(xml).not.toContain("<constructor>");
  });

  it("reads ECXML custom attribute and struct values named __proto__", async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ECSchema schemaName="TestSchema" alias="ts" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
  <ECCustomAttributes>
    <Mapping xmlns="TestSchema.01.00.00">
      <__proto__>first</__proto__>
      <Nested><__proto__>second</__proto__></Nested>
    </Mapping>
  </ECCustomAttributes>
  <ECStructClass typeName="Inner">
    <ECProperty propertyName="__proto__" typeName="string"/>
  </ECStructClass>
  <ECCustomAttributeClass typeName="Mapping" appliesTo="Schema">
    <ECProperty propertyName="__proto__" typeName="string"/>
    <ECStructProperty propertyName="Nested" typeName="Inner"/>
  </ECCustomAttributeClass>
</ECSchema>`;

    const schema = await deserializeXml(xml, new SchemaContext());

    const attribute = schema.customAttributes!.get("TestSchema.Mapping")!;
    expect(Object.getPrototypeOf(attribute)).toBe(Object.prototype);
    expect(Object.getOwnPropertyDescriptor(attribute, "__proto__")?.value).toBe("first");
    expect(Object.getPrototypeOf(attribute.Nested)).toBe(Object.prototype);
    expect(Object.getOwnPropertyDescriptor(attribute.Nested, "__proto__")?.value).toBe("second");
  });

  it("parses incrementally loaded items named __proto__ and constructor", async () => {
    const props = {
      $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
      name: "TestSchema",
      version: "1.0.0",
      alias: "ts",
      items: [
        { name: "__proto__", schemaItemType: "EntityClass" },
        { name: "constructor", schemaItemType: "EntityClass" },
      ],
    } as unknown as SchemaProps;

    const parsed = await SchemaParser.parse(props, []);

    expect(Object.getPrototypeOf(parsed.items)).toBe(Object.prototype);
    expect(Object.keys(parsed.items!)).toEqual(["__proto__", "constructor"]);
  });

  it("detects a reference cycle between schemas named constructor and toString", async () => {
    const schemaXml = (name: string, alias: string, refName: string) => `<?xml version="1.0" encoding="UTF-8"?>
<ECSchema schemaName="${name}" alias="${alias}" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
  <ECSchemaReference name="${refName}" version="01.00.00" alias="r"/>
</ECSchema>`;
    const context = new SchemaContext();
    const locater = new ReferenceSchemaLocater((xml, ctx) => deserializeXmlSync(xml, ctx), async (xml, ctx) => deserializeXml(xml, ctx));
    locater.addSchema("toString", schemaXml("toString", "t", "constructor"));
    context.addLocater(locater);

    await expect(deserializeXml(schemaXml("constructor", "c", "toString"), context)).rejects.toThrow("has reference cycles");
  });
});
