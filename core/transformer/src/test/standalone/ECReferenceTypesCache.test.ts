/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ConcreteEntityTypes } from "@itwin/core-common";
import { assert, expect } from "chai";
import * as path from "path";
import { ECReferenceTypesCache } from "../../ECReferenceTypesCache";
import { Relationship, SnapshotDb } from "@itwin/core-backend";
import { KnownTestLocations as BackendTestsKnownLocations, IModelTestUtils } from "@itwin/core-backend/lib/cjs/test";
import * as Semver from "semver";
import { Schema, SchemaItemType, SchemaLoader } from "@itwin/ecschema-metadata";
import * as sinon from "sinon";

describe("ECReferenceTypesCache", () => {
  let testIModel: SnapshotDb;
  const testSchemaPath = path.join(BackendTestsKnownLocations.assetsDir, "TestGeneratedClasses.ecschema.xml");
  const testFixtureRefCache = new ECReferenceTypesCache();

  before(async () => {
    const seedFileName = IModelTestUtils.resolveAssetFile("test.bim");
    const testFileName = IModelTestUtils.prepareOutputFile("ECReferenceTypesCache", "test.bim");
    testIModel = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);
    assert.exists(testIModel);
    await testIModel.importSchemas([testSchemaPath]); // will throw an exception if import fails
    await testFixtureRefCache.initAllSchemasInIModel(testIModel);
  });

  it("should be able to assume that all non-codespec classes in biscore have one of the known roots", async () => {
    const schemaLoader = new SchemaLoader((name: string) => { return testIModel.getSchemaProps(name); });
    const schema = schemaLoader.getSchema("BisCore");
    for (const ecclass of schema.getClasses()) {
      const unsupportedClassNames = ["CodeSpec", "ElementDrivesElement", "SpatialIndex"];
      if (unsupportedClassNames.includes(ecclass.name)) continue;
      const isEntityClass = ecclass.schemaItemType === SchemaItemType.EntityClass;
      const isEntityRelationship = ecclass instanceof Relationship;
      const isEntity = isEntityClass || isEntityRelationship;
      if (!isEntity) continue;
      // eslint-disable-next-line @typescript-eslint/dot-notation
      const rootBisClass = await testFixtureRefCache["getRootBisClass"](ecclass);
      // eslint-disable-next-line @typescript-eslint/dot-notation
      const type = ECReferenceTypesCache["bisRootClassToRefType"][rootBisClass.name];
      expect(type, `${ecclass.name} in BisCore did not derive from the assumed roots`).not.to.be.undefined;
    }
  });

  it("should cache navprop types", async () => {
    expect(
      testFixtureRefCache.getNavPropRefType("BisCore", "Element", "CodeScope")
    ).to.deep.equal(ConcreteEntityTypes.Element);

    expect(
      testFixtureRefCache.getNavPropRefType("TestGeneratedClasses", "LinkTableRelWithNavProp", "elemNavProp")
    ).to.deep.equal(ConcreteEntityTypes.Element);

    expect(
      testFixtureRefCache.getNavPropRefType("TestGeneratedClasses", "LinkTableRelWithNavProp", "modelNavProp")
    ).to.deep.equal(ConcreteEntityTypes.Model);

    expect(
      testFixtureRefCache.getNavPropRefType("TestGeneratedClasses", "LinkTableRelWithNavProp", "aspectNavProp")
    ).to.deep.equal(ConcreteEntityTypes.ElementAspect);

    /*
    // NOTE: disabled due to a bug mapping navprops to link table relationship instances
    expect(
      testReferenceCache.getNavPropRefType("TestGeneratedClasses", "LinkTableRelWithNavProp", "relNavProp")
    ).to.deep.equal(ConcreteEntityTypes.Element);
    */
  });

  it("should cache relationship end types", async () => {
    expect(
      testFixtureRefCache.getRelationshipEndType("BisCore", "ElementScopesCode")
    ).to.deep.equal({
      source: ConcreteEntityTypes.Element,
      target: ConcreteEntityTypes.Element,
    });

    expect(
      testFixtureRefCache.getRelationshipEndType("BisCore", "ModelSelectorRefersToModels")
    ).to.deep.equal({
      source: ConcreteEntityTypes.Element,
      target: ConcreteEntityTypes.Model,
    });

    expect(
      testFixtureRefCache.getRelationshipEndType("TestGeneratedClasses", "LinkTableRelToModelNavRel")
    ).to.deep.equal({
      source: ConcreteEntityTypes.Relationship,
      target: ConcreteEntityTypes.Model,
    });

    expect(
      testFixtureRefCache.getRelationshipEndType("TestGeneratedClasses", "ModelToAspectNavRel")
    ).to.deep.equal({
      source: ConcreteEntityTypes.Model,
      target: ConcreteEntityTypes.ElementAspect,
    });
  });

  it("should add new schema data when encountering a schema of a higher version", async () => {
    const thisTestRefCache = new ECReferenceTypesCache();

    const pathForEmpty = IModelTestUtils.prepareOutputFile("ECReferenceTypesCache", "empty.bim");
    const emptyWithBrandNewBiscore = SnapshotDb.createEmpty(pathForEmpty, { rootSubject: { name: "empty "}});

    const bisVersionInEmpty = emptyWithBrandNewBiscore.querySchemaVersion("BisCore");
    assert(bisVersionInEmpty !== undefined);

    const bisVersionInSeed = testIModel.querySchemaVersion("BisCore");
    assert(bisVersionInSeed !== undefined);

    assert(Semver.gt(bisVersionInEmpty, bisVersionInSeed));
    expect(() => testIModel.getMetaData("BisCore:RenderTimeline")).not.to.throw;
    expect(() => emptyWithBrandNewBiscore.getMetaData("BisCore:RenderTimeline")).to.throw;

    await thisTestRefCache.initAllSchemasInIModel(testIModel);
    expect(thisTestRefCache.getNavPropRefType("BisCore", "PhysicalType", "PhysicalMaterial")).to.be.undefined;

    await thisTestRefCache.initAllSchemasInIModel(emptyWithBrandNewBiscore);
    expect(thisTestRefCache.getNavPropRefType("BisCore", "PhysicalType", "PhysicalMaterial")).to.equal(ConcreteEntityTypes.Element);
  });

  it("should not init schemas of a lower or equal version", async () => {
    const thisTestRefCache = new ECReferenceTypesCache();

    const pathForEmpty1 = IModelTestUtils.prepareOutputFile("ECReferenceTypesCache", "empty.bim");
    const emptyWithBrandNewBiscore1 = SnapshotDb.createEmpty(pathForEmpty1, { rootSubject: { name: "empty "}});
    const pathForEmpty2 = IModelTestUtils.prepareOutputFile("ECReferenceTypesCache", "empty.bim");
    const emptyWithBrandNewBiscore2 = SnapshotDb.createEmpty(pathForEmpty2, { rootSubject: { name: "empty "}});

    const bisVersionInEmpty1 = emptyWithBrandNewBiscore1.querySchemaVersion("BisCore");
    assert(bisVersionInEmpty1 !== undefined);

    const bisVersionInEmpty2 = emptyWithBrandNewBiscore2.querySchemaVersion("BisCore");
    assert(bisVersionInEmpty2 !== undefined);

    const bisVersionInSeed = testIModel.querySchemaVersion("BisCore");
    assert(bisVersionInSeed !== undefined);

    assert(Semver.eq(bisVersionInEmpty1, bisVersionInEmpty2));
    assert(Semver.gt(bisVersionInEmpty1, bisVersionInSeed));
    expect(() => testIModel.getMetaData("BisCore:RenderTimeline")).not.to.throw;
    expect(() => emptyWithBrandNewBiscore1.getMetaData("BisCore:RenderTimeline")).to.throw;

    const initSchemaSpy = sinon.spy(thisTestRefCache, "initSchema" as keyof ECReferenceTypesCache);

    await thisTestRefCache.initAllSchemasInIModel(emptyWithBrandNewBiscore1);
    expect(initSchemaSpy.getCalls().find((c) => (c.args[0] as Schema).name === "BisCore")).not.to.be.undefined;
    initSchemaSpy.resetHistory();

    // test load from iModel with equal biscore version
    await thisTestRefCache.initAllSchemasInIModel(emptyWithBrandNewBiscore2);
    expect(initSchemaSpy.getCalls().find((c) => (c.args[0] as Schema).name === "BisCore")).to.be.undefined;
    initSchemaSpy.resetHistory();

    // test load from iModel with older biscore version
    await thisTestRefCache.initAllSchemasInIModel(testIModel);
    expect(initSchemaSpy.getCalls().find((c) => (c.args[0] as Schema).name === "BisCore")).to.be.undefined;

    sinon.restore();
  });
});
