/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ConcreteEntityTypes } from "@itwin/core-bentley";
import { assert, expect } from "chai";
import * as path from "path";
import { ECReferenceTypesCache } from "../../ECReferenceTypesCache";
import { SnapshotDb } from "../../IModelDb";
import { IModelTestUtils } from "../IModelTestUtils";
import { KnownTestLocations } from "../KnownTestLocations";

describe("ECReferenceTypesCache", () => {
  let imodel: SnapshotDb;
  const testSchemaPath = path.join(KnownTestLocations.assetsDir, "TestGeneratedClasses.ecschema.xml");
  const testReferenceCache = new ECReferenceTypesCache();

  before(async () => {
    const seedFileName = IModelTestUtils.resolveAssetFile("test.bim");
    const testFileName = IModelTestUtils.prepareOutputFile("ClassRegistry", "ClassRegistryTest.bim");
    imodel = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);
    assert.exists(imodel);
    await imodel.importSchemas([testSchemaPath]); // will throw an exception if import fails
    await testReferenceCache.initAllSchemasInIModel(imodel);
  });

  it("should cache navprop types", async () => {
    expect(
      testReferenceCache.getNavPropRefType("BisCore", "Element", "CodeScope")
    ).to.deep.equal({
      source: ConcreteEntityTypes.Element,
      target: ConcreteEntityTypes.Element,
    });
  });

  it("should cache relationship end types", async () => {
    expect(
      testReferenceCache.getRelationshipEndType("BisCore", "ElementScopesCode")
    ).to.deep.equal({
      source: ConcreteEntityTypes.Element,
      target: ConcreteEntityTypes.Element,
    });
  });
});
