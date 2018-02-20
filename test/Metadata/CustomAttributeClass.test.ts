/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import Schema from "../../source/Metadata/Schema";
import { ECObjectsError } from "../../source/Exception";
import CustomAttributeClass from "../../source/Metadata/CustomAttributeClass";
import { SchemaKey } from "../../source/ECObjects";

describe("CustomAttributeClass", () => {

  describe("fromJson", () => {
    let testClass: CustomAttributeClass;

    beforeEach(() => {
      const schema = new Schema(new SchemaKey("TestSchema", 1, 0, 0));
      testClass = new CustomAttributeClass(schema, "TestCustomAttribute");
    });

    it("should throw for missing appliesTo", async () => {
      expect(testClass).to.exist;
      await expect(testClass.fromJson({})).to.be.rejectedWith(ECObjectsError, `The CustomAttributeClass TestCustomAttribute is missing the required 'appliesTo' attribute.`);
    });

    it("should throw for invalid appliesTo", async () => {
      expect(testClass).to.exist;
      const json = { appliesTo: 0 };
      await expect(testClass.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The CustomAttributeClass TestCustomAttribute has an invalid 'appliesTo' attribute. It should be of type 'string'.`);
    });
  });
});
