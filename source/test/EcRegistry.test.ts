/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { ECClass } from "../Element";
import { EcRegistry } from "../EcRegistry";

// Fake ECClass metadata
const testEcClass: ECClass = {
  name: "Class1",
  schema: "Schema1",
  baseClasses: [],
  customAttributes: [],
  properties: {
    prop1: {
      customAttributes: [],
      primitiveECProperty: {type: "string"},
    },
    prop2: {
      customAttributes: [],
      navigationECProperty: {type: "long", direction: "forward", relationshipClass: {name: "foo", schema: "bar"}},
    },
  },
};

function registerEcClass(fullname: string, ctor: any) {
  EcRegistry.ecClasses.set(fullname.toLowerCase(), ctor);
}

describe("EcRegistry", () => {

  it("should generate a Js class def from ECClass metadata", async () => {
    const fullname = EcRegistry.getECClassFullName(testEcClass);
    let jsDef: string = EcRegistry.generateClassDefFromECClass(testEcClass);
    assert.isNotNull(jsDef);
    jsDef = jsDef + 'registerEcClass("' + fullname + '",' + testEcClass.name + ");";
    eval(jsDef);
    const factory = EcRegistry.ecClasses.get(fullname);
    assert.isFunction(factory);
    const obj = EcRegistry.create({schemaName: testEcClass.schema, className: testEcClass.name});
    assert.isTrue(obj != null);
    assert.isObject(obj);
    const propsfound: Set<string> = new Set<string>();
    for (const propname of Object.getOwnPropertyNames(obj)) {
      propsfound.add(propname);
    }
    assert.equal(propsfound.size, 2);
    assert.isTrue(propsfound.has("prop1"));
    assert.isTrue(propsfound.has("prop2"));
  });
});
