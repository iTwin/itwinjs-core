/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { readFile } from "fs/promises";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { SchemaItemType } from "../../ECObjects";
import { AnyClass, SchemaDocument } from "../../Authoring/SchemaDocument";
import { SchemaXmlReader } from "../../Authoring/SchemaXmlReader";
import { getStandardSchemas } from "../../Authoring/StandardSchemas";

// The built-in standard schemas exist so a consumer can read a QueryView or an IsMixin without
// loading ECDbMap or CoreCustomAttributes first. Their risk is drift: the published schema changes
// shape and the built-in copy quietly keeps converting values the old way. These tests compare the
// built-ins against the schemas shipped by the @bentley npm packages, which are the same files the
// round-trip oracles use.

const PUBLISHED = [
  { packageName: "core-custom-attributes-schema", fileName: "CoreCustomAttributes.ecschema.xml", schemaName: "CoreCustomAttributes" },
  { packageName: "ecdb-map-schema", fileName: "ECDbMap.ecschema.xml", schemaName: "ECDbMap" },
];

/** One class as the converter sees it: the property names and the value shape of each. Everything
 * the built-ins deliberately leave out (labels, descriptions, appliesTo, base classes) is not part
 * of this. */
function shapeOf(item: AnyClass): Record<string, string> {
  const shape: Record<string, string> = {};
  for (const property of item.properties) {
    if (property.isStruct())
      shape[property.name] = `${property.isArray() ? "structArray" : "struct"} ${property.typeName}`;
    else if (property.isPrimitive())
      shape[property.name] = `${property.isArray() ? "primitiveArray" : "primitive"} ${property.typeName}`;
    else
      shape[property.name] = "navigation";
  }
  return shape;
}

/** The shape of every custom attribute class and struct class in a schema, keyed by class name. */
function shapesOf(document: SchemaDocument): Map<string, Record<string, string>> {
  const shapes = new Map<string, Record<string, string>>();
  for (const kind of [SchemaItemType.CustomAttributeClass, SchemaItemType.StructClass] as const) {
    for (const item of document.getItemsOfType(kind))
      shapes.set(item.name, shapeOf(item));
  }
  return shapes;
}

async function readPublished(packageName: string, fileName: string): Promise<SchemaDocument> {
  const path = join(process.cwd(), "node_modules", "@bentley", packageName, fileName);
  const result = await new SchemaXmlReader().readDocument(await readFile(path, "utf8"), { source: fileName });
  expect(result.issues.hasErrors, JSON.stringify(result.issues.errors)).to.be.false;
  return result.document!;
}

describe("Built-in standard schemas", () => {
  for (const { packageName, fileName, schemaName } of PUBLISHED) {
    it(`matches the published ${schemaName}`, async () => {
      const published = shapesOf(await readPublished(packageName, fileName));
      const builtIn = getStandardSchemas().getSchema(schemaName);
      expect(builtIn, `${schemaName} is missing from the built-in schemas`).to.not.be.undefined;

      const differences: string[] = [];
      for (const [className, shape] of shapesOf(builtIn!)) {
        const publishedShape = published.get(className);
        if (publishedShape === undefined) {
          differences.push(`${className}: built in, but the published schema has no such class`);
          continue;
        }
        for (const [propertyName, kind] of Object.entries(shape)) {
          if (publishedShape[propertyName] !== kind)
            differences.push(`${className}.${propertyName}: built in as "${kind}", published as "${publishedShape[propertyName] ?? "absent"}"`);
        }
        for (const propertyName of Object.keys(publishedShape)) {
          if (shape[propertyName] === undefined)
            differences.push(`${className}.${propertyName}: published, but missing from the built-in definition`);
        }
      }
      expect(differences, differences.join("\n")).to.be.empty;
    });

    it(`covers every custom attribute class of the published ${schemaName}`, async () => {
      const published = await readPublished(packageName, fileName);
      const builtIn = getStandardSchemas().getSchema(schemaName)!;
      const missing = [...published.getItemsOfType(SchemaItemType.CustomAttributeClass)]
        .map((item) => item.name)
        .filter((name) => builtIn.getItemOfType(name, SchemaItemType.CustomAttributeClass) === undefined);

      expect(missing, `custom attribute classes with no built-in definition: ${missing.join(", ")}`).to.be.empty;
    });
  }

  it("declares versions matching the packages it is checked against", () => {
    const set = getStandardSchemas();
    expect(set.getSchema("CoreCustomAttributes")!.key.toString()).to.equal("CoreCustomAttributes.01.00.04");
    expect(set.getSchema("ECDbMap")!.key.toString()).to.equal("ECDbMap.02.00.04");
  });
});
