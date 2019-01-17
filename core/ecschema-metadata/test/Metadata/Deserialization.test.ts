/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import * as sinon from "sinon";

import { Schema } from "./../../src/Metadata/Schema";
import { SchemaContext } from "./../../src/Context";
import { ECObjectsError } from "./../../src/Exception";
import { SchemaDeserializationVisitor } from "./../../src/Interfaces";
import { SchemaReadHelper } from "./../../src/Deserialization/Helper";
import { AnyClass } from "./../../src/Interfaces";
import { SchemaItemType } from "./../../src/ECObjects";
import { NavigationProperty } from "./../../src/Metadata/Property";
import { JsonParser } from "../../src/Deserialization/JsonParser";

describe("Full Schema Deserialization", () => {
  describe("basic (empty) schemas", () => {
    it("should successfully deserialize a valid JSON string", async () => {
      const schemaString = JSON.stringify({
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
        name: "TestSchema",
        version: "1.2.3",
        description: "This is a test description",
        label: "This is a test label",
      });

      const ecschema = await Schema.fromJson(schemaString);
      expect(ecschema.name).equal("TestSchema");
      expect(ecschema.readVersion).equal(1);
      expect(ecschema.writeVersion).equal(2);
      expect(ecschema.minorVersion).equal(3);
      expect(ecschema.description).equal("This is a test description");
      expect(ecschema.label).equal("This is a test label");
    });
    it("should successfully deserialize a valid JSON string synchronously", () => {
      const schemaString = JSON.stringify({
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
        name: "TestSchema",
        version: "1.2.3",
        description: "This is a test description",
        label: "This is a test label",
      });

      const ecschema = Schema.fromJsonSync(schemaString);
      expect(ecschema.name).equal("TestSchema");
      expect(ecschema.readVersion).equal(1);
      expect(ecschema.writeVersion).equal(2);
      expect(ecschema.minorVersion).equal(3);
      expect(ecschema.description).equal("This is a test description");
      expect(ecschema.label).equal("This is a test label");
    });

    it("should successfully deserialize name and version from a valid JSON object", async () => {
      const schemaJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
        name: "TestSchema",
        version: "1.2.3",
        description: "This is a test description",
        label: "This is a test label",
      };

      const ecschema = await Schema.fromJson(schemaJson);
      expect(ecschema.name).equal("TestSchema");
      expect(ecschema.readVersion).equal(1);
      expect(ecschema.writeVersion).equal(2);
      expect(ecschema.minorVersion).equal(3);
      expect(ecschema.description).equal("This is a test description");
      expect(ecschema.label).equal("This is a test label");
    });

    it("should throw for invalid schema version", async () => {
      const schemaJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
        name: "TestSchema",
        version: "1.100.0",
      };

      await expect(Schema.fromJson(schemaJson)).to.be.rejectedWith(ECObjectsError);
    });

    it("should throw for invalid schema name", async () => {
      const schemaJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
        name: "0TestSchema",
        version: "1.0.0",
      };

      await expect(Schema.fromJson(schemaJson)).to.be.rejectedWith(ECObjectsError);
    });
  });

  describe("with schema reference", () => {
    const baseJson = {
      $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
      name: "TestSchema",
      version: "1.2.3",
    };
    const validSchemaJson = {
      ...baseJson,
      references: [
        {
          name: "RefSchema",
          version: "1.0.5",
        },
      ],
    };

    it("should succeed when referenced schema is already in the schema context", async () => {
      const refSchema = new Schema("RefSchema", 1, 0, 5);
      const context = new SchemaContext();
      await context.addSchema(refSchema);

      const schema = await Schema.fromJson(validSchemaJson, context);
      assert.exists(schema);

      if (!schema.references)
        return;

      expect(schema.references.length).equal(1);
      if (!schema.references[0])
        assert.fail();
      assert.isTrue(schema.references[0] === refSchema);
    });

    it("should throw if the referenced schema cannot be found", async () => {
      const context = new SchemaContext();
      await expect(Schema.fromJson(validSchemaJson, context)).to.be.rejectedWith(ECObjectsError, "Could not locate the referenced schema, RefSchema.1.0.5, of TestSchema");
    });

    it("should throw for invalid references attribute", async () => {
      let json: any = { ...baseJson, references: 0 };
      await expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The schema TestSchema has an invalid 'references' attribute. It should be of type 'object[]'.`);

      json = { ...baseJson, references: [0] };
      await expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The schema TestSchema has an invalid 'references' attribute. It should be of type 'object[]'.`);
    });

    it("should throw for missing reference name", async () => {
      const json = {
        ...baseJson,
        references: [{ version: "1.0.5" }],
      };
      await expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The schema TestSchema has an invalid 'references' attribute. One of the references is missing the required 'name' attribute.`);
    });

    it("should throw for invalid reference name", async () => {
      const json = {
        ...baseJson,
        references: [{ name: 0, version: "1.0.5" }],
      };
      await expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The schema TestSchema has an invalid 'references' attribute. One of the references has an invalid 'name' attribute. It should be of type 'string'.`);
    });

    it("should throw for missing reference version", async () => {
      const json = {
        ...baseJson,
        references: [{ name: "RefSchema" }],
      };
      await expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The schema TestSchema has an invalid 'references' attribute. One of the references is missing the required 'version' attribute.`);
    });

    it("should throw for invalid reference version", async () => {
      const json = {
        ...baseJson,
        references: [{ name: "RefSchema", version: 0 }],
      };
      await expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The schema TestSchema has an invalid 'references' attribute. One of the references has an invalid 'version' attribute. It should be of type 'string'.`);
    });
  });

  describe("with items", () => {
    const baseJson = {
      $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
      name: "TestSchema",
      version: "1.2.3",
    };

    it("should throw for invalid items attribute", async () => {
      let json: any = { ...baseJson, items: 0 };
      await expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The schema TestSchema has an invalid 'items' attribute. It should be of type 'object'.`);

      json = { ...baseJson, items: [{}] };
      await expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The schema TestSchema has an invalid 'items' attribute. It should be of type 'object'.`);
    });

    it("should throw for item with invalid name", async () => {
      const json = { ...baseJson, items: { "": {} } };
      await expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `A SchemaItem in TestSchema has an invalid 'name' attribute. '' is not a valid ECName.`);
    });

    it("should throw for item with missing schemaItemType", async () => {
      const json = {
        ...baseJson,
        items: { BadItem: {} },
      };
      await expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The SchemaItem TestSchema.BadItem is missing the required 'schemaItemType' attribute.`);
    });

    it("should throw for item with invalid schemaItemType", async () => {
      const json = {
        ...baseJson,
        items: { BadItem: { schemaItemType: 0 } },
      };
      await expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The SchemaItem TestSchema.BadItem has an invalid 'schemaItemType' attribute. It should be of type 'string'.`);
    });
  });

  describe("with visitor", () => {
    const baseJson = {
      $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
      name: "TestSchema",
      version: "1.2.3",
    };
    type Mock<T> = { readonly [P in keyof T]: sinon.SinonSpy; };
    let mockVisitor: Mock<SchemaDeserializationVisitor>;

    beforeEach(() => {
      mockVisitor = {
        visitEmptySchema: sinon.spy(),
        visitClass: sinon.spy(),
        visitEnumeration: sinon.spy(),
        visitKindOfQuantity: sinon.spy(),
        visitPropertyCategory: sinon.spy(),
        visitFullSchema: sinon.spy(),
      };
    });

    it("should call all visit methods", async () => {
      const schemaJson = {
        ...baseJson,
        items: {
          TestClass: { schemaItemType: "EntityClass" },
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
          TestKoQ: {
            schemaItemType: "KindOfQuantity",
            relativeError: 5,
            persistenceUnit: "TestSchema.M",
          },
        },
      };
      let testSchema = new Schema();
      const reader = new SchemaReadHelper(JsonParser, undefined, mockVisitor);
      testSchema = await reader.readSchema(testSchema, schemaJson);
      expect(testSchema).to.exist;
      expect(mockVisitor!.visitEmptySchema!.calledOnce).to.be.true;
      expect(mockVisitor!.visitEmptySchema!.calledWithExactly(testSchema)).to.be.true;

      const testEnum = await testSchema.getItem("TestEnum");
      expect(testEnum).to.exist;
      expect(mockVisitor!.visitEnumeration!.calledOnce).to.be.true;
      expect(mockVisitor!.visitEnumeration!.calledWithExactly(testEnum)).to.be.true;
      expect(mockVisitor!.visitEnumeration!.calledAfter(mockVisitor!.visitEmptySchema!)).to.be.true;

      const testCategory = await testSchema.getItem("TestCategory");
      expect(testCategory).to.exist;
      expect(mockVisitor!.visitPropertyCategory!.calledOnce).to.be.true;
      expect(mockVisitor!.visitPropertyCategory!.calledWithExactly(testCategory)).to.be.true;
      expect(mockVisitor!.visitPropertyCategory!.calledAfter(mockVisitor!.visitEmptySchema!)).to.be.true;

      const testClass = await testSchema.getItem("TestClass");
      expect(testClass).to.exist;
      expect(mockVisitor!.visitClass!.calledOnce).to.be.true;
      expect(mockVisitor!.visitClass!.calledWithExactly(testClass)).to.be.true;
      expect(mockVisitor!.visitClass!.calledAfter(mockVisitor!.visitEmptySchema!)).to.be.true;

      const testKoq = await testSchema.getItem("TestKoQ");
      expect(testKoq).to.exist;
      expect(mockVisitor!.visitKindOfQuantity!.calledOnce).to.be.true;
      expect(mockVisitor!.visitKindOfQuantity!.calledWithExactly(testKoq)).to.be.true;
      expect(mockVisitor!.visitKindOfQuantity!.calledAfter(mockVisitor!.visitEmptySchema!)).to.be.true;

      expect(mockVisitor!.visitFullSchema!.calledOnce).to.be.true;
      expect(mockVisitor!.visitFullSchema!.calledWithExactly(testSchema)).to.be.true;
      expect(mockVisitor!.visitFullSchema!.calledAfter(mockVisitor!.visitEnumeration!)).to.be.true;
      expect(mockVisitor!.visitFullSchema!.calledAfter(mockVisitor!.visitPropertyCategory!)).to.be.true;
      expect(mockVisitor!.visitFullSchema!.calledAfter(mockVisitor!.visitClass!)).to.be.true;
      expect(mockVisitor!.visitFullSchema!.calledAfter(mockVisitor!.visitKindOfQuantity!)).to.be.true;
    });

    it("should safely handle Mixin-appliesTo-EntityClass-extends-Mixin cycle", async () => {
      const schemaJson = {
        ...baseJson,
        items: {
          AMixin: {
            schemaItemType: "Mixin",
            appliesTo: "TestSchema.BEntityClass",
            description: "Description for AMixin",
          },
          BEntityClass: {
            schemaItemType: "EntityClass",
            baseClass: "TestSchema.AMixin",
            description: "Description for BEntityClass",
          },
        },
      };

      const descriptions: string[] = [];
      mockVisitor = {
        visitClass: sinon.spy(async (c: AnyClass) => {
          if (c.schemaItemType === SchemaItemType.EntityClass && c.baseClass)
            descriptions.push((await c.baseClass).description!);
          else if (c.schemaItemType === SchemaItemType.Mixin && c.appliesTo)
            descriptions.push((await c.appliesTo).description!);
        }),
      };

      let testSchema = new Schema();
      const reader = new SchemaReadHelper(JsonParser, undefined, mockVisitor);

      testSchema = await reader.readSchema(testSchema, schemaJson);
      expect(testSchema).to.exist;
      expect(mockVisitor!.visitClass!.calledTwice).to.be.true;
      expect(descriptions).to.have.lengthOf(2);

      const testMixin = await testSchema.getItem("AMixin");
      expect(testMixin).to.exist;

      const testEntity = await testSchema.getItem("BEntityClass");
      expect(testEntity).to.exist;

      expect(mockVisitor!.visitClass!.firstCall.calledWithExactly(testEntity)).to.be.true;
      expect(descriptions[0]).to.equal("Description for AMixin",
        `SchemaDeserializationVisitor.visitClass was called for "BEntityClass" before its base class, "AMixin" was fully deserialized.`);

      expect(mockVisitor!.visitClass!.secondCall.calledWithExactly(testMixin)).to.be.true;
      expect(descriptions[1]).to.equal("Description for BEntityClass",
        `SchemaDeserializationVisitor.visitClass was called for "AMixin" before its appliesTo class, "BEntityClass" was fully deserialized.`);
    });

    it("should safely handle EntityClass-extends-Mixin-appliesTo-EntityClass cycle", async () => {
      const schemaJson = {
        ...baseJson,
        items: {
          AEntityClass: {
            schemaItemType: "EntityClass",
            baseClass: "TestSchema.BMixin",
            description: "Description for AEntityClass",
          },
          BMixin: {
            schemaItemType: "Mixin",
            appliesTo: "TestSchema.AEntityClass",
            description: "Description for BMixin",
          },
        },
      };

      const descriptions: string[] = [];
      mockVisitor = {
        visitClass: sinon.spy(async (c: AnyClass) => {
          if (c.schemaItemType === SchemaItemType.EntityClass && c.baseClass)
            descriptions.push((await c.baseClass).description!);
          else if (c.schemaItemType === SchemaItemType.Mixin && c.appliesTo)
            descriptions.push((await c.appliesTo).description!);
        }),
      };

      let testSchema = new Schema();
      const reader = new SchemaReadHelper(JsonParser, undefined, mockVisitor);

      testSchema = await reader.readSchema(testSchema, schemaJson);
      expect(testSchema).to.exist;
      expect(mockVisitor!.visitClass!.calledTwice).to.be.true;
      expect(descriptions).to.have.lengthOf(2);

      const testEntity = await testSchema.getItem("AEntityClass");
      expect(testEntity).to.exist;

      const testMixin = await testSchema.getItem("BMixin");
      expect(testMixin).to.exist;

      expect(mockVisitor!.visitClass!.firstCall.calledWithExactly(testMixin)).to.be.true;
      expect(descriptions[0]).to.equal("Description for AEntityClass",
        `SchemaDeserializationVisitor.visitClass was called for "BMixin" before its appliesTo class, "AEntityClass" was fully deserialized.`);

      expect(mockVisitor!.visitClass!.secondCall.calledWithExactly(testEntity)).to.be.true;
      expect(descriptions[1]).to.equal("Description for BMixin",
        `SchemaDeserializationVisitor.visitClass was called for "AEntityClass" before its base class, "BMixin" was fully deserialized.`);
    });

    it("should safely handle EntityClass-navProp-RelationshipClass-constraint-EntityClass cycle", async () => {
      const schemaJson = {
        ...baseJson,
        items: {
          AEntityClass: {
            schemaItemType: "EntityClass",
            description: "Description for AEntityClass",
            properties: [
              {
                type: "NavigationProperty",
                name: "testNavProp",
                relationshipName: "TestSchema.BRelationshipClass",
                direction: "forward",
              },
            ],
          },
          BRelationshipClass: {
            schemaItemType: "RelationshipClass",
            description: "Description for BRelationshipClass",
            strength: "Embedding",
            strengthDirection: "Forward",
            source: {
              multiplicity: "(0..1)",
              roleLabel: "Source roleLabel",
              polymorphic: false,
              constraintClasses: ["TestSchema.AEntityClass"],
            },
            target: {
              multiplicity: "(0..*)",
              roleLabel: "Target roleLabel",
              polymorphic: false,
              constraintClasses: ["TestSchema.AEntityClass"],
            },
          },
        },
      };

      const descriptions: string[] = [];
      mockVisitor = {
        visitClass: sinon.spy(async (c: AnyClass) => {
          if (c.schemaItemType === SchemaItemType.RelationshipClass)
            descriptions.push((await c.source.abstractConstraint!).description!);
          else if (c.schemaItemType === SchemaItemType.EntityClass) {
            const prop = await c.properties![0] as NavigationProperty;
            descriptions.push((await prop.relationshipClass).description!);
          }
        }),
      };

      let testSchema = new Schema();
      const reader = new SchemaReadHelper(JsonParser, undefined, mockVisitor);

      testSchema = await reader.readSchema(testSchema, schemaJson);
      expect(testSchema).to.exist;
      expect(mockVisitor!.visitClass!.calledTwice).to.be.true;
      expect(descriptions).to.have.lengthOf(2);

      const testEntity = await testSchema.getItem("AEntityClass");
      expect(testEntity).to.exist;

      const testRelationship = await testSchema.getItem("BRelationshipClass");
      expect(testRelationship).to.exist;

      expect(mockVisitor!.visitClass!.firstCall.calledWithExactly(testRelationship)).to.be.true;
      expect(descriptions[0]).to.equal("Description for AEntityClass",
        `SchemaDeserializationVisitor.visitClass was called for "BRelationshipClass" before the entity class its constraints use, "AEntityClass" was fully deserialized.`);

      expect(mockVisitor!.visitClass!.secondCall.calledWithExactly(testEntity)).to.be.true;
      expect(descriptions[1]).to.equal("Description for BRelationshipClass",
        `SchemaDeserializationVisitor.visitClass was called for "AEntityClass" before the relationship its NavigationProperty uses, "BRelationshipClass" was fully deserialized.`);
    });

    it("should safely handle RelationshipClass-constraint-EntityClass-navProp-RelationshipClass cycle", async () => {
      const schemaJson = {
        ...baseJson,
        items: {
          ARelationshipClass: {
            schemaItemType: "RelationshipClass",
            description: "Description for ARelationshipClass",
            strength: "referencing",
            strengthDirection: "Forward",
            source: {
              multiplicity: "(0..*)",
              roleLabel: "Source roleLabel",
              polymorphic: true,
              constraintClasses: ["TestSchema.BEntityClass"],
            },
            target: {
              multiplicity: "(1..*)",
              roleLabel: "Target roleLabel",
              polymorphic: true,
              constraintClasses: ["TestSchema.BEntityClass"],
            },
          },
          BEntityClass: {
            schemaItemType: "EntityClass",
            description: "Description for BEntityClass",
            properties: [
              {
                type: "NavigationProperty",
                name: "testNavProp",
                relationshipName: "TestSchema.ARelationshipClass",
                direction: "forward",
              },
            ],
          },
        },
      };

      const descriptions: string[] = [];
      mockVisitor = {
        visitClass: sinon.spy(async (c: AnyClass) => {
          if (c.schemaItemType === SchemaItemType.RelationshipClass)
            descriptions.push((await c.source.abstractConstraint!).description!);
          else if (c.schemaItemType === SchemaItemType.EntityClass) {
            const prop = await c.properties![0] as NavigationProperty;
            descriptions.push((await prop.relationshipClass).description!);
          }
        }),
      };

      let testSchema = new Schema();
      const reader = new SchemaReadHelper(JsonParser, undefined, mockVisitor);

      testSchema = await reader.readSchema(testSchema, schemaJson);
      expect(testSchema).to.exist;
      expect(mockVisitor!.visitClass!.calledTwice).to.be.true;
      expect(descriptions).to.have.lengthOf(2);

      const testRelationship = await testSchema.getItem("ARelationshipClass");
      expect(testRelationship).to.exist;

      const testEntity = await testSchema.getItem("BEntityClass");
      expect(testEntity).to.exist;

      expect(mockVisitor!.visitClass!.firstCall.calledWithExactly(testEntity)).to.be.true;
      expect(descriptions[0]).to.equal("Description for ARelationshipClass",
        `SchemaDeserializationVisitor.visitClass was called for "BEntityClass" before the relationship its NavigationProperty uses, "ARelationshipClass" was fully deserialized.`);

      expect(mockVisitor!.visitClass!.secondCall.calledWithExactly(testRelationship)).to.be.true;
      expect(descriptions[1]).to.equal("Description for BEntityClass",
        `SchemaDeserializationVisitor.visitClass was called for "ARelationshipClass" before the entity class its constraints use, "BEntityClass" was fully deserialized.`);

    });
  });

  describe("with schema custom attributes", () => {
    const baseJson = {
      $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
      name: "ValidSchema",
      version: "1.2.3",
      alias: "vs",
      label: "SomeDisplayLabel",
      description: "A really long description...",
      items: {
        TestCAClassA: { schemaItemType: "CustomAttributeClass", appliesTo: "AnyClass" },
        TestCAClassB: { schemaItemType: "CustomAttributeClass", appliesTo: "AnyClass" },
      }
    };

    const oneCustomAttributeJson = {
      ...baseJson,
      customAttributes: [
        {
          className: "ValidSchema.TestCAClassA",
          ShowClasses: true,
        },
      ],
    };

    it("async - single schema CustomAttribute", async () => {
      const testSchema = await Schema.fromJson(oneCustomAttributeJson);
      expect(testSchema).to.exist;
      expect(testSchema.customAttributes!.get("ValidSchema.TestCAClassA")).to.exist;
      assert(testSchema.customAttributes!.get("ValidSchema.TestCAClassA")!.ShowClasses === true);
    });

    it("sync - single schema CustomAttribute", () => {
      const testSchema = Schema.fromJsonSync(oneCustomAttributeJson);
      expect(testSchema).to.exist;
      expect(testSchema.customAttributes!.get("ValidSchema.TestCAClassA")).to.exist;
      assert(testSchema.customAttributes!.get("ValidSchema.TestCAClassA")!.ShowClasses === true);
    });

    const twoCustomAttributeJson = {
      ...baseJson,
      customAttributes: [
        {
          className: "ValidSchema.TestCAClassA",
        },
        {
          className: "ValidSchema.TestCAClassB",
        },
      ],
    };

    it("async - multiple schema CustomAttributes", async () => {
      const testSchema = await Schema.fromJson(twoCustomAttributeJson);
      expect(testSchema).to.exist;
      expect(testSchema.customAttributes!.get("ValidSchema.TestCAClassA")).to.exist;
      expect(testSchema.customAttributes!.get("ValidSchema.TestCAClassB")).to.exist;
    });

    it("sync - multiple schema CustomAttributes", () => {
      const testSchema = Schema.fromJsonSync(twoCustomAttributeJson);
      expect(testSchema).to.exist;
      expect(testSchema.customAttributes!.get("ValidSchema.TestCAClassA")).to.exist;
      expect(testSchema.customAttributes!.get("ValidSchema.TestCAClassB")).to.exist;
    });

    it("sync - multiple schema CustomAttributes with additional properties", () => {
      const propertyJson = {
        ...baseJson,
        customAttributes: [
          {
            className: "ValidSchema.TestCAClassA",
            ShowClasses: false,
          },
          {
            className: "ValidSchema.TestCAClassB",
            ShowClasses: true,
          },
        ],
      };

      const testSchema = Schema.fromJsonSync(propertyJson);
      expect(testSchema.customAttributes!.get("ValidSchema.TestCAClassA")).to.exist;
      expect(testSchema.customAttributes!.get("ValidSchema.TestCAClassB")).to.exist;
      assert(testSchema.customAttributes!.get("ValidSchema.TestCAClassA")!.ShowClasses === false);
      assert(testSchema.customAttributes!.get("ValidSchema.TestCAClassB")!.ShowClasses === true);
    });
  });

  describe("with property custom attributes", () => {
    const getSchemaJson = (propJson: any) => ({
      $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
      name: "ValidSchema",
      version: "1.2.3",
      alias: "vs",
      items: {
        TestCAClassA: { schemaItemType: "CustomAttributeClass", appliesTo: "AnyProperty" },
        TestCAClassB: { schemaItemType: "CustomAttributeClass", appliesTo: "AnyProperty" },
        TestCAClassC: { schemaItemType: "CustomAttributeClass", appliesTo: "AnyProperty" },
        TestClass: {
          schemaItemType: "EntityClass",
          properties: [
            {
              name: "TestProp",
              type: "PrimitiveProperty",
              typeName: "int",
              ...propJson,
            }
          ],
        },
      },
    });

    const oneCustomAttributeJson = getSchemaJson({
      customAttributes: [
        {
          className: "ValidSchema.TestCAClassA",
          ExampleAttribute: 1234,
        },
      ],
    });

    it("async - single property CustomAttribute", async () => {
      const testSchema = await Schema.fromJson(oneCustomAttributeJson);
      expect(testSchema).to.exist;
      const testProp = (await testSchema.getItem("TestClass") as AnyClass).properties![0];
      expect(testProp).to.exist;
      expect(testProp.name).to.eql("TestProp");
      expect(testProp.customAttributes!.get("ValidSchema.TestCAClassA")).to.exist;
      assert(testProp.customAttributes!.get("ValidSchema.TestCAClassA")!.ExampleAttribute === 1234);
    });

    it("sync - single property CustomAttribute", () => {
      const testSchema = Schema.fromJsonSync(oneCustomAttributeJson);
      expect(testSchema).to.exist;
      const testProp = (testSchema.getItemSync("TestClass") as AnyClass).properties![0];
      expect(testProp).to.exist;
      expect(testProp.name).to.eql("TestProp");
      expect(testProp.customAttributes!.get("ValidSchema.TestCAClassA")).to.exist;
      assert(testProp.customAttributes!.get("ValidSchema.TestCAClassA")!.ExampleAttribute === 1234);
    });

    const twoCustomAttributesJson = getSchemaJson({
      customAttributes: [
        {
          className: "ValidSchema.TestCAClassA",
        },
        {
          className: "ValidSchema.TestCAClassB",
        },
      ],
    });

    it("async - multiple property CustomAttributes", async () => {
      const testSchema = await Schema.fromJson(twoCustomAttributesJson);
      expect(testSchema).to.exist;
      const testProp = (await testSchema.getItem("TestClass") as AnyClass).properties![0];
      expect(testProp).to.exist;
      expect(testProp.name).to.eql("TestProp");
      expect(testProp.customAttributes!.get("ValidSchema.TestCAClassA")).to.exist;
      expect(testProp.customAttributes!.get("ValidSchema.TestCAClassB")).to.exist;
    });

    it("sync - multiple property CustomAttributes", () => {
      const testSchema = Schema.fromJsonSync(twoCustomAttributesJson);
      expect(testSchema).to.exist;
      const testProp = (testSchema.getItemSync("TestClass") as AnyClass).properties![0];
      expect(testProp).to.exist;
      expect(testProp.name).to.eql("TestProp");
      expect(testProp.customAttributes!.get("ValidSchema.TestCAClassA")).to.exist;
      expect(testProp.customAttributes!.get("ValidSchema.TestCAClassB")).to.exist;
    });

    it("sync - multiple property CustomAttributes with additional properties", () => {
      const propertyJson = {
        customAttributes: [
          {
            className: "ValidSchema.TestCAClassA",
            ShowClasses: 1.2,
          },
          {
            className: "ValidSchema.TestCAClassB",
            ExampleAttribute: true,
          },
          {
            className: "ValidSchema.TestCAClassC",
            Example2Attribute: "example",
          },
        ],
      };
      const testSchema = Schema.fromJsonSync(getSchemaJson(propertyJson));
      expect(testSchema).to.exist;
      const testProp = (testSchema.getItemSync("TestClass") as AnyClass).properties![0];
      expect(testProp).to.exist;

      assert(testProp.customAttributes!.get("ValidSchema.TestCAClassA")!.ShowClasses === 1.2);
      assert(testProp.customAttributes!.get("ValidSchema.TestCAClassB")!.ExampleAttribute === true);
      assert(testProp.customAttributes!.get("ValidSchema.TestCAClassC")!.Example2Attribute === "example");
    });
  });
});
