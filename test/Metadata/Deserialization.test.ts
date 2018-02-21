/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import Schema from "../../source/Metadata/Schema";
import { SchemaContext } from "../../source/Context";
import { ECObjectsError } from "../../source/Exception";
import { SchemaDeserializationVisitor } from "../../source/Interfaces";
import SchemaReadHelper from "../../source/Deserialization/Helper";
import * as sinon from "sinon";

describe("Full Schema Deserialization", () => {
  describe("basic (empty) schemas", () => {
    it("should successfully deserialize a valid JSON string", async () => {
      const schemaString = JSON.stringify({
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
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

    it("should successfully deserialize name and version from a valid JSON object", async () => {
      const schemaJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
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
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
        name: "TestSchema",
        version: "1.100.0",
      };

      await expect(Schema.fromJson(schemaJson)).to.be.rejectedWith(ECObjectsError);
    });

    it("should throw for invalid schema name", async () => {
      const schemaJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
        name: "0TestSchema",
        version: "1.0.0",
      };

      await expect(Schema.fromJson(schemaJson)).to.be.rejectedWith(ECObjectsError);
    });
  });

  describe("with schema reference", () => {
    const baseJson = {
      $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
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
        references: [ { version: "1.0.5" } ],
      };
      await expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The schema TestSchema has an invalid 'references' property. One of the references is missing the required 'name' property.`);
    });

    it("should throw for invalid reference name", async () => {
      const json = {
        ...baseJson,
        references: [ { name: 0, version: "1.0.5" } ],
      };
      await expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The schema TestSchema has an invalid 'references' property. One of the references has an invalid 'name' property. It should be of type 'string'.`);
    });

    it("should throw for missing reference version", async () => {
      const json = {
        ...baseJson,
        references: [ { name: "RefSchema" } ],
      };
      await expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The schema TestSchema has an invalid 'references' property. One of the references is missing the required 'version' property.`);
    });

    it("should throw for invalid reference version", async () => {
      const json = {
        ...baseJson,
        references: [ { name: "RefSchema", version: 0 } ],
      };
      await expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The schema TestSchema has an invalid 'references' property. One of the references has an invalid 'version' property. It should be of type 'string'.`);
    });
  });

  describe("with children", () => {
    const baseJson = {
      $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
      name: "TestSchema",
      version: "1.2.3",
    };

    it("should throw for invalid children attribute", async () => {
      let json: any = { ...baseJson, children: 0 };
      await expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The schema TestSchema has an invalid 'children' property. It should be of type 'object'.`);

      json = { ...baseJson, children: [ {} ] };
      await expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The schema TestSchema has an invalid 'children' property. It should be of type 'object'.`);
    });

    it("should throw for child with invalid name", async () => {
      const json = { ...baseJson, children: { "": {} } };
      await expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `A SchemaChild in TestSchema has an invalid name.`);
    });

    it("should throw for child with missing schemaChildType", async () => {
      const json = {
        ...baseJson,
        children: { BadChild: {} },
      };
      await expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The SchemaChild BadChild is missing the required schemaChildType property.`);
    });

    it("should throw for child with invalid schemaChildType", async () => {
      const json = {
        ...baseJson,
        children: { BadChild: { schemaChildType: 0 } },
      };
      await expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The SchemaChild BadChild has an invalid 'schemaChildType' property. It should be of type 'string'.`);
    });
  });

  describe("with visitor", () => {
    const baseJson = {
      $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
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
        children: {
          TestEnum: { schemaChildType: "Enumeration", backingTypeName: "int" },
          TestCategory: { schemaChildType: "PropertyCategory" },
          TestClass: { schemaChildType: "EntityClass" },
          TestKoQ: { schemaChildType: "KindOfQuantity" },
        },
      };
      let testSchema = new Schema();
      const reader = new SchemaReadHelper(undefined, mockVisitor);

      testSchema = await reader.readSchema(testSchema, schemaJson);
      expect(testSchema).to.exist;
      expect(mockVisitor.visitEmptySchema.calledOnce).to.be.true;
      expect(mockVisitor.visitEmptySchema.calledWithExactly(testSchema)).to.be.true;

      const testEnum = await testSchema.getChild("TestEnum");
      expect(testEnum).to.exist;
      expect(mockVisitor.visitEnumeration.calledOnce).to.be.true;
      expect(mockVisitor.visitEnumeration.calledWithExactly(testEnum)).to.be.true;
      expect(mockVisitor.visitEnumeration.calledAfter(mockVisitor.visitEmptySchema)).to.be.true;

      const testCategory = await testSchema.getChild("TestCategory");
      expect(testCategory).to.exist;
      expect(mockVisitor.visitPropertyCategory.calledOnce).to.be.true;
      expect(mockVisitor.visitPropertyCategory.calledWithExactly(testCategory)).to.be.true;
      expect(mockVisitor.visitPropertyCategory.calledAfter(mockVisitor.visitEmptySchema)).to.be.true;

      const testClass = await testSchema.getChild("TestClass");
      expect(testClass).to.exist;
      expect(mockVisitor.visitClass.calledOnce).to.be.true;
      expect(mockVisitor.visitClass.calledWithExactly(testClass)).to.be.true;
      expect(mockVisitor.visitClass.calledAfter(mockVisitor.visitEmptySchema)).to.be.true;

      const testKoq = await testSchema.getChild("TestKoQ");
      expect(testKoq).to.exist;
      expect(mockVisitor.visitKindOfQuantity.calledOnce).to.be.true;
      expect(mockVisitor.visitKindOfQuantity.calledWithExactly(testKoq)).to.be.true;
      expect(mockVisitor.visitKindOfQuantity.calledAfter(mockVisitor.visitEmptySchema)).to.be.true;

      expect(mockVisitor.visitFullSchema.calledOnce).to.be.true;
      expect(mockVisitor.visitFullSchema.calledWithExactly(testSchema)).to.be.true;
      expect(mockVisitor.visitFullSchema.calledAfter(mockVisitor.visitEnumeration)).to.be.true;
      expect(mockVisitor.visitFullSchema.calledAfter(mockVisitor.visitPropertyCategory)).to.be.true;
      expect(mockVisitor.visitFullSchema.calledAfter(mockVisitor.visitClass)).to.be.true;
      expect(mockVisitor.visitFullSchema.calledAfter(mockVisitor.visitKindOfQuantity)).to.be.true;
    });
  });
});
