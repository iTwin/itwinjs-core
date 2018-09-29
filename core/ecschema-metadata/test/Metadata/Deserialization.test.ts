/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import * as sinon from "sinon";

import Schema from "../../src/Metadata/Schema";
import { SchemaContext } from "../../src/Context";
import { ECObjectsError } from "../../src/Exception";
import { SchemaDeserializationVisitor } from "../../src/Interfaces";
import SchemaReadHelper from "../../src/Deserialization/Helper";
import { AnyClass } from "../../src/Interfaces";
import { SchemaItemType } from "../../src/ECObjects";
import { NavigationProperty } from "../../src/Metadata/Property";

describe("Full Schema Deserialization", () => {
  describe("basic (empty) schemas", () => {
    it("should successfully deserialize a valid JSON string", async () => {
      const schemaString = JSON.stringify({
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
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
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
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
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
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
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
        name: "TestSchema",
        version: "1.100.0",
      };

      await expect(Schema.fromJson(schemaJson)).to.be.rejectedWith(ECObjectsError);
    });

    it("should throw for invalid schema name", async () => {
      const schemaJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
        name: "0TestSchema",
        version: "1.0.0",
      };

      await expect(Schema.fromJson(schemaJson)).to.be.rejectedWith(ECObjectsError);
    });
  });

  describe("with schema reference", () => {
    const baseJson = {
      $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
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
      await expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The schema TestSchema has an invalid 'references' property. It should be of type 'object[]'.`);

      json = { ...baseJson, references: [0] };
      await expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The schema TestSchema has an invalid 'references' property. It should be of type 'object[]'.`);
    });

    it("should throw for missing reference name", async () => {
      const json = {
        ...baseJson,
        references: [{ version: "1.0.5" }],
      };
      await expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The schema TestSchema has an invalid 'references' property. One of the references is missing the required 'name' property.`);
    });

    it("should throw for invalid reference name", async () => {
      const json = {
        ...baseJson,
        references: [{ name: 0, version: "1.0.5" }],
      };
      await expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The schema TestSchema has an invalid 'references' property. One of the references has an invalid 'name' property. It should be of type 'string'.`);
    });

    it("should throw for missing reference version", async () => {
      const json = {
        ...baseJson,
        references: [{ name: "RefSchema" }],
      };
      await expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The schema TestSchema has an invalid 'references' property. One of the references is missing the required 'version' property.`);
    });

    it("should throw for invalid reference version", async () => {
      const json = {
        ...baseJson,
        references: [{ name: "RefSchema", version: 0 }],
      };
      await expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The schema TestSchema has an invalid 'references' property. One of the references has an invalid 'version' property. It should be of type 'string'.`);
    });
  });

  describe("with items", () => {
    const baseJson = {
      $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
      name: "TestSchema",
      version: "1.2.3",
    };

    it("should throw for invalid items attribute", async () => {
      let json: any = { ...baseJson, items: 0 };
      await expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The schema TestSchema has an invalid 'items' property. It should be of type 'object'.`);

      json = { ...baseJson, items: [{}] };
      await expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The schema TestSchema has an invalid 'items' property. It should be of type 'object'.`);
    });

    it("should throw for item with invalid name", async () => {
      const json = { ...baseJson, items: { "": {} } };
      await expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `A SchemaItem in TestSchema has an invalid name.`);
    });

    it("should throw for item with missing schemaItemType", async () => {
      const json = {
        ...baseJson,
        items: { BadItem: {} },
      };
      await expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The SchemaItem BadItem is missing the required schemaItemType property.`);
    });

    it("should throw for item with invalid schemaItemType", async () => {
      const json = {
        ...baseJson,
        items: { BadItem: { schemaItemType: 0 } },
      };
      await expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The SchemaItem BadItem has an invalid 'schemaItemType' property. It should be of type 'string'.`);
    });
  });

  describe("with visitor", () => {
    const baseJson = {
      $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
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
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
        name: "TestSchema",
        version: "1.2.3",
        items: {
          TestEnum: { schemaItemType: "Enumeration", type: "int" },
          TestCategory: { schemaItemType: "PropertyCategory" },
          TestClass: { schemaItemType: "EntityClass" },
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
      const reader = new SchemaReadHelper(undefined, mockVisitor);
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
      const reader = new SchemaReadHelper(undefined, mockVisitor);

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
      const reader = new SchemaReadHelper(undefined, mockVisitor);

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
            source: {
              constraintClasses: ["TestSchema.AEntityClass"],
            },
            target: {
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
      const reader = new SchemaReadHelper(undefined, mockVisitor);

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
            source: {
              constraintClasses: ["TestSchema.BEntityClass"],
            },
            target: {
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
      const reader = new SchemaReadHelper(undefined, mockVisitor);

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
});
