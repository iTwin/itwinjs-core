import { assert, expect } from "chai";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { AccessToken } from "@bentley/imodeljs-clients";
import { CodeSpec, CodeSpecNames } from "../common/Code";
import { IModelConnection } from "../frontend/IModelConnection";
import { IModelTestUtils } from "./IModelTestUtils";
import { AxisAlignedBox3d } from "../common/geometry/Primitives";

describe.skip("IModelConnection", () => {
  // todo: These tests need a better location
  let accessToken: AccessToken;
  let testProjectId: string;
  let testIModelId: string;
  let iModel: IModelConnection;

  before(async () => {
    accessToken = await IModelTestUtils.getTestUserAccessToken();
    testProjectId = await IModelTestUtils.getTestProjectId(accessToken, "NodeJsTestProject");
    testIModelId = await IModelTestUtils.getTestIModelId(accessToken, testProjectId, "TestModel");
    iModel = await IModelConnection.open(accessToken, testProjectId, testIModelId);
  });

  it("should be able to get the name of the IModel", async () => {
    expect(iModel.name).equals("MyTestModel");
  });

  it("should be able to get extents of the IModel", async () => {
    const extents: AxisAlignedBox3d = iModel.projectExtents;
    assert(!extents.isNull());
  });

  it("should be able to get CodeSpecs from IModelConnection", async () => {
    const codeSpecByName: CodeSpec = await iModel.codeSpecs.getCodeSpecByName(CodeSpecNames.SpatialCategory());
    assert.exists(codeSpecByName);
    const codeSpecById: CodeSpec = await iModel.codeSpecs.getCodeSpecById(codeSpecByName.id);
    assert.exists(codeSpecById);
    const codeSpecByNewId: CodeSpec = await iModel.codeSpecs.getCodeSpecById(new Id64(codeSpecByName.id));
    assert.exists(codeSpecByNewId);
  });
});
