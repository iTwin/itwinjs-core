/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as sinon from "sinon";
import { SchemaContext } from "../../Context";
import { SchemaReadHelper } from "../../Deserialization/Helper";
import { JsonParser } from "../../Deserialization/JsonParser";
import { ECClass } from "../../Metadata/Class";
import { RelationshipClass } from "../../Metadata/RelationshipClass";
import { Schema } from "../../Metadata/Schema";
import { ISchemaPartVisitor } from "../../SchemaPartVisitorDelegate";
import { SchemaWalker } from "../../Validation/SchemaWalker";

/* eslint-disable @typescript-eslint/naming-convention */

describe("SchemaWalker tests", () => {
  let testSchema: Schema;
  const baseJson = {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
    name: "TestSchema",
    version: "1.2.3",
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

  type Mock<T> = { readonly [P in keyof T]: sinon.SinonSpy; };
  let mockVisitor: Mock<ISchemaPartVisitor>;

  beforeEach(async () => {
    mockVisitor = {
      visitClass: sinon.spy(),
      visitCustomAttributeContainer: sinon.spy(),
      visitProperty: sinon.spy(),
      visitRelationshipClass: sinon.spy(),
      visitRelationshipConstraint: sinon.spy(),
      visitEntityClass: sinon.spy(),
      visitStructClass: sinon.spy(),
      visitMixin: sinon.spy(),
      visitCustomAttributeClass: sinon.spy(),
      visitEnumeration: sinon.spy(),
      visitKindOfQuantity: sinon.spy(),
      visitPropertyCategory: sinon.spy(),
      visitUnit: sinon.spy(),
      visitInvertedUnit: sinon.spy(),
      visitUnitSystem: sinon.spy(),
      visitPhenomenon: sinon.spy(),
      visitFormat: sinon.spy(),
      visitConstant: sinon.spy(),
      visitFullSchema: sinon.spy(),
    };

    const context = new SchemaContext();
    testSchema = new Schema(context);
    const reader = new SchemaReadHelper(JsonParser, context);
    testSchema = await reader.readSchema(testSchema, schemaJson);
  });

  it("should call all visit methods", async () => {
    const reader = new SchemaWalker(mockVisitor);
    testSchema = await reader.traverseSchema(testSchema);
    expect(testSchema).to.exist;

    expect(mockVisitor!.visitFullSchema!.calledOnce).to.be.true;
    expect(mockVisitor!.visitFullSchema!.calledWithExactly(testSchema)).to.be.true;
    expect(mockVisitor!.visitFullSchema!.calledBefore(mockVisitor!.visitClass!)).to.be.true;
    expect(mockVisitor!.visitCustomAttributeContainer!.calledWithExactly(testSchema)).to.be.true;

    const testEntityBase = await testSchema.getItem("TestEntityBase") as ECClass;
    expect(mockVisitor!.visitClass!.calledWithExactly(testEntityBase)).to.be.true;
    expect(mockVisitor!.visitCustomAttributeContainer!.calledWithExactly(testEntityBase)).to.be.true;
    expect(mockVisitor!.visitEntityClass!.calledWithExactly(testEntityBase)).to.be.true;

    const props = [...testEntityBase.properties!];
    const aProp = props[0];
    const bProp = props[1];
    expect(mockVisitor!.visitProperty!.calledTwice).to.be.true;
    expect(mockVisitor!.visitProperty!.calledOnceWithExactly(aProp));
    expect(mockVisitor!.visitProperty!.calledOnceWithExactly(bProp));
    expect(mockVisitor!.visitCustomAttributeContainer!.calledWithExactly(aProp)).to.be.true;
    expect(mockVisitor!.visitCustomAttributeContainer!.calledWithExactly(bProp)).to.be.true;

    const testEntityA = await testSchema.getItem("TestEntityA") as ECClass;
    expect(mockVisitor!.visitClass!.calledWithExactly(testEntityA)).to.be.true;
    expect(mockVisitor!.visitCustomAttributeContainer!.calledWithExactly(testEntityA)).to.be.true;
    expect(mockVisitor!.visitEntityClass!.calledWithExactly(testEntityA)).to.be.true;

    const testEntityB = await testSchema.getItem("TestEntityB") as ECClass;
    expect(mockVisitor!.visitClass!.calledWithExactly(testEntityB)).to.be.true;
    expect(mockVisitor!.visitCustomAttributeContainer!.calledWithExactly(testEntityB)).to.be.true;
    expect(mockVisitor!.visitEntityClass!.calledWithExactly(testEntityB)).to.be.true;

    const testRelationship = await testSchema.getItem("TestRelationship") as RelationshipClass;
    expect(mockVisitor!.visitRelationshipClass!.calledWithExactly(testRelationship)).to.be.true;
    expect(mockVisitor!.visitCustomAttributeContainer!.calledWithExactly(testRelationship)).to.be.true;
    expect(mockVisitor!.visitRelationshipConstraint!.calledWithExactly(testRelationship.source)).to.be.true;
    expect(mockVisitor!.visitRelationshipConstraint!.calledWithExactly(testRelationship.target)).to.be.true;
    expect(mockVisitor!.visitCustomAttributeContainer!.calledWithExactly(testRelationship.source)).to.be.true;
    expect(mockVisitor!.visitCustomAttributeContainer!.calledWithExactly(testRelationship.target)).to.be.true;

    const testStruct = await testSchema.getItem("TestStruct") as ECClass;
    expect(mockVisitor!.visitClass!.calledWithExactly(testStruct)).to.be.true;
    expect(mockVisitor!.visitCustomAttributeContainer!.calledWithExactly(testStruct)).to.be.true;
    expect(mockVisitor!.visitStructClass!.calledWithExactly(testStruct)).to.be.true;

    const testMixin = await testSchema.getItem("TestMixin") as ECClass;
    expect(mockVisitor!.visitClass!.calledWithExactly(testMixin)).to.be.true;
    expect(mockVisitor!.visitCustomAttributeContainer!.calledWithExactly(testMixin)).to.be.true;
    expect(mockVisitor!.visitMixin!.calledWithExactly(testMixin)).to.be.true;

    const testCAClass = await testSchema.getItem("TestCAClass") as ECClass;
    expect(mockVisitor!.visitClass!.calledWithExactly(testCAClass)).to.be.true;
    expect(mockVisitor!.visitCustomAttributeContainer!.calledWithExactly(testCAClass)).to.be.true;
    expect(mockVisitor!.visitCustomAttributeClass!.calledWithExactly(testCAClass)).to.be.true;

    const testEnum = await testSchema.getItem("TestEnum");
    expect(mockVisitor!.visitEnumeration!.calledOnce).to.be.true;
    expect(mockVisitor!.visitEnumeration!.calledWithExactly(testEnum)).to.be.true;

    const testCategory = await testSchema.getItem("TestCategory");
    expect(mockVisitor!.visitPropertyCategory!.calledOnce).to.be.true;
    expect(mockVisitor!.visitPropertyCategory!.calledWithExactly(testCategory)).to.be.true;

    const testKoq = await testSchema.getItem("TestKoQ");
    expect(mockVisitor!.visitKindOfQuantity!.calledOnce).to.be.true;
    expect(mockVisitor!.visitKindOfQuantity!.calledWithExactly(testKoq)).to.be.true;

    const testUnitSystem = await testSchema.getItem("Metric");
    expect(mockVisitor!.visitUnitSystem!.calledOnce).to.be.true;
    expect(mockVisitor!.visitUnitSystem!.calledWithExactly(testUnitSystem)).to.be.true;

    const testUnit = await testSchema.getItem("M");
    expect(mockVisitor!.visitUnit!.calledOnce).to.be.true;
    expect(mockVisitor!.visitUnit!.calledWithExactly(testUnit)).to.be.true;

    const testInvertedUnit = await testSchema.getItem("TestInvertedUnit");
    expect(mockVisitor!.visitInvertedUnit!.calledOnce).to.be.true;
    expect(mockVisitor!.visitInvertedUnit!.calledWithExactly(testInvertedUnit)).to.be.true;

    const testPhenomenon = await testSchema.getItem("Length");
    expect(mockVisitor!.visitPhenomenon!.calledOnce).to.be.true;
    expect(mockVisitor!.visitPhenomenon!.calledWithExactly(testPhenomenon)).to.be.true;

    const testFormat = await testSchema.getItem("TestFormat");
    expect(mockVisitor!.visitFormat!.calledOnce).to.be.true;
    expect(mockVisitor!.visitFormat!.calledWithExactly(testFormat)).to.be.true;

    const testConstant = await testSchema.getItem("TestConstant");
    expect(mockVisitor!.visitConstant!.calledOnce).to.be.true;
    expect(mockVisitor!.visitConstant!.calledWithExactly(testConstant)).to.be.true;
  });
});
