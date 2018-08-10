/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import * as sinon from "sinon";

import Schema from "../../src/Metadata/Schema";
import { ECObjectsError } from "../../src/Exception";

import KindOfQuantity from "../../src/Metadata/KindOfQuantity";

describe("KindOfQuantity", () => {
  const schema = new Schema("TestSchema", 1, 0, 0);

  describe("accept", () => {
    let testKoq: KindOfQuantity;

    beforeEach(() => {
      testKoq = new KindOfQuantity(schema, "TestKindOfQuantity");
    });

    it("should call visitKindOfQuantity on a SchemaItemVisitor object", async () => {
      expect(testKoq).to.exist;
      const mockVisitor = { visitKindOfQuantity: sinon.spy() };
      await testKoq.accept(mockVisitor);
      expect(mockVisitor.visitKindOfQuantity.calledOnce).to.be.true;
      expect(mockVisitor.visitKindOfQuantity.calledWithExactly(testKoq)).to.be.true;
    });

    it("should safely handle a SchemaItemVisitor without visitKindOfQuantity defined", async () => {
      expect(testKoq).to.exist;
      await testKoq.accept({});
    });
  });

  describe("fromJson", () => {
    let testKoQ: KindOfQuantity;
    beforeEach(() => {
      testKoQ = new KindOfQuantity(schema, "TestKindOfQuantity");
    });

    const baseJson = { schemaItemType: "KindOfQuantity" };
    it("should successfully deserialize valid JSON", async () => {
      const koqJson = {
        ...baseJson,
        label: "SomeDisplayLabel",
        description: "A really long description...",
        precision: 1.234,
        persistenceUnit: { unit: "in", format: "DEFAULTREAL" },
        presentationUnits: [
          { unit: "cm" },
          { unit: "in", format: "anotherFormat" },
        ],
      };
      await testKoQ.fromJson(koqJson);

      expect(testKoQ.name).to.eql("TestKindOfQuantity");
      expect(testKoQ.label).to.eql("SomeDisplayLabel");
      expect(testKoQ.description).to.eql("A really long description...");
      expect(testKoQ.precision).to.eql(1.234);
      expect(testKoQ.presentationUnits).to.exist;
      expect(testKoQ.presentationUnits.length).to.eql(2);
      expect(testKoQ.defaultPresentationUnit).to.eql({ unit: "cm" });
      expect(testKoQ.presentationUnits[0]).to.eql({ unit: "cm" });
      expect(testKoQ.presentationUnits[1]).to.eql({ unit: "in", format: "anotherFormat" });
      expect(testKoQ.persistenceUnit).to.eql({ unit: "in", format: "DEFAULTREAL" });
    });

    it("should successfully deserialize valid JSON (without units)", async () => {
      testKoQ = new KindOfQuantity(schema, "TestKindOfQuantity");
      const koqJson = {
        ...baseJson,
        label: "SomeDisplayLabel",
        description: "A really long description...",
        precision: 1.234,
      };
      await testKoQ.fromJson(koqJson);

      expect(testKoQ.name).to.eql("TestKindOfQuantity");
      expect(testKoQ.label).to.eql("SomeDisplayLabel");
      expect(testKoQ.description).to.eql("A really long description...");
      expect(testKoQ.precision).to.eql(1.234);
      expect(testKoQ.presentationUnits).to.exist;
      expect(testKoQ.presentationUnits.length).to.eql(0);
      expect(testKoQ.defaultPresentationUnit).to.not.exist;
      expect(testKoQ.persistenceUnit).to.not.exist;
    });

    async function testInvalidAttribute(attributeName: string, expectedType: string, value: any) {
      const json: any = {
        ...baseJson,
        [attributeName]: value,
      };
      await expect(testKoQ.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The KindOfQuantity TestKindOfQuantity has an invalid '${attributeName}' attribute. It should be of type '${expectedType}'.`);
    }

    function testInvalidAttributeSync(attributeName: string, expectedType: string, value: any) {
      const json: any = {
        ...baseJson,
        [attributeName]: value,
      };
      assert.throws(() => testKoQ.fromJsonSync(json), ECObjectsError, `The KindOfQuantity TestKindOfQuantity has an invalid '${attributeName}' attribute. It should be of type '${expectedType}'.`);
    }

    it("async - should throw for invalid precision", async () => testInvalidAttribute("precision", "number", false));
    it("sync - should throw for invalid precision", () => testInvalidAttributeSync("precision", "number", false));

    it("async - should throw for presentationUnits not an array", async () => testInvalidAttribute("presentationUnits", "object[]", 0));
    it("sync - should throw for presentationUnits not an array", () => testInvalidAttributeSync("presentationUnits", "object[]", 0));

    it("async - should throw for presentationUnits not an array of objects", async () => testInvalidAttribute("presentationUnits", "object[]", [0]));
    it("sync - should throw for presentationUnits not an array of objects", () => testInvalidAttributeSync("presentationUnits", "object[]", [0]));

    it("async - should throw for persistenceUnit not an object", async () => testInvalidAttribute("persistenceUnit", "object", 0));
    it("sync - should throw for persistenceUnit not an object", () => testInvalidAttributeSync("persistenceUnit", "object", 0));

    // should throw for presentationUnit with missing unit
    const presentationUnitWithMissingUnitJson = {
      ...baseJson,
      presentationUnits: [{}],
    };
    it("async - should throw for presentationUnit with missing unit", async () => {
      await expect(testKoQ.fromJson(presentationUnitWithMissingUnitJson)).to.be.rejectedWith(ECObjectsError, `The KindOfQuantity TestKindOfQuantity has a presentationUnit that is missing the required attribute 'unit'.`);
    });
    it("sync - should throw for presentationUnit with missing unit", () => {
      assert.throws(() => testKoQ.fromJsonSync(presentationUnitWithMissingUnitJson), ECObjectsError, `The KindOfQuantity TestKindOfQuantity has a presentationUnit that is missing the required attribute 'unit'.`);
    });

    // should throw for presentationUnit with invalid unit
    const presentationUnitWithInvalidUnitJson = {
      ...baseJson,
      presentationUnits: [{ unit: 0 }],
    };
    it("async - should throw for presentationUnit with invalid unit", async () => {
      await expect(testKoQ.fromJson(presentationUnitWithInvalidUnitJson)).to.be.rejectedWith(ECObjectsError, `The KindOfQuantity TestKindOfQuantity has a presentationUnit with an invalid 'unit' attribute. It should be of type 'string'.`);
    });
    it("sync - should throw for presentationUnit with invalid unit", () => {
      assert.throws(() => testKoQ.fromJsonSync(presentationUnitWithInvalidUnitJson), ECObjectsError, `The KindOfQuantity TestKindOfQuantity has a presentationUnit with an invalid 'unit' attribute. It should be of type 'string'.`);
    });

    // should throw for presentationUnit with invalid format
    const presentationUnitWithInvalidFormatJson = {
      ...baseJson,
      presentationUnits: [{ unit: "valid", format: false }],
    };
    it("async - should throw for presentationUnit with invalid format", async () => {
      await expect(testKoQ.fromJson(presentationUnitWithInvalidFormatJson)).to.be.rejectedWith(ECObjectsError, `The KindOfQuantity TestKindOfQuantity has a presentationUnit with an invalid 'format' attribute. It should be of type 'string'.`);
    });

    it("sync - should throw for presentationUnit with invalid format", () => {
      assert.throws(() => testKoQ.fromJsonSync(presentationUnitWithInvalidFormatJson), ECObjectsError, `The KindOfQuantity TestKindOfQuantity has a presentationUnit with an invalid 'format' attribute. It should be of type 'string'.`);
    });

    // should throw for persistenceUnit with missing unit
    const persistenceUnitWithMissingUnit = {
      ...baseJson,
      persistenceUnit: {},
    };
    it("async - should throw for persistenceUnit with missing unit", async () => {
      await expect(testKoQ.fromJson(persistenceUnitWithMissingUnit)).to.be.rejectedWith(ECObjectsError, `The KindOfQuantity TestKindOfQuantity has a persistenceUnit that is missing the required attribute 'unit'.`);
    });
    it("sync - should throw for persistenceUnit with missing unit", () => {
      assert.throws(() => testKoQ.fromJsonSync(persistenceUnitWithMissingUnit), ECObjectsError, `The KindOfQuantity TestKindOfQuantity has a persistenceUnit that is missing the required attribute 'unit'.`);
    });

    // should throw for persistenceUnit with invalid unit
    const persistenceUnitWithInvalidUnit = {
      ...baseJson,
      persistenceUnit: { unit: 0 },
    };
    it("async - should throw for persistenceUnit with invalid unit", async () => {
      await expect(testKoQ.fromJson(persistenceUnitWithInvalidUnit)).to.be.rejectedWith(ECObjectsError, `The KindOfQuantity TestKindOfQuantity has a persistenceUnit with an invalid 'unit' attribute. It should be of type 'string'.`);
    });
    it("sync - should throw for persistenceUnit with invalid unit", () => {
      assert.throws(() => testKoQ.fromJsonSync(persistenceUnitWithInvalidUnit), ECObjectsError, `The KindOfQuantity TestKindOfQuantity has a persistenceUnit with an invalid 'unit' attribute. It should be of type 'string'.`);
    });

    // should throw for persistenceUnit with invalid format
    const persistenceUnitWithInvalidFormat = {
      ...baseJson,
      persistenceUnit: { unit: "valid", format: false },
    };
    it("async - should throw for persistenceUnit with invalid format", async () => {
      await expect(testKoQ.fromJson(persistenceUnitWithInvalidFormat)).to.be.rejectedWith(ECObjectsError, `The KindOfQuantity TestKindOfQuantity has a persistenceUnit with an invalid 'format' attribute. It should be of type 'string'.`);
    });
    it("sync - should throw for persistenceUnit with invalid format", () => {
      assert.throws(() => testKoQ.fromJsonSync(persistenceUnitWithInvalidFormat), ECObjectsError, `The KindOfQuantity TestKindOfQuantity has a persistenceUnit with an invalid 'format' attribute. It should be of type 'string'.`);
    });
  });
  describe("toJson", () => {
    let testKoQ: KindOfQuantity;
    beforeEach(() => {
      testKoQ = new KindOfQuantity(schema, "TestKindOfQuantity");
    });

    const baseJson = {
      schemaItemType: "KindOfQuantity",
      $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/schemaitem",
      name: "TestKindOfQuantity",
      schema: "TestSchema",
      schemaVersion: "1.0.0",
    };
    it("should successfully deserialize valid JSON", async () => {
      const koqJson = {
        ...baseJson,
        label: "SomeDisplayLabel",
        description: "A really long description...",
        precision: 1.234,
        persistenceUnit: { unit: "in", format: "DEFAULTREAL" },
        presentationUnits: [
          { unit: "cm", format: "format" },
          { unit: "in", format: "anotherFormat" },
        ],
      };
      await testKoQ.fromJson(koqJson);
      const koQSerialization = testKoQ.toJson(true, true);
      assert.isDefined(koQSerialization);
      expect(koQSerialization.name).to.eql("TestKindOfQuantity");
      expect(koQSerialization.label).to.eql("SomeDisplayLabel");
      expect(koQSerialization.description).to.eql("A really long description...");
      expect(koQSerialization.precision).to.eql(1.234);
      expect(koQSerialization.presentationUnits).to.exist;
      expect(koQSerialization.presentationUnits.length).to.eql(2);
      expect(koQSerialization.presentationUnits[0]).to.eql({ unit: "cm", format: "format" });
      expect(koQSerialization.presentationUnits[1]).to.eql({ unit: "in", format: "anotherFormat" });
      expect(koQSerialization.persistenceUnit).to.eql({ unit: "in", format: "DEFAULTREAL" });
    });
  });
});
