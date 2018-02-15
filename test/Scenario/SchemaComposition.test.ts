/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import ECSchema from "../../source/Metadata/Schema";
import { PrimitiveType } from "../../source/ECObjects";
import { ECClassModifier } from "../../source/ECObjects";

describe("Schema Composition", () => {
  describe("compose a schema via API", () => {
    const schema = new ECSchema("TestSchema", 1, 2, 3);
    const baseSchema = new ECSchema("BaseSchema", 2, 3, 4);

    it("fill schema with content", async () => {
      await schema.addReference(baseSchema);
      const personClass = await schema.createEntityClass("Person", ECClassModifier.Sealed);
      personClass.description = "This is my entity class";
      personClass.label = "My Entity";
      await personClass.createPrimitiveProperty("Name", PrimitiveType.String);

      const addressClass = await baseSchema.createStructClass("Address");
      addressClass.label = "Address";
      const houseNumberProperty = await addressClass.createPrimitiveProperty("HouseNumber", PrimitiveType.Integer);
      houseNumberProperty.label = "House Number";

      const primaryAddressProperty = await personClass.createStructProperty("PrimaryAddress", addressClass);
      primaryAddressProperty.label = "Primary Address";
      assert((await primaryAddressProperty.structClass).label === "Address", "Wrong label returned for struct property address");
      assert((await primaryAddressProperty.structClass).schema.schemaKey.name === "BaseSchema", "Struct class returned wrong schema");
      // bug: the next line does not work, yet. schemaName is unset
      // assert((await primaryAddressProperty.structClass).key.schemaName === "BaseSchema", "Struct class returned wrong schema");
    });
  });
});
