/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { EntityMetaData, NavigationPropertyMetaData, PrimitivePropertyMetaData } from "../Entity";
import { Code, IModel } from "../IModel";
import { IModelTestUtils } from "./IModelTestUtils";
import { Elements } from "../Elements";
import { SpatialViewDefinition, ViewDefinition3d } from "../ViewDefinition";
import { BisCore } from "../BisCore";

describe("Class Registry", () => {
  let imodel: IModel;

  before(async () => {
    // First, register any schemas that will be used in the tests.
    BisCore.registerSchema();
    imodel = await IModelTestUtils.openIModel("test.bim");
    assert.exists(imodel);
  });

  after(() => {
    imodel.closeDgnDb();
  });

  it("should verify the Entity metadata of known element subclasses", async () => {
    const elements: Elements = imodel.elements;
    const code1 = new Code({ spec: "0x10", scope: "0x11", value: "RF1.dgn" });
    const el = await elements.getElement(code1);
    assert.exists(el);
    if (el) {
      const metaData: EntityMetaData | undefined = await el.getClassMetaData();
      assert.exists(metaData);
      if (undefined === metaData)
        return;
      assert.equal(metaData.name, el.className);
      assert.equal(metaData.schema, el.schemaName);
      // I happen to know that this is a BisCore.RepositoryLink
      assert.equal(metaData.name, "RepositoryLink");
      assert.equal(metaData.schema, BisCore.name);
      //  Check the metadata on the class itself
      assert.isTrue(metaData.baseClasses.length > 0);
      assert.equal(metaData.baseClasses[0].name, "UrlLink");
      assert.equal(metaData.customAttributes[0].ecclass.name, "ClassHasHandler");
      //  Check the metadata on the one property that RepositoryLink defines, RepositoryGuid
      assert.exists(metaData.properties);
      assert.isDefined(metaData.properties.repositoryGuid);
      const p: PrimitivePropertyMetaData = metaData.properties.repositoryGuid as PrimitivePropertyMetaData;
      assert.isDefined(p.primitiveECProperty);
      assert.equal(p.primitiveECProperty.type, "binary");
      assert.equal(p.primitiveECProperty.extendedType, "BeGuid");
      assert.equal(p.customAttributes[1].ecclass.name, "HiddenProperty");
    }
    const el2 = await elements.getElement(new Id64("0x34"));
    assert.exists(el2);
    if (el2) {
      const metaData: EntityMetaData | undefined = await el2.getClassMetaData();
      assert.exists(metaData);
      if (undefined === metaData)
        return;
      assert.equal(metaData.name, el2.className);
      assert.equal(metaData.schema, el2.schemaName);
      // I happen to know that this is a BisCore.SpatialViewDefinition
      assert.equal(metaData.name, SpatialViewDefinition.name);
      assert.equal(metaData.schema, BisCore.name);
      assert.isTrue(metaData.baseClasses.length > 0);
      assert.equal(metaData.baseClasses[0].name, ViewDefinition3d.name);
      assert.exists(metaData.properties);
      assert.isDefined(metaData.properties.modelSelector);
      const n: NavigationPropertyMetaData = metaData.properties.modelSelector as NavigationPropertyMetaData;
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
