/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import * as path from "path";
import { Code } from "@itwin/core-common";
import {
  DefinitionElement,
  Element,
  InformationContentElement,
  RepositoryLink,
  SnapshotDb, SpatialViewDefinition, UrlLink, ViewDefinition3d,
} from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { KnownTestLocations } from "../KnownTestLocations";
import { SchemaKey } from "@itwin/ecschema-metadata";

describe("IModel Schema Context", () => {
  let imodel: SnapshotDb;

  before(() => {
    const seedFileName = IModelTestUtils.resolveAssetFile("test.bim");
    const testFileName = IModelTestUtils.prepareOutputFile("IModelSchemaContext", "IModelSchemaContext.bim");
    imodel = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);
    assert.exists(imodel);
  });

  after(() => {
    imodel?.close();
  });

  it("should verify the Entity metadata of known element subclasses", async () => {
    const code1 = new Code({ spec: "0x10", scope: "0x11", value: "RF1.dgn" });
    const el = imodel.elements.getElement(code1);
    assert.exists(el);
    if (el) {
      const ecClass = await el.getMetaData();
      assert.exists(ecClass);
      assert.equal(ecClass.schema.name, el.schemaName);
      assert.equal(ecClass.name, el.className);

      // I happen to know that this is a BisCore:RepositoryLink
      assert.equal(ecClass.fullName, RepositoryLink.schemaItemKey.fullName);
      //  Check the metadata on the class itself
      const baseClass = await ecClass.baseClass;
      assert.exists(ecClass.baseClass);
      if (undefined === baseClass)
        return;

      assert.equal(baseClass.fullName, UrlLink.schemaItemKey.fullName);
      assert.exists(ecClass.customAttributes);
      assert.isTrue(ecClass.customAttributes?.has("BisCore.ClassHasHandler"));
      //  Check the metadata on the one property that RepositoryLink defines, RepositoryGuid
      const property = await ecClass.getProperty("repositoryGuid");
      assert.exists(property);
      if (undefined === property)
        return;

      if(!property.isPrimitive())
        assert.fail("Property is not primitive");

      assert.equal(property.extendedTypeName, "BeGuid");
      assert.isTrue(property.customAttributes?.has("CoreCustomAttributes.HiddenProperty"));
    }
    const el2 = imodel.elements.getElement("0x34");
    assert.exists(el2);
    if (el2) {
      const metaData = await el2.getMetaData();
      assert.exists(metaData);
      if (undefined === metaData)
        return;
      assert.equal(metaData.fullName, el2.schemaItemKey.fullName);
      // I happen to know that this is a BisCore.SpatialViewDefinition
      assert.equal(metaData.fullName, SpatialViewDefinition.schemaItemKey.fullName);

      const baseClass = await metaData.baseClass;
      assert.exists(metaData.baseClass);
      if (undefined === baseClass)
        return;

      assert.equal(baseClass.fullName, ViewDefinition3d.schemaItemKey.fullName);
      const prop = metaData.getPropertySync("modelSelector");
      assert.isDefined(prop);
      if(!prop?.isNavigation())
        assert.fail("Property is not navigation property");

      assert.equal((await prop.relationshipClass).fullName, "BisCore.SpatialViewDefinitionUsesModelSelector");
    }
  });

  it("should verify Entity metadata with both base class and mixin properties", async () => {
    const schemaPathname = path.join(KnownTestLocations.assetsDir, "TestDomain.ecschema.xml");
    await imodel.importSchemas([schemaPathname]); // will throw an exception if import fails

    const testDomain = await imodel.schemaContext.getSchema(new SchemaKey("TestDomain", 1,0,0));
    const testDomainClass = await testDomain!.getEntityClass("TestDomainClass");
    const baseClassFullNames = Array.from(testDomainClass!.getAllBaseClassesSync() ?? []).map(baseClass => baseClass.fullName);
    assert.equal(baseClassFullNames.length, 4);
    assert.equal(baseClassFullNames[0], DefinitionElement.schemaItemKey.fullName);
    assert.equal(baseClassFullNames[1], InformationContentElement.schemaItemKey.fullName);
    assert.equal(baseClassFullNames[2], Element.schemaItemKey.fullName);
    assert.equal(baseClassFullNames[3], "TestDomain.IMixin");

    // Verify that the forEach method which is called when constructing an entity
    // is picking up all expected properties.
    const properties = Array.from(await testDomainClass!.getProperties());
    const testData = properties.map(property => property.name);
    const expectedString = testData.find((testString: string) => {
      return testString === "TestMixinProperty";
    });

    assert.isDefined(expectedString);
  });
});
