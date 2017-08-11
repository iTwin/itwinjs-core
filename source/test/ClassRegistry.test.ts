/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { ClassMetaData, NavigationECProperty, PrimitiveECProperty } from "../ECClass";
import { Code, IModel } from "../IModel";
import { IModelTestUtils } from "./IModelTestUtils";
import { Elements } from "../Elements";
import { SpatialViewDefinition, ViewDefinition3d } from "../ViewDefinition";
import { BisCore } from "../BisCore";

// First, register any domains that will be used in the tests.
BisCore.registerSchema();

describe("Class Registry", () => {

  it("should verify the ECClass metadata of known element subclasses", async () => {
    const imodel: IModel = await IModelTestUtils.openIModel("test.bim", true);
    const elements: Elements = imodel.elements;
    const code1 = new Code({ spec: "0x10", scope: "0x11", value: "RF1.dgn" });
    const el = await elements.getElement({ code: code1 });
    assert(el !== undefined);
    assert(el != null);
    if (el) {
      const ecclass: ClassMetaData | undefined = await el.getECClass();
      assert.notEqual(ecclass, undefined);
      if (undefined === ecclass)
        return;
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
      const ecclass: ClassMetaData | undefined = await el2.getECClass();
      assert.notEqual(ecclass, undefined);
      if (undefined === ecclass)
        return;
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
