/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { Element, Code } from "../Element";
import { IECClass, NavigationECProperty, PrimitiveECProperty } from "../ECClass";
import { ClassRegistry } from "../ClassRegistry";
import { IModel } from "../IModel";
import { IModelTestUtils } from "./IModelTestUtils";
import { Elements } from "../Elements";
import { SpatialViewDefinition, ViewDefinition3d } from "../ViewDefinition";
import { BisCore } from "../BisCore";

// First, register any domains that will be used in the tests.
BisCore.registerSchema();

// Fake ECClass metadata
const testEcClass: IECClass = {
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

describe("ClassRegistry", () => {

  it("should generate a Js class def from ECClass metadata", async () => {
    const factory = ClassRegistry.generateClassForECClass(testEcClass);
    assert.isFunction(factory);
    const obj = ClassRegistry.create({schemaName: testEcClass.schema, className: testEcClass.name});
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

  it("should verify the ECClass metadata of known element subclasses", async () => {
    const imodel: IModel = await IModelTestUtils.openIModel("test.bim", true);
    const elements: Elements = imodel.Elements;
    const code1 = new Code({ spec: "0x10", scope: "0x11", value: "RF1.dgn" });
    const el = await elements.getElement({ code: code1 });
    assert(el !== undefined);
    assert(el != null);
    if (el) {
      const ecclass: IECClass = await el.getECClass();
      assert.isNotNull(ecclass);
      assert.equal(ecclass.name, el.className);
      assert.equal(ecclass.schema, el.schemaName);
      // I happen to know that this is a BisCore.RepositoryLink
      assert.equal(ecclass.name, "RepositoryLink");
      assert.equal(ecclass.schema, BisCore.name);
      //  Check the metadata on the class itself
      assert.isTrue(ecclass.baseClasses.length > 0);
      assert.equal(ecclass.baseClasses[0].name, "UrlLink");
      assert.equal(ecclass.customAttributes[0].ecclass.name, "ClassHasHandler");
      //  Check the metadata on the one property that RepositoryLink defines, RepositoryGuid
      assert.isDefined(ecclass.properties);
      assert.isNotNull(ecclass.properties);
      assert.isDefined(ecclass.properties.repositoryGuid);
      const p: PrimitiveECProperty = ecclass.properties.repositoryGuid as PrimitiveECProperty;
      assert.isDefined(p.primitiveECProperty);
      assert.equal(p.primitiveECProperty.type, "binary");
      assert.equal(p.primitiveECProperty.extendedType, "BeGuid");
      assert.equal(p.customAttributes[1].ecclass.name, "HiddenProperty");
    }
    const el2 = await elements.getElement({ id: "0x34" });
    assert.isDefined(el2);
    assert.isNotNull(el2);
    if (el2) {
      const ecclass: IECClass = await el2.getECClass();
      assert.isNotNull(ecclass);
      assert.equal(ecclass.name, el2.className);
      assert.equal(ecclass.schema, el2.schemaName);
      // I happen to know that this is a BisCore.SpatialViewDefinition
      assert.equal(ecclass.name, SpatialViewDefinition.name);
      assert.equal(ecclass.schema, BisCore.name);
      assert.isTrue(ecclass.baseClasses.length > 0);
      assert.equal(ecclass.baseClasses[0].name, ViewDefinition3d.name);
      assert.isDefined(ecclass.properties);
      assert.isNotNull(ecclass.properties);
      assert.isDefined(ecclass.properties.modelSelector);
      const n: NavigationECProperty = ecclass.properties.modelSelector as NavigationECProperty;
      assert.isDefined(n.navigationECProperty);
      assert.equal(n.navigationECProperty.relationshipClass.name, "SpatialViewDefinitionUsesModelSelector");
    }
  });

  it("should get metadata for class", async () => {
    const imodel: IModel = await IModelTestUtils.openIModel("test.bim", true);
    const metadatastr: string = await imodel.getDgnDb().getECClassMetaData(BisCore.name, Element.name);
    assert.isNotNull(metadatastr);
    assert.isString(metadatastr);
    assert.notEqual(metadatastr.length, 0);
    const obj: any = JSON.parse(metadatastr);
    assert.isNotNull(obj);
    assert.isString(obj.name);
    assert.equal(obj.name, Element.name);
    assert.equal(obj.schema, BisCore.name);
    assert.isArray(obj.baseClasses);
    assert.equal(obj.baseClasses.length, 0);
    assert.isArray(obj.customAttributes);
    let foundClassHasHandler = false;
    let foundClassHasCurrentTimeStampProperty = false;
    for (const ca of obj.customAttributes) {
      if (ca.ecclass.name === "ClassHasHandler")
        foundClassHasHandler = true;
      else if (ca.ecclass.name === "ClassHasCurrentTimeStampProperty")
        foundClassHasCurrentTimeStampProperty = true;
    }
    assert.isTrue(foundClassHasHandler);
    assert.isTrue(foundClassHasCurrentTimeStampProperty);
    assert.isDefined(obj.properties.federationGuid);
    assert.isDefined(obj.properties.federationGuid.primitiveECProperty);
    assert.equal(obj.properties.federationGuid.primitiveECProperty.type, "binary");
    assert.equal(obj.properties.federationGuid.primitiveECProperty.extendedType, "BeGuid");
  });

  it("should get metadata for CA class just as well (and we'll see an array-typed property)", async () => {
    const imodel: IModel = await IModelTestUtils.openIModel("test.bim", true);
    const metadatastr: string = await imodel.getDgnDb().getECClassMetaData(BisCore.name, "ClassHasHandler");
    assert.isNotNull(metadatastr);
    assert.isString(metadatastr);
    assert.notEqual(metadatastr.length, 0);
    const obj: any = JSON.parse(metadatastr);
    assert.isDefined(obj.properties.restrictions);
    assert.isDefined(obj.properties.restrictions.primitveArrayECProperty);
    assert.equal(obj.properties.restrictions.primitveArrayECProperty.type, "string");
    assert.equal(obj.properties.restrictions.primitveArrayECProperty.minOccurs, 0);
  });
});

class Base {
  public static staticProperty: string = "base";
  public static get sqlName(): string { return "s." + this.staticProperty; }
}

class Derived extends Base {
}

describe("Static Properties", () => {

  it("should be inherited, and the subclass should get its own copy", async () => {
    assert.equal(Base.staticProperty, "base");
    assert.equal(Derived.staticProperty, "base"); // Derived inherits Base's staticProperty (via its prototype)
    Derived.staticProperty = "derived";           // Derived now gets its own copy of staticProperty
    assert.equal(Base.staticProperty, "base");      // Base's staticProperty remains as it was
    assert.equal(Derived.staticProperty, "derived"); // Derived's staticProperty is now different
    assert.equal(Base.sqlName, "s.base");
    const d = new Derived();
    assert.equal(Object.getPrototypeOf(d).constructor.staticProperty, "derived"); // Instances of Derived see Derived.staticProperty
    const b = new Base();
    assert.equal(Object.getPrototypeOf(b).constructor.staticProperty, "base"); // Instances of Base see Base.staticProperty
  });

});
