/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import type { CodeSpec } from "@itwin/core-common";
import { BisCodeSpec, CodeScopeSpec } from "@itwin/core-common";
import type { IModelConnection} from "@itwin/core-frontend";
import { SnapshotConnection } from "@itwin/core-frontend";
import { TestUtility } from "../TestUtility";

describe("CodeSpecs", async () => {
  let iModel: IModelConnection;

  before(async () => {
    await TestUtility.startFrontend();
    iModel = await SnapshotConnection.openFile("test.bim");
  });

  after(async () => {
    if (iModel) await iModel.close();
    await TestUtility.shutdownFrontend();
  });

  it("should load CodeSpecs", async () => {
    const nullCodeSpec: CodeSpec = await iModel.codeSpecs.getByName(BisCodeSpec.nullCodeSpec);
    assert.equal(nullCodeSpec.scopeType, CodeScopeSpec.Type.Repository);
    assert.equal(nullCodeSpec.scopeReq, CodeScopeSpec.ScopeRequirement.ElementId);
    assert.isTrue(nullCodeSpec.isManagedWithIModel);

    const subCategoryCodeSpec: CodeSpec = await iModel.codeSpecs.getByName(BisCodeSpec.subCategory);
    assert.equal(subCategoryCodeSpec.scopeType, CodeScopeSpec.Type.ParentElement);
    assert.equal(subCategoryCodeSpec.scopeReq, CodeScopeSpec.ScopeRequirement.ElementId);
    assert.isTrue(subCategoryCodeSpec.isManagedWithIModel);

    const viewDefinitionCodeSpec: CodeSpec = await iModel.codeSpecs.getByName(BisCodeSpec.viewDefinition);
    assert.equal(viewDefinitionCodeSpec.scopeType, CodeScopeSpec.Type.Model);
    assert.equal(viewDefinitionCodeSpec.scopeReq, CodeScopeSpec.ScopeRequirement.ElementId);
    assert.isTrue(viewDefinitionCodeSpec.isManagedWithIModel);
  });
});
