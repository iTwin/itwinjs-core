/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { SchemaContext } from "../../Context";
import { SchemaItemType } from "../../ECObjects";
import { ECSchemaError } from "../../Exception";
import { InvertedUnit } from "../../Metadata/InvertedUnit";
import { Schema } from "../../Metadata/Schema";
import { Unit } from "../../Metadata/Unit";
import { UnitSystem } from "../../Metadata/UnitSystem";
import { createEmptyXmlDocument } from "../TestUtils/SerializationHelper";
import { createSchemaJsonWithItems } from "../TestUtils/DeserializationHelpers";
import { ECSchemaNamespaceUris } from "../../Constants";

/* eslint-disable @typescript-eslint/naming-convention */

describe("Inverted Unit tests", () => {
  let testUnit: InvertedUnit;

  describe("type safety checks", () => {
    const typeCheckJson = createSchemaJsonWithItems({
      TestInvertedUnit: {
        schemaItemType: "InvertedUnit",
        label: "Test Inverted Unit",
        unitSystem: "TestSchema.TestUnitSystem",
        invertsUnit: "TestSchema.TestUnit",
      },
      TestPhenomenon: {
        schemaItemType: "Phenomenon",
        definition: "LENGTH(1)",
      },
      TestUnitSystem: {
        schemaItemType: "UnitSystem",
        label: "Imperial",
        description: "Units of measure from the british imperial empire",
      },
      TestUnit: {
        schemaItemType: "Unit",
        phenomenon: "TestSchema.TestPhenomenon",
        unitSystem: "TestSchema.TestUnitSystem",
        definition: "Vert/Horizontal",
      },
    });

    let ecSchema: Schema;

    before(async () => {
      ecSchema = await Schema.fromJson(typeCheckJson, new SchemaContext());
      assert.isDefined(ecSchema);
    });

    it("typeguard and type assertion should work on InvertedUnit", async () => {
      const testInvertedUnit = await ecSchema.getItem("TestInvertedUnit");
      assert.isDefined(testInvertedUnit);
      expect(InvertedUnit.isInvertedUnit(testInvertedUnit)).to.be.true;
      expect(() => InvertedUnit.assertIsInvertedUnit(testInvertedUnit)).not.to.throw();
      // verify against other schema item type
      const testPhenomenon = await ecSchema.getItem("TestPhenomenon");
      assert.isDefined(testPhenomenon);
      expect(InvertedUnit.isInvertedUnit(testPhenomenon)).to.be.false;
      expect(() => InvertedUnit.assertIsInvertedUnit(testPhenomenon)).to.throw();
    });

    it("InvertedUnit type should work with getItem/Sync", async () => {
      expect(await ecSchema.getItem("TestInvertedUnit", InvertedUnit)).to.be.instanceof(InvertedUnit);
      expect(ecSchema.getItemSync("TestInvertedUnit", InvertedUnit)).to.be.instanceof(InvertedUnit);
    });

    it("InvertedUnit type should reject for other item types on getItem/Sync", async () => {
      expect(await ecSchema.getItem("TestPhenomenon", InvertedUnit)).to.be.undefined;
      expect(ecSchema.getItemSync("TestPhenomenon", InvertedUnit)).to.be.undefined;
    });
  });

  describe("SchemaItemType", () => {
    const schema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 0, 0);
    testUnit = new InvertedUnit(schema, "Test");
    it("should return correct item type and string", () => {
      assert.strictEqual(testUnit.schemaItemType, SchemaItemType.InvertedUnit);
      assert.strictEqual(testUnit.schemaItemType, "InvertedUnit");
    });
  });

  describe("Async fromJson", () => {
    beforeEach(() => {
      const schema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 0, 0);
      testUnit = new InvertedUnit(schema, "HORIZONTAL_PER_VERTICAL");
    });

    it("Basic test for label", async () => {
      const json = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        version: "1.0.0",
        name: "TestSchema",
        alias: "ts",
        items: {
          HORIZONTAL_PER_VERTICAL: {
            schemaItemType: "InvertedUnit",
            unitSystem: "TestSchema.INTERNATIONAL",
            invertsUnit: "TestSchema.VERTICAL_PER_HORIZONTAL",
            label: "Horizontal/Vertical",
          },
          INTERNATIONAL: {
            schemaItemType: "UnitSystem",
            label: "Imperial",
            description: "Units of measure from the british imperial empire",
          },
          VERTICAL_PER_HORIZONTAL: {
            schemaItemType: "Unit",
            phenomenon: "TestSchema.Length",
            unitSystem: "TestSchema.INTERNATIONAL",
            definition: "Vert/Horizontal",
          },
          Length: {
            schemaItemType: "Phenomenon",
            definition: "TestSchema.Length",
          },
        },
      };
      const ecSchema = await Schema.fromJson(json, new SchemaContext());
      assert.isDefined(ecSchema);
      const testItem = await ecSchema.getItem("HORIZONTAL_PER_VERTICAL");
      assert.isDefined(testItem);
      assert.isTrue(testItem?.schemaItemType === SchemaItemType.InvertedUnit);
      const testInvertedUnit: InvertedUnit = testItem as InvertedUnit;
      assert.isDefined(testInvertedUnit);
      assert.strictEqual(testInvertedUnit.label, "Horizontal/Vertical");
    });
    it("Label and description are optional", async () => {
      const json = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        version: "1.0.0",
        name: "TestSchema",
        alias: "ts",
        items: {
          HORIZONTAL_PER_VERTICAL: {
            schemaItemType: "InvertedUnit",
            unitSystem: "TestSchema.INTERNATIONAL",
            invertsUnit: "TestSchema.VERTICAL_PER_HORIZONTAL",
            label: "Horizontal/Vertical",
          },
          INTERNATIONAL: {
            schemaItemType: "UnitSystem",
            label: "Imperial",
            description: "Units of measure from the british imperial empire",
          },
          VERTICAL_PER_HORIZONTAL: {
            schemaItemType: "Unit",
            phenomenon: "TestSchema.Length",
            unitSystem: "TestSchema.INTERNATIONAL",
            definition: "Vert/Horizontal",
          },
          Length: {
            schemaItemType: "Phenomenon",
            definition: "TestSchema.Length",
          },
        },
      };
      const ecSchema = await Schema.fromJson(json, new SchemaContext());
      assert.isDefined(ecSchema);
      const testItem = await ecSchema.getItem("HORIZONTAL_PER_VERTICAL");
      assert.isDefined(testItem);
      assert.isTrue(testItem?.schemaItemType === SchemaItemType.InvertedUnit);
      const testInvertedUnit: InvertedUnit = testItem as InvertedUnit;
      assert.isDefined(testInvertedUnit);
      assert.strictEqual(testInvertedUnit.unitSystem!.fullName, "TestSchema.INTERNATIONAL");
      assert.strictEqual(testInvertedUnit.invertsUnit!.fullName, "TestSchema.VERTICAL_PER_HORIZONTAL");
    });
    it("unitSystem is required", async () => {
      const json = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        version: "1.0.0",
        name: "TestSchema",
        alias: "ts",
        items: {
          HORIZONTAL_PER_VERTICAL: {
            schemaItemType: "InvertedUnit",
            invertsUnit: "TestSchema.VERTICAL_PER_HORIZONTAL",
            label: "Horizontal/Vertical",
          },
          INTERNATIONAL: {
            schemaItemType: "UnitSystem",
            label: "Imperial",
            description: "Units of measure from the british imperial empire",
          },
          VERTICAL_PER_HORIZONTAL: {
            schemaItemType: "Unit",
            phenomenon: "TestSchema.Length",
            unitSystem: "TestSchema.INTERNATIONAL",
            definition: "Vert/Horizontal",
          },
          Length: {
            schemaItemType: "Phenomenon",
            definition: "TestSchema.Length",
          },
        },
      };
      await expect(Schema.fromJson(json, new SchemaContext())).to.be.rejectedWith(ECSchemaError, `The InvertedUnit TestSchema.HORIZONTAL_PER_VERTICAL does not have the required 'unitSystem' attribute.`);
    });
    it("Resolve all dependencies for inverts unit and unit system", async () => {
      const json = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        version: "1.0.0",
        name: "TestSchema",
        alias: "ts",
        items: {
          HORIZONTAL_PER_VERTICAL: {
            schemaItemType: "InvertedUnit",
            unitSystem: "TestSchema.INTERNATIONAL",
            invertsUnit: "TestSchema.VERTICAL_PER_HORIZONTAL",
          },
          INTERNATIONAL: {
            schemaItemType: "UnitSystem",
            label: "Imperial",
            description: "Units of measure from the british imperial empire",
          },
          VERTICAL_PER_HORIZONTAL: {
            schemaItemType: "Unit",
            phenomenon: "TestSchema.Length",
            unitSystem: "TestSchema.INTERNATIONAL",
            definition: "Vert/Horizontal",
          },
          Length: {
            schemaItemType: "Phenomenon",
            definition: "TestSchema.Length",
          },
        },
      };
      const ecSchema = await Schema.fromJson(json, new SchemaContext());
      assert.isDefined(ecSchema);
      const testItem = await ecSchema.getItem("HORIZONTAL_PER_VERTICAL");
      assert.isDefined(testItem);
      assert.isTrue(testItem?.schemaItemType === SchemaItemType.InvertedUnit);
      const testInvertedUnit: InvertedUnit = testItem as InvertedUnit;
      assert.isDefined(testInvertedUnit);

      const unitSysFromInvertedUnit = await testInvertedUnit.unitSystem;
      const invertsUnitFromInvertedUnit = await testInvertedUnit.invertsUnit;

      const testUnitSys = await ecSchema.getItem("INTERNATIONAL");
      assert.isDefined(testUnitSys);
      assert.isTrue(testUnitSys?.schemaItemType === SchemaItemType.UnitSystem);
      const testUnitSysItem: UnitSystem = testUnitSys as UnitSystem;
      assert.strictEqual(unitSysFromInvertedUnit!.description, testUnitSysItem.description);

      const testInvertsUnit = await ecSchema.getItem("VERTICAL_PER_HORIZONTAL");
      assert.isDefined(testInvertsUnit);
      assert.isTrue(testInvertsUnit?.schemaItemType === SchemaItemType.Unit);
      const testInvertsUnitItem: Unit = testInvertsUnit as Unit;
      assert.strictEqual(invertsUnitFromInvertedUnit!.definition, testInvertsUnitItem.definition);
    });
  });
  describe("Sync fromJson", () => {
    beforeEach(() => {
      const schema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 0, 0);
      testUnit = new InvertedUnit(schema, "HORIZONTAL_PER_VERTICAL");
    });

    it("Basic test for label", () => {
      const json = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        version: "1.0.0",
        name: "TestSchema",
        alias: "ts",
        items: {
          HORIZONTAL_PER_VERTICAL: {
            schemaItemType: "InvertedUnit",
            unitSystem: "TestSchema.INTERNATIONAL",
            invertsUnit: "TestSchema.VERTICAL_PER_HORIZONTAL",
            label: "Horizontal/Vertical",
          },
          INTERNATIONAL: {
            schemaItemType: "UnitSystem",
            label: "Imperial",
            description: "Units of measure from the british imperial empire",
          },
          VERTICAL_PER_HORIZONTAL: {
            schemaItemType: "Unit",
            phenomenon: "TestSchema.Length",
            unitSystem: "TestSchema.INTERNATIONAL",
            definition: "Vert/Horizontal",
          },
          Length: {
            schemaItemType: "Phenomenon",
            definition: "TestSchema.Length",
          },
        },
      };
      const ecSchema = Schema.fromJsonSync(json, new SchemaContext());
      assert.isDefined(ecSchema);
      const testItem = ecSchema.getItemSync("HORIZONTAL_PER_VERTICAL");
      assert.isDefined(testItem);
      assert.isTrue(testItem?.schemaItemType === SchemaItemType.InvertedUnit);
      const testInvertedUnit: InvertedUnit = testItem as InvertedUnit;
      assert.isDefined(testInvertedUnit);
      assert.strictEqual(testInvertedUnit.label, "Horizontal/Vertical");
    });
    it("Label and description are optional", () => {
      const json = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        version: "1.0.0",
        name: "TestSchema",
        alias: "ts",
        items: {
          HORIZONTAL_PER_VERTICAL: {
            schemaItemType: "InvertedUnit",
            unitSystem: "TestSchema.INTERNATIONAL",
            invertsUnit: "TestSchema.VERTICAL_PER_HORIZONTAL",
            label: "Horizontal/Vertical",
          },
          INTERNATIONAL: {
            schemaItemType: "UnitSystem",
            label: "Imperial",
            description: "Units of measure from the british imperial empire",
          },
          VERTICAL_PER_HORIZONTAL: {
            schemaItemType: "Unit",
            phenomenon: "TestSchema.Length",
            unitSystem: "TestSchema.INTERNATIONAL",
            definition: "Vert/Horizontal",
          },
          Length: {
            schemaItemType: "Phenomenon",
            definition: "TestSchema.Length",
          },
        },
      };
      const ecSchema = Schema.fromJsonSync(json, new SchemaContext());
      assert.isDefined(ecSchema);
      const testItem = ecSchema.getItemSync("HORIZONTAL_PER_VERTICAL");
      assert.isDefined(testItem);
      assert.isTrue(testItem?.schemaItemType === SchemaItemType.InvertedUnit);
      const testInvertedUnit: InvertedUnit = testItem as InvertedUnit;
      assert.isDefined(testInvertedUnit);
      assert.strictEqual(testInvertedUnit.unitSystem!.fullName, "TestSchema.INTERNATIONAL");
      assert.strictEqual(testInvertedUnit.invertsUnit!.fullName, "TestSchema.VERTICAL_PER_HORIZONTAL");
    });
    it("Resolve all dependencies for inverts unit and unit system", async () => {
      const json = {
        $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
        version: "1.0.0",
        name: "TestSchema",
        alias: "ts",
        items: {
          HORIZONTAL_PER_VERTICAL: {
            schemaItemType: "InvertedUnit",
            unitSystem: "TestSchema.INTERNATIONAL",
            invertsUnit: "TestSchema.VERTICAL_PER_HORIZONTAL",
          },
          INTERNATIONAL: {
            schemaItemType: "UnitSystem",
            label: "Imperial",
            description: "Units of measure from the british imperial empire",
          },
          VERTICAL_PER_HORIZONTAL: {
            schemaItemType: "Unit",
            phenomenon: "TestSchema.Length",
            unitSystem: "TestSchema.INTERNATIONAL",
            definition: "Vert/Horizontal",
          },
          Length: {
            schemaItemType: "Phenomenon",
            definition: "TestSchema.Length",
          },
        },
      };
      const ecSchema = Schema.fromJsonSync(json, new SchemaContext());
      assert.isDefined(ecSchema);
      const testItem = ecSchema.getItemSync("HORIZONTAL_PER_VERTICAL");
      assert.isDefined(testItem);
      assert.isTrue(testItem?.schemaItemType === SchemaItemType.InvertedUnit);
      const testInvertedUnit: InvertedUnit = testItem as InvertedUnit;
      assert.isDefined(testInvertedUnit);

      const unitSysFromInvertedUnit = await testInvertedUnit.unitSystem;
      const invertsUnitFromInvertedUnit = await testInvertedUnit.invertsUnit;

      const testUnitSys = ecSchema.getItemSync("INTERNATIONAL");
      assert.isDefined(testUnitSys);
      assert.isTrue(testUnitSys?.schemaItemType === SchemaItemType.UnitSystem);
      const testUnitSysItem: UnitSystem = testUnitSys as UnitSystem;
      assert.strictEqual(unitSysFromInvertedUnit!.description, testUnitSysItem.description);

      const testInvertsUnit = await ecSchema.getItem("VERTICAL_PER_HORIZONTAL");
      assert.isDefined(testInvertsUnit);
      assert.isTrue(testInvertsUnit?.schemaItemType === SchemaItemType.Unit);
      const testInvertsUnitItem: Unit = testInvertsUnit as Unit;
      assert.strictEqual(invertsUnitFromInvertedUnit!.definition, testInvertsUnitItem.definition);
    });
  });

  describe("toJSON", () => {
    beforeEach(() => {
      const schema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 0, 0);
      testUnit = new InvertedUnit(schema, "HORIZONTAL_PER_VERTICAL");
    });

    const jsonOne = {
      $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
      version: "1.0.0",
      name: "TestSchema",
      alias: "ts",
      items: {
        HORIZONTAL_PER_VERTICAL: {
          schemaItemType: "InvertedUnit",
          unitSystem: "TestSchema.INTERNATIONAL",
          invertsUnit: "TestSchema.VERTICAL_PER_HORIZONTAL",
        },
        INTERNATIONAL: {
          schemaItemType: "UnitSystem",
          label: "Imperial",
          description: "Units of measure from the british imperial empire",
        },
        VERTICAL_PER_HORIZONTAL: {
          schemaItemType: "Unit",
          phenomenon: "TestSchema.Length",
          unitSystem: "TestSchema.INTERNATIONAL",
          definition: "Vert/Horizontal",
        },
        Length: {
          schemaItemType: "Phenomenon",
          definition: "TestSchema.Length",
        },
      },
    };
    it("async- Serialization of fully defined inverted unit", async () => {
      const ecSchema = await Schema.fromJson(jsonOne, new SchemaContext());
      assert.isDefined(ecSchema);
      const testItem = await ecSchema.getItem("HORIZONTAL_PER_VERTICAL");
      assert.isTrue(testItem?.schemaItemType === SchemaItemType.InvertedUnit);
      const testInvertedUnit: InvertedUnit = testItem as InvertedUnit;
      assert.isDefined(testInvertedUnit);
      const invertedUnitSerialization = testInvertedUnit.toJSON(true, true);
      expect(invertedUnitSerialization.unitSystem).to.eql("TestSchema.INTERNATIONAL");
      expect(invertedUnitSerialization.invertsUnit).to.eql("TestSchema.VERTICAL_PER_HORIZONTAL");
    });
    it("sync- Serialization of fully defined inverted unit", () => {
      const ecSchema = Schema.fromJsonSync(jsonOne, new SchemaContext());
      assert.isDefined(ecSchema);
      const testItem = ecSchema.getItemSync("HORIZONTAL_PER_VERTICAL");
      assert.isTrue(testItem?.schemaItemType === SchemaItemType.InvertedUnit);
      const testInvertedUnit: InvertedUnit = testItem as InvertedUnit;
      assert.isDefined(testInvertedUnit);
      const invertedUnitSerialization = testInvertedUnit.toJSON(true, true);
      expect(invertedUnitSerialization.unitSystem).to.eql("TestSchema.INTERNATIONAL");
      expect(invertedUnitSerialization.invertsUnit).to.eql("TestSchema.VERTICAL_PER_HORIZONTAL");
    });
    it("async- JSON stringify serialization of fully defined inverted unit", async () => {
      const ecSchema = await Schema.fromJson(jsonOne, new SchemaContext());
      assert.isDefined(ecSchema);
      const testItem = await ecSchema.getItem("HORIZONTAL_PER_VERTICAL");
      assert.isTrue(testItem?.schemaItemType === SchemaItemType.InvertedUnit);
      const testInvertedUnit: InvertedUnit = testItem as InvertedUnit;
      assert.isDefined(testInvertedUnit);
      const json = JSON.stringify(testInvertedUnit);
      const invertedUnitSerialization = JSON.parse(json);
      expect(invertedUnitSerialization.unitSystem).to.eql("TestSchema.INTERNATIONAL");
      expect(invertedUnitSerialization.invertsUnit).to.eql("TestSchema.VERTICAL_PER_HORIZONTAL");
    });
    it("sync- JSON stringify serialization of fully defined inverted unit", () => {
      const ecSchema = Schema.fromJsonSync(jsonOne, new SchemaContext());
      assert.isDefined(ecSchema);
      const testItem = ecSchema.getItemSync("HORIZONTAL_PER_VERTICAL");
      assert.isTrue(testItem?.schemaItemType === SchemaItemType.InvertedUnit);
      const testInvertedUnit: InvertedUnit = testItem as InvertedUnit;
      assert.isDefined(testInvertedUnit);
      const json = JSON.stringify(testInvertedUnit);
      const invertedUnitSerialization = JSON.parse(json);
      expect(invertedUnitSerialization.unitSystem).to.eql("TestSchema.INTERNATIONAL");
      expect(invertedUnitSerialization.invertsUnit).to.eql("TestSchema.VERTICAL_PER_HORIZONTAL");
    });
  });

  describe("toXml", () => {
    const newDom = createEmptyXmlDocument();
    const schemaJson = {
      $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
      version: "1.0.0",
      name: "TestSchema",
      alias: "ts",
      items: {
        HORIZONTAL_PER_VERTICAL: {
          schemaItemType: "InvertedUnit",
          unitSystem: "TestSchema.INTERNATIONAL",
          invertsUnit: "TestSchema.VERTICAL_PER_HORIZONTAL",
        },
        INTERNATIONAL: {
          schemaItemType: "UnitSystem",
          label: "Imperial",
          description: "Units of measure from the british imperial empire",
        },
        VERTICAL_PER_HORIZONTAL: {
          schemaItemType: "Unit",
          phenomenon: "TestSchema.Length",
          unitSystem: "TestSchema.INTERNATIONAL",
          definition: "Vert/Horizontal",
        },
        Length: {
          schemaItemType: "Phenomenon",
          definition: "TestSchema.Length",
        },
      },
    };

    it("should properly serialize", async () => {
      const ecschema = await Schema.fromJson(schemaJson, new SchemaContext());
      assert.isDefined(ecschema);
      const testInvUnit = await ecschema.getItem("HORIZONTAL_PER_VERTICAL", InvertedUnit);
      assert.isDefined(testInvUnit);

      const serialized = await testInvUnit!.toXml(newDom);
      expect(serialized.nodeName).to.eql("InvertedUnit");
      expect(serialized.getAttribute("typeName")).to.eql("HORIZONTAL_PER_VERTICAL");
      expect(serialized.getAttribute("unitSystem")).to.eql("INTERNATIONAL");
      expect(serialized.getAttribute("invertsUnit")).to.eql("VERTICAL_PER_HORIZONTAL");
    });
  });
});
