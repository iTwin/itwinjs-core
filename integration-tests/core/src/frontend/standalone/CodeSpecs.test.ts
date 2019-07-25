/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { BisCodeSpec, CodeScopeSpec, CodeSpec } from "@bentley/imodeljs-common";
import { IModelApp, IModelConnection } from "@bentley/imodeljs-frontend";
import { assert } from "chai";
import * as path from "path";

const iModelFileName = path.join(process.env.IMODELJS_CORE_DIRNAME!, "core/backend/lib/test/assets/test.bim");

describe("CodeSpecs", async () => {
  let iModel: IModelConnection;

  before(async () => {
    IModelApp.startup();
    iModel = await IModelConnection.openSnapshot(iModelFileName);
  });

  after(async () => {
    if (iModel) await iModel.closeSnapshot();
    IModelApp.shutdown();
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
