/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import * as path from "path";
import { Id64, ActivityLoggingContext } from "@bentley/bentleyjs-core";
import { Code, EntityMetaData } from "@bentley/imodeljs-common";
import { DefinitionElement, IModelDb, RepositoryLink, SpatialViewDefinition, ViewDefinition3d, UrlLink } from "../../backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { KnownTestLocations } from "../KnownTestLocations";

describe("Class Registry", () => {
  let imodel: IModelDb;
  const actx = new ActivityLoggingContext("");

  before(() => {
    imodel = IModelTestUtils.openIModel("test.bim");
    assert.exists(imodel);
  });

  after(() => {
    if (imodel)
      IModelTestUtils.closeIModel(imodel);
  });

  it("should verify the Entity metadata of known element subclasses", () => {
    const code1 = new Code({ spec: "0x10", scope: "0x11", value: "RF1.dgn" });
    const el = imodel.elements.getElement(code1);
    assert.exists(el);
    if (el) {
      const metaData: EntityMetaData | undefined = el.getClassMetaData();
      assert.exists(metaData);
      if (undefined === metaData)
        return;
      assert.equal(metaData.ecclass, el.classFullName);
      // I happen to know that this is a BisCore:RepositoryLink
      assert.equal(metaData.ecclass, RepositoryLink.classFullName);
      //  Check the metadata on the class itself
      assert.isTrue(metaData.baseClasses.length > 0);
      assert.equal(metaData.baseClasses[0], UrlLink.classFullName);
      assert.equal(metaData.customAttributes![0].ecclass, "BisCore:ClassHasHandler");
      //  Check the metadata on the one property that RepositoryLink defines, RepositoryGuid
      assert.exists(metaData.properties);
      assert.isDefined(metaData.properties.repositoryGuid);
      const p = metaData.properties.repositoryGuid;
      assert.equal(p.extendedType, "BeGuid");
      assert.equal(p.customAttributes![1].ecclass, "CoreCustomAttributes:HiddenProperty");
    }
    const el2 = imodel.elements.getElement(new Id64("0x34"));
    assert.exists(el2);
    if (el2) {
      const metaData = el2.getClassMetaData();
      assert.exists(metaData);
      if (undefined === metaData)
        return;
      assert.equal(metaData.ecclass, el2.classFullName);
      // I happen to know that this is a BisCore.SpatialViewDefinition
      assert.equal(metaData.ecclass, SpatialViewDefinition.classFullName);
      assert.isTrue(metaData.baseClasses.length > 0);
      assert.equal(metaData.baseClasses[0], ViewDefinition3d.classFullName);
      assert.exists(metaData.properties);
      assert.isDefined(metaData.properties.modelSelector);
      const n = metaData.properties.modelSelector;
      assert.equal(n.relationshipClass, "BisCore:SpatialViewDefinitionUsesModelSelector");
    }
  });

  it("should verify Entity metadata with both base class and mixin properties", () => {
    const schemaPathname = path.join(KnownTestLocations.assetsDir, "TestDomain.ecschema.xml");
    imodel.importSchema(actx, schemaPathname); // will throw an exception if import fails

    const testDomainClass = imodel.getMetaData("TestDomain:TestDomainClass"); // will throw on failure

    assert.equal(testDomainClass.baseClasses.length, 2);
    assert.equal(testDomainClass.baseClasses[0], DefinitionElement.classFullName);
    assert.equal(testDomainClass.baseClasses[1], "TestDomain:IMixin");

    // Ensures the IMixin has been loaded as part of getMetadata call above.
    assert.isDefined(imodel.classMetaDataRegistry.find("TestDomain:IMixin"));

    // Verify that the forEach method which is called when constructing an entity
    // is picking up all expected properties.
    const testData: string[] = [];
    IModelDb.forEachMetaData(imodel, "TestDomain:TestDomainClass", true, (propName) => {
      testData.push(propName);
    }, false);

    const expectedString = testData.find((testString: string) => {
      return testString === "testMixinProperty";
    });

    assert.isDefined(expectedString);
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
    assert.equal((d.constructor as any).staticProperty, "derived"); // Instances of Derived see Derived.staticProperty
    const b = new Base();
    assert.equal((b.constructor as any).staticProperty, "base"); // Instances of Base see Base.staticProperty
  });

});
