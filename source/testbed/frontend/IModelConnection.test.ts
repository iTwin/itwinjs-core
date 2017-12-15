/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { Id64 } from "@build/imodeljs-core/node_modules/@bentley/bentleyjs-core/lib/Id";
import { CodeSpec, CodeSpecNames } from "@build/imodeljs-core/lib/common/Code";
import { ElementProps } from "@build/imodeljs-core/lib/common/ElementProps";
import { ModelProps } from "@build/imodeljs-core/lib/common/ModelProps";
import { IModelConnection, IModelConnectionElements, IModelConnectionModels } from "@build/imodeljs-core/lib/frontend/IModelConnection";
import { TestData } from "./TestData";

describe("IModelConnection", () => {
  it.only("should be able to get elements and models from an IModelConnection", async () => {
    const iModel: IModelConnection = await IModelConnection.open(TestData.accessToken, TestData.testProjectId, TestData.testIModelId);
    assert.exists(iModel);
    assert.isTrue(iModel instanceof IModelConnection);
    assert.exists(iModel.models);
    assert.isTrue(iModel.models instanceof IModelConnectionModels);
    assert.exists(iModel.elements);
    assert.isTrue(iModel.elements instanceof IModelConnectionElements);

    const elementIds: Id64[] = [iModel.elements.rootSubjectId];
    const elementProps: ElementProps[] = await iModel.elements.getElementProps(elementIds);
    assert.equal(elementProps.length, elementIds.length);
    assert.isTrue(iModel.elements.rootSubjectId.equals(new Id64(elementProps[0].id)));
    assert.isTrue(iModel.models.repositoryModelId.equals(new Id64(elementProps[0].model)));

    const queryElementIds: Id64[] = await iModel.elements.queryElementIds({ from: "BisCore.Category", limit: 20, offset: 0 });
    assert.isAtLeast(queryElementIds.length, 1);
    assert.isTrue(queryElementIds[0] instanceof Id64);

    const formatObjs: any[] = await iModel.elements.formatElements(queryElementIds);
    assert.isAtLeast(formatObjs.length, 1);

    const modelIds: Id64[] = [iModel.models.repositoryModelId];
    const modelProps: ModelProps[] = await iModel.models.getModelProps(modelIds);
    assert.exists(modelProps);
    assert.equal(modelProps.length, modelIds.length);
    assert.isTrue(iModel.models.repositoryModelId.equals(new Id64(modelProps[0].id)));

    const rows: any[] = await iModel.executeQuery("SELECT CodeValue AS code FROM BisCore.Category");
    assert.isAtLeast(rows.length, 1);
    assert.exists(rows[0].code);
    assert.equal(rows.length, queryElementIds.length);

    const codeSpecByName: CodeSpec = await iModel.codeSpecs.getCodeSpecByName(CodeSpecNames.SpatialCategory());
    assert.exists(codeSpecByName);
    const codeSpecById: CodeSpec = await iModel.codeSpecs.getCodeSpecById(codeSpecByName.id);
    assert.exists(codeSpecById);
    const codeSpecByNewId: CodeSpec = await iModel.codeSpecs.getCodeSpecById(new Id64(codeSpecByName.id));
    assert.exists(codeSpecByNewId);

    await iModel.close(TestData.accessToken);
  }).timeout(99999);
});
