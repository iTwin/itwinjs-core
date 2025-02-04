/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import * as path from "path";
import { Code, ColorDef, ElementProps, IModel, SubCategoryAppearance } from "@itwin/core-common";
import {
  DefinitionElement, IModelDb,
  IModelJsFs,
  RepositoryLink,
  SnapshotDb, SpatialCategory, SpatialViewDefinition, UrlLink, ViewDefinition3d,
} from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { KnownTestLocations } from "../KnownTestLocations";
import { Id64 } from "@itwin/core-bentley";

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
      assert.exists(ecClass.properties);
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
      assert.exists(metaData.properties);
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

describe("Performance Tests: IModel Schema Context", () => {
  let imodel: SnapshotDb;

  before(() => {
    const testFileName = IModelTestUtils.prepareOutputFile("PerfTestIModelSchemaContext", "PerfTestIModelSchemaContext.bim");
    imodel = IModelTestUtils.createSnapshotFromSeed(testFileName, IModelTestUtils.resolveAssetFile("test.bim"));
    assert.exists(imodel);
  });

  after(() => {
    imodel.abandonChanges();
    imodel.close();
  });

  async function testGetMetadataPerformance(elementIds: string[], firstValue: number, subsequentValues: number) {
    const perfMeasure: number[] = [];
    for (const elementId of elementIds) {
      const element = imodel.elements.getElement(elementId);
      assert.exists(element);

      const start = performance.now();
      const metaData = await element.getMetaData()
      const end = performance.now() - start;
      assert.exists(metaData);
      perfMeasure.push(end);
    }

    assert.isAtMost(perfMeasure[0], firstValue); // First retrieval will likely be slowest as the schema needs to be loaded

    for (let i = 1; i < perfMeasure.length; ++i)
      assert.isAtMost(perfMeasure[i], subsequentValues);  // Subsequent retrievals should be fast
  }

  it("test entityclass metadata retrieval performance", async () => {
    // Data Setup
    await imodel.importSchemas([path.join(KnownTestLocations.assetsDir, "PerfTestDomain.ecschema.xml")]); // will throw an exception if import fails

    const [, newModelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(imodel, Code.createEmpty(), true);
    let spatialCategoryId = SpatialCategory.queryCategoryIdByName(imodel, IModel.dictionaryId, "MySpatialCategory");
    if (undefined === spatialCategoryId)
      spatialCategoryId = SpatialCategory.insert(imodel, IModel.dictionaryId, "MySpatialCategory", new SubCategoryAppearance({ color: ColorDef.fromString("rgb(255,0,0)").toJSON() }));

    const idSet: string[] = [];
    for (const className of ["PerfElement", "PerfElementSub1", "PerfElementSub2"]) {
      const props = {
        classFullName: `PerfTestDomain:${className}`,
        model: newModelId,
        code: Code.createEmpty(),
        category: spatialCategoryId,
        userLabel: `Test ${className}`,
      } as ElementProps;

      for (let i = 0; i < 6; i++) {
        const element = imodel.elements.createElement(props);
        const id = imodel.elements.insertElement(element.toJSON());
        assert.isTrue(Id64.isValidId64(id), "insert successful");
        idSet.push(id);
      }
    }

    // Check the performance in seconds for a user defined schema for half the elements
    await testGetMetadataPerformance(idSet.splice(0, idSet.length / 2), 1.5, 0.1);

    // Check the performance in seconds for elements of BisCore schema
    await testGetMetadataPerformance(["0xe", "0x10"], 1.1, 0.1);

    // Check the performance in seconds for elements of Generic schema
    await testGetMetadataPerformance(["0x38", "0x3b"], 1.1, 0.1);

    // Test the remaining elements from the user defined schema
    await testGetMetadataPerformance(idSet, 0.1, 0.1);
  });
});