import { assert, expect } from "chai";
import { OpenMode } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { AccessToken } from "@bentley/imodeljs-clients";
import { IModelConnection } from "../frontend/IModelConnection";
import { IModelTestUtils } from "./IModelTestUtils";
import { AxisAlignedBox3d } from "../common/geometry/Primitives";

describe("IModelConnection", () => {
  // todo: These tests need a better location
  let accessToken: AccessToken;
  let testProjectId: string;
  let testIModelId: string;
  let iModel: IModelConnection;

  before(async () => {
    accessToken = await IModelTestUtils.getTestUserAccessToken();
    testProjectId = await IModelTestUtils.getTestProjectId(accessToken, "NodeJsTestProject");
    testIModelId = await IModelTestUtils.getTestIModelId(accessToken, testProjectId, "MyTestModel");

    iModel = await IModelConnection.open(accessToken, testProjectId, testIModelId, OpenMode.Readonly);
  });

  it("should be able to get the name of the IModel", async () => {
    expect(iModel.name).equals("MyTestModel");
  });

  it("should be able to get extents of the IModel", async () => {
    const extents: AxisAlignedBox3d = iModel.getExtents();
    assert(!extents.isNull());
  });

});
