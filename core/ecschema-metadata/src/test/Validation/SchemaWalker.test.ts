/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { beforeAll, describe, expect, it, vi } from "vitest";
import { SchemaContext } from "../../Context";
import { SchemaReadHelper } from "../../Deserialization/Helper";
import { JsonParser } from "../../Deserialization/JsonParser";
import { ECClass } from "../../Metadata/Class";
import { RelationshipClass } from "../../Metadata/RelationshipClass";
import { Schema } from "../../Metadata/Schema";
import { ISchemaPartVisitor } from "../../SchemaPartVisitorDelegate";
import { SchemaWalker } from "../../Validation/SchemaWalker";
import { ECSchemaNamespaceUris } from "../../Constants";

/* eslint-disable @typescript-eslint/naming-convention */

describe("SchemaWalker tests", () => {
  let testSchema: Schema;
  const baseJson = {
    $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
    name: "TestSchema",
    version: "1.2.3",
    alias: "ts",
  };

  const schemaJson = {
    ...baseJson,
    items: {
      TestEntityBase: {
        schemaItemType: "EntityClass",
        properties: [
          {
            name: "A",
            type: "PrimitiveProperty",
            typeName: "double",
          },
          {
            name: "B",
            type: "PrimitiveProperty",
            typeName: "double",
          },
        ],
      },
      TestEntityA: {
        schemaItemType: "EntityClass",
        BaseClass: "TestSchema.TestEntityBase",
      },
      TestEntityB: {
        schemaItemType: "EntityClass",
        BaseClass: "TestSchema.TestEntityBase",
      },
      TestRelationship: {
        schemaItemType: "RelationshipClass",
        strength: "Embedding",
        strengthDirection: "Backward",
        modifier: "Sealed",
        source: {
          polymorphic: false,
          multiplicity: "(0..*)",
          roleLabel: "Source RoleLabel",
          abstractConstraint: "TestSchema.TestEntityBase",
          constraintClasses: [
            "TestSchema.TestEntityA",
          ],
        },
        target: {
          polymorphic: false,
          multiplicity: "(0..*)",
          roleLabel: "Target RoleLabel",
          abstractConstraint: "TestSchema.TestEntityBase",
          constraintClasses: [
            "TestSchema.TestEntityB",
          ],
        },
      },
      TestEnum: {
        schemaItemType: "Enumeration",
        type: "int",
        enumerators: [
          {
            name: "TestEnumeration",
            value: 2,
          },
        ],
      },
      TestStruct: {
        schemaItemType: "StructClass",
      },
      TestMixin: {
        schemaItemType: "Mixin",
        appliesTo: "TestSchema.TestEntityA",
      },
      TestCAClass: {
        schemaItemType: "CustomAttributeClass",
        appliesTo: "AnyClass",
      },
      TestCategory: {
        schemaItemType: "PropertyCategory",
      },
      Length: {
        schemaItemType: "Phenomenon",
        definition: "LENGTH(1)",
      },
      Metric: {
        schemaItemType: "UnitSystem",
      },
      M: {
        schemaItemType: "Unit",
        phenomenon: "TestSchema.Length",
        unitSystem: "TestSchema.Metric",
        definition: "[MILLI]*M",
      },
      TestInvertedUnit: {
        schemaItemType: "InvertedUnit",
        unitSystem: "TestSchema.Metric",
        invertsUnit: "TestSchema.M",
      },
      TestFormat: {
        schemaItemType: "Format",
        type: "Decimal",
      },
      TestConstant: {
        schemaItemType: "Constant",
        phenomenon: "TestSchema.Length",
        definition: "TestLength",
        numerator: 1.2,
        denominator: 1,
      },
      TestKoQ: {
        schemaItemType: "KindOfQuantity",
        relativeError: 5,
        persistenceUnit: "TestSchema.M",
      },
    },
  };

const mockVisitor: ISchemaPartVisitor = {
    visitClass: vi.fn(),
    visitCustomAttributeContainer: vi.fn(),
    visitProperty: vi.fn(),
    visitRelationshipClass: vi.fn(),
    visitRelationshipConstraint: vi.fn(),
    visitEntityClass: vi.fn(),
    visitStructClass: vi.fn(),
    visitMixin: vi.fn(),
    visitCustomAttributeClass: vi.fn(),
    visitEnumeration: vi.fn(),
    visitKindOfQuantity: vi.fn(),
    visitPropertyCategory: vi.fn(),
    visitUnit: vi.fn(),
    visitInvertedUnit: vi.fn(),
    visitUnitSystem: vi.fn(),
    visitPhenomenon: vi.fn(),
    visitFormat: vi.fn(),
    visitConstant: vi.fn(),
    visitFullSchema: vi.fn(),
  };

  const context = new SchemaContext();
  testSchema = new Schema(context);

  beforeAll(async () => {
    const reader = new SchemaReadHelper(JsonParser, context);
    testSchema = await reader.readSchema(testSchema, schemaJson);
  });

  it("should call all visit methods", async () => {
    const reader = new SchemaWalker(mockVisitor);
    testSchema = await reader.traverseSchema(testSchema);
    expect(testSchema).to.exist;

    expect(mockVisitor.visitFullSchema).toHaveBeenCalledOnce();
    expect(mockVisitor.visitFullSchema).toHaveBeenCalledWith(testSchema);
    expect(mockVisitor.visitCustomAttributeContainer).toHaveBeenCalledWith(testSchema);


    const testEntityBase = await testSchema.getItem("TestEntityBase") as ECClass;
    expect(mockVisitor.visitClass).toHaveBeenCalledWith(testEntityBase);
    expect(mockVisitor.visitCustomAttributeContainer).toHaveBeenCalledWith(testEntityBase);
    expect(mockVisitor.visitEntityClass).toHaveBeenCalledWith(testEntityBase);

    const props = Array.from(testEntityBase.getPropertiesSync(true));
    const aProp = props[0];
    const bProp = props[1];
    expect(mockVisitor.visitProperty).toHaveBeenCalledTimes(2);
    expect(mockVisitor.visitProperty).toHaveBeenCalledWith(aProp);
    expect(mockVisitor.visitProperty).toHaveBeenNthCalledWith(2, bProp);
    expect(mockVisitor.visitCustomAttributeContainer).toHaveBeenCalledWith(aProp);
    expect(mockVisitor.visitCustomAttributeContainer).toHaveBeenCalledWith(bProp);

    const testEntityA = await testSchema.getItem("TestEntityA") as ECClass;
    expect(mockVisitor.visitClass).toHaveBeenCalledWith(testEntityA);
    expect(mockVisitor.visitCustomAttributeContainer).toHaveBeenCalledWith(testEntityA);
    expect(mockVisitor.visitEntityClass).toHaveBeenCalledWith(testEntityA);

    const testEntityB = await testSchema.getItem("TestEntityB") as ECClass;
    expect(mockVisitor.visitClass).toHaveBeenCalledWith(testEntityB);
    expect(mockVisitor.visitCustomAttributeContainer).toHaveBeenCalledWith(testEntityB);
    expect(mockVisitor.visitEntityClass).toHaveBeenCalledWith(testEntityB);

    const testRelationship = await testSchema.getItem("TestRelationship") as RelationshipClass;
    expect(mockVisitor.visitClass).toHaveBeenCalledWith(testRelationship);
    expect(mockVisitor.visitRelationshipClass).toHaveBeenCalledWith(testRelationship);
    expect(mockVisitor.visitCustomAttributeContainer).toHaveBeenCalledWith(testRelationship);
    expect(mockVisitor.visitRelationshipConstraint).toHaveBeenCalledTimes(2);
    expect(mockVisitor.visitRelationshipConstraint).toHaveBeenCalledWith(testRelationship.source);
    expect(mockVisitor.visitRelationshipConstraint).toHaveBeenCalledWith(testRelationship.target);
    expect(mockVisitor.visitCustomAttributeContainer).toHaveBeenCalledWith(testRelationship.source);
    expect(mockVisitor.visitCustomAttributeContainer).toHaveBeenCalledWith(testRelationship.target);

    const testStruct = await testSchema.getItem("TestStruct") as ECClass;
    expect(mockVisitor.visitClass).toHaveBeenCalledWith(testStruct);
    expect(mockVisitor.visitCustomAttributeContainer).toHaveBeenCalledWith(testStruct);
    expect(mockVisitor.visitStructClass).toHaveBeenCalledWith(testStruct);

    const testMixin = await testSchema.getItem("TestMixin") as ECClass;
    expect(mockVisitor.visitClass).toHaveBeenCalledWith(testMixin);
    expect(mockVisitor.visitCustomAttributeContainer).toHaveBeenCalledWith(testMixin);
    expect(mockVisitor.visitMixin).toHaveBeenCalledWith(testMixin);

    const testCAClass = await testSchema.getItem("TestCAClass") as ECClass;
    expect(mockVisitor.visitClass).toHaveBeenCalledWith(testCAClass);
    expect(mockVisitor.visitCustomAttributeContainer).toHaveBeenCalledWith(testCAClass);
    expect(mockVisitor.visitCustomAttributeClass).toHaveBeenCalledWith(testCAClass);

    const testEnum = await testSchema.getItem("TestEnum");
    expect(mockVisitor.visitEnumeration).toHaveBeenCalledOnce();
    expect(mockVisitor.visitEnumeration).toHaveBeenCalledWith(testEnum);

    const testCategory = await testSchema.getItem("TestCategory");
    expect(mockVisitor.visitPropertyCategory).toHaveBeenCalledOnce();
    expect(mockVisitor.visitPropertyCategory).toHaveBeenCalledWith(testCategory);

    const testKoq = await testSchema.getItem("TestKoQ");
    expect(mockVisitor.visitKindOfQuantity).toHaveBeenCalledOnce();
    expect(mockVisitor.visitKindOfQuantity).toHaveBeenCalledWith(testKoq);

    const testUnitSystem = await testSchema.getItem("Metric");
    expect(mockVisitor.visitUnitSystem).toHaveBeenCalledOnce();
    expect(mockVisitor.visitUnitSystem).toHaveBeenCalledWith(testUnitSystem);

    const testUnit = await testSchema.getItem("M");
    expect(mockVisitor.visitUnit).toHaveBeenCalledOnce();
    expect(mockVisitor.visitUnit).toHaveBeenCalledWith(testUnit);

    const testInvertedUnit = await testSchema.getItem("TestInvertedUnit");
    expect(mockVisitor.visitInvertedUnit).toHaveBeenCalledOnce();
    expect(mockVisitor.visitInvertedUnit).toHaveBeenCalledWith(testInvertedUnit);

    const testPhenomenon = await testSchema.getItem("Length");
    expect(mockVisitor.visitPhenomenon).toHaveBeenCalledOnce();
    expect(mockVisitor.visitPhenomenon).toHaveBeenCalledWith(testPhenomenon);

    const testFormat = await testSchema.getItem("TestFormat");
    expect(mockVisitor.visitFormat).toHaveBeenCalledOnce();
    expect(mockVisitor.visitFormat).toHaveBeenCalledWith(testFormat);

    const testConstant = await testSchema.getItem("TestConstant");
    expect(mockVisitor.visitConstant).toHaveBeenCalledOnce();
    expect(mockVisitor.visitConstant).toHaveBeenCalledWith(testConstant);
  });
});
